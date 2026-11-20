-- =====================================================================
-- CƠ SỞ DỮ LIỆU: QUẢN LÝ CÔNG VIỆC TRADE MKT – TRÍ VIỆT PHÁT
-- Cách dùng: Supabase > SQL Editor > New query > dán toàn bộ file > Run
-- Chạy lại nhiều lần vẫn an toàn (không tạo trùng, không xóa dữ liệu).
--
-- TRƯỚC KHI CHẠY: tìm dòng "EMAIL_CUA_BAN@gmail.com" ở mục 10
-- và thay bằng email bạn dùng để đăng nhập app.
--
-- Sơ đồ:
--   nhan_hang, he_thong        : danh mục chuẩn (nhãn hàng, kênh/hệ thống)
--   thanh_vien                 : ai được dùng app (quản lý / thành viên / khách chỉ xem)
--   quy_trinh -> quy_trinh_buoc: quy trình mẫu và các bước chuẩn
--   hoat_dong -> buoc_cong_viec: hoạt động thật và tiến độ từng bước
--   nhat_ky_buoc               : lịch sử đổi trạng thái / hạn / người làm (để đo lường)
--   lich_post                  : lịch CTKM / kỳ post của từng siêu thị, đồng bộ từ Google Sheet
--   nguon_*, gia_ban           : số gốc sell-in, Co.op, Emart, bảng giá (tự nạp mỗi giờ từ thư mục Drive / Google Sheet)
--   sell_in, sell_out, ...     : bảng tự tính từ số gốc cho app đọc
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. DANH MỤC
-- ---------------------------------------------------------------------
create table if not exists public.nhan_hang (
  id         smallint generated always as identity primary key,
  ten        text not null unique check (length(trim(ten)) > 0),
  thu_tu     smallint not null default 0,
  dang_dung  boolean not null default true
);

create table if not exists public.he_thong (
  id         smallint generated always as identity primary key,
  ten        text not null unique check (length(trim(ten)) > 0),
  thu_tu     smallint not null default 0,
  dang_dung  boolean not null default true
);

-- ---------------------------------------------------------------------
-- 2. THÀNH VIÊN – chỉ email có trong bảng này mới xem được dữ liệu
--    vai_tro: quan_ly (toàn quyền) | thanh_vien (xem và sửa công việc)
--             | khach (chỉ xem, không sửa được gì)
-- ---------------------------------------------------------------------
create table if not exists public.thanh_vien (
  email    text primary key check (email = lower(trim(email)) and email like '%@%'),
  ho_ten   text not null check (length(trim(ho_ten)) > 0),
  vai_tro  text not null default 'thanh_vien' check (vai_tro in ('quan_ly', 'thanh_vien', 'khach')),
  tao_luc  timestamptz not null default now()
);

-- Bảng đã có từ trước: cập nhật ràng buộc để nhận thêm vai trò khách
alter table public.thanh_vien drop constraint if exists thanh_vien_vai_tro_check;
alter table public.thanh_vien add constraint thanh_vien_vai_tro_check
  check (vai_tro in ('quan_ly', 'thanh_vien', 'khach'));

create or replace function public.email_hien_tai() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

-- Được xem: có trong danh sách, kể cả khách
create or replace function public.duoc_xem() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.thanh_vien where email = public.email_hien_tai());
$$;

-- Được sửa công việc: quản lý hoặc thành viên (khách không được)
create or replace function public.la_thanh_vien() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.thanh_vien
                 where email = public.email_hien_tai() and vai_tro in ('quan_ly', 'thanh_vien'));
$$;

create or replace function public.la_quan_ly() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.thanh_vien
                 where email = public.email_hien_tai() and vai_tro = 'quan_ly');
$$;

-- ---------------------------------------------------------------------
-- 3. QUY TRÌNH MẪU
-- ---------------------------------------------------------------------
create table if not exists public.quy_trinh (
  id            uuid primary key default gen_random_uuid(),
  ma            text unique,
  ten           text not null check (length(trim(ten)) > 0),
  mo_ta         text not null default '',
  thu_tu        smallint not null default 0,
  tao_luc       timestamptz not null default now(),
  cap_nhat_luc  timestamptz not null default now()
);

create table if not exists public.quy_trinh_buoc (
  id            uuid primary key default gen_random_uuid(),
  quy_trinh_id  uuid not null references public.quy_trinh(id) on delete cascade,
  thu_tu        smallint not null default 0,
  ten           text not null check (length(trim(ten)) > 0),
  vai_tro       text not null default '',
  moc           text not null default 'bat_dau' check (moc in ('bat_dau', 'ket_thuc')),
  so_ngay       integer not null default 0 check (so_ngay between -365 and 365),
  ket_qua       text not null default '',
  nguoi_lam     text not null default '',   -- người làm mặc định (tên thành viên)
  nguoi_duyet   text not null default ''    -- để trống = không cần duyệt
);
alter table public.quy_trinh_buoc add column if not exists nguoi_lam   text not null default '';
alter table public.quy_trinh_buoc add column if not exists nguoi_duyet text not null default '';
create index if not exists quy_trinh_buoc_quy_trinh_idx on public.quy_trinh_buoc (quy_trinh_id, thu_tu);

-- ---------------------------------------------------------------------
-- 4. HOẠT ĐỘNG
-- ---------------------------------------------------------------------
create table if not exists public.hoat_dong (
  id             uuid primary key default gen_random_uuid(),
  ten            text not null check (length(trim(ten)) > 0),
  quy_trinh_id   uuid references public.quy_trinh(id) on delete set null,
  quy_trinh_ten  text not null default '',          -- giữ tên mẫu tại thời điểm tạo
  nhan_hang_id   smallint references public.nhan_hang(id),
  he_thong_id    smallint references public.he_thong(id),
  ngay_bat_dau   date not null,
  ngay_ket_thuc  date not null,
  nguoi_tao      text not null default public.email_hien_tai(),
  tao_luc        timestamptz not null default now(),
  cap_nhat_luc   timestamptz not null default now(),
  constraint hoat_dong_ngay_hop_le check (ngay_ket_thuc >= ngay_bat_dau)
);
create index if not exists hoat_dong_ngay_idx      on public.hoat_dong (ngay_bat_dau);
create index if not exists hoat_dong_nhan_hang_idx on public.hoat_dong (nhan_hang_id);
create index if not exists hoat_dong_he_thong_idx  on public.hoat_dong (he_thong_id);

-- ---------------------------------------------------------------------
-- 5. BƯỚC CÔNG VIỆC (tiến độ thật của từng hoạt động)
-- ---------------------------------------------------------------------
create table if not exists public.buoc_cong_viec (
  id              uuid primary key default gen_random_uuid(),
  hoat_dong_id    uuid not null references public.hoat_dong(id) on delete cascade,
  thu_tu          smallint not null default 0,
  ten             text not null check (length(trim(ten)) > 0),
  vai_tro         text not null default '',
  nguoi_lam       text not null default '',
  moc             text check (moc in ('bat_dau', 'ket_thuc')),   -- để tính lại hạn khi đổi ngày
  so_ngay         integer check (so_ngay between -365 and 365),
  han             date,
  trang_thai      text not null default 'chua_lam'
                  check (trang_thai in ('chua_lam', 'dang_lam', 'cho_duyet', 'xong', 'khong_ap_dung')),
  ngay_xong       date,
  ket_qua         text not null default '',
  ghi_chu         text not null default '',
  cap_nhat_luc    timestamptz not null default now(),
  nguoi_cap_nhat  text not null default public.email_hien_tai(),
  nguoi_duyet     text not null default '',   -- để trống = không cần duyệt
  ngay_nop        date,                       -- ngày người làm bấm hoàn tất để gửi duyệt
  ly_do_tra       text not null default '',   -- lý do lần trả lại gần nhất
  duyet_boi       text,                       -- email người duyệt
  duyet_luc       timestamptz,
  constraint buoc_ngay_xong_hop_le check (trang_thai = 'xong' or ngay_xong is null)
);
-- Bảng đã có từ trước: thêm cột và cập nhật ràng buộc cho bước cần duyệt
alter table public.buoc_cong_viec add column if not exists nguoi_duyet text not null default '';
alter table public.buoc_cong_viec add column if not exists ngay_nop    date;
alter table public.buoc_cong_viec add column if not exists ly_do_tra   text not null default '';
alter table public.buoc_cong_viec add column if not exists duyet_boi   text;
alter table public.buoc_cong_viec add column if not exists duyet_luc   timestamptz;
alter table public.buoc_cong_viec drop constraint if exists buoc_cong_viec_trang_thai_check;
alter table public.buoc_cong_viec add constraint buoc_cong_viec_trang_thai_check
  check (trang_thai in ('chua_lam', 'dang_lam', 'cho_duyet', 'xong', 'khong_ap_dung'));
alter table public.buoc_cong_viec drop constraint if exists buoc_cho_duyet_can_nguoi_duyet;
alter table public.buoc_cong_viec add constraint buoc_cho_duyet_can_nguoi_duyet
  check (trang_thai <> 'cho_duyet' or length(trim(nguoi_duyet)) > 0);
create index if not exists buoc_hoat_dong_idx on public.buoc_cong_viec (hoat_dong_id, thu_tu);
create index if not exists buoc_dang_mo_han_idx on public.buoc_cong_viec (han)
  where trang_thai in ('chua_lam', 'dang_lam');
create index if not exists buoc_nguoi_lam_idx on public.buoc_cong_viec (nguoi_lam);

-- ---------------------------------------------------------------------
-- 6. NHẬT KÝ THAY ĐỔI – giữ lại cả khi bước bị xóa, dùng để đo lường về sau
-- ---------------------------------------------------------------------
create table if not exists public.nhat_ky_buoc (
  id            bigint generated always as identity primary key,
  buoc_id       uuid not null,
  hoat_dong_id  uuid,
  truong        text not null,           -- trang_thai | han | nguoi_lam | nguoi_duyet | tra_lai | xoa_buoc
  gia_tri_cu    text,
  gia_tri_moi   text,
  nguoi         text not null default public.email_hien_tai(),
  luc           timestamptz not null default now()
);
create index if not exists nhat_ky_buoc_idx on public.nhat_ky_buoc (buoc_id, luc);
create index if not exists nhat_ky_luc_idx  on public.nhat_ky_buoc (luc);

-- Cho phép người đã đăng nhập dùng các bảng (quyền chi tiết do mục 8 quyết định)
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------
-- 7. TỰ ĐỘNG: cập nhật thời gian sửa + ghi nhật ký
-- ---------------------------------------------------------------------
create or replace function public.dat_cap_nhat_luc() returns trigger
language plpgsql as $$
begin
  new.cap_nhat_luc := now();
  if tg_table_name = 'buoc_cong_viec' then
    new.nguoi_cap_nhat := public.email_hien_tai();
  end if;
  return new;
end $$;

drop trigger if exists quy_trinh_cap_nhat on public.quy_trinh;
create trigger quy_trinh_cap_nhat before update on public.quy_trinh
  for each row execute function public.dat_cap_nhat_luc();
drop trigger if exists hoat_dong_cap_nhat on public.hoat_dong;
create trigger hoat_dong_cap_nhat before update on public.hoat_dong
  for each row execute function public.dat_cap_nhat_luc();
drop trigger if exists buoc_cap_nhat on public.buoc_cong_viec;
create trigger buoc_cap_nhat before update on public.buoc_cong_viec
  for each row execute function public.dat_cap_nhat_luc();

-- Tên so khớp không phân biệt hoa/thường và khoảng trắng thừa (giống trong app)
create or replace function public.khoa_ten(t text) returns text
language sql immutable as $$
  select lower(regexp_replace(trim(coalesce(t, '')), '\s+', ' ', 'g'));
$$;

-- DUYỆT BƯỚC: bước có người duyệt thì chỉ người duyệt (hoặc quản lý) mới chuyển sang "xong".
-- Người làm bấm hoàn tất -> cho_duyet. Người duyệt: duyệt -> xong, trả lại -> dang_lam.
create or replace function public.kiem_duyet_buoc() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ten_toi  text;
  la_ql    boolean := public.la_quan_ly();
  duoc     boolean;
  hom_nay  date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  select ho_ten into ten_toi from public.thanh_vien where email = public.email_hien_tai();
  duoc := la_ql or (public.khoa_ten(new.nguoi_duyet) <> ''
                    and public.khoa_ten(ten_toi) = public.khoa_ten(new.nguoi_duyet));
  if tg_op = 'UPDATE' then
    if new.nguoi_duyet is distinct from old.nguoi_duyet and public.khoa_ten(old.nguoi_duyet) <> '' and not la_ql then
      raise exception 'Chỉ quản lý mới đổi hoặc bỏ người duyệt của bước đã có người duyệt';
    end if;
    if old.trang_thai = 'xong' and new.trang_thai <> 'xong' and public.khoa_ten(old.nguoi_duyet) <> ''
       and not (la_ql or public.khoa_ten(ten_toi) = public.khoa_ten(old.nguoi_duyet)) then
      raise exception 'Bước đã được duyệt. Chỉ người duyệt hoặc quản lý mới mở lại được';
    end if;
    if new.trang_thai = 'xong' and old.trang_thai <> 'xong' and public.khoa_ten(new.nguoi_duyet) <> '' and not duoc then
      raise exception 'Bước này cần % duyệt. Hãy bấm hoàn tất để gửi duyệt', new.nguoi_duyet;
    end if;
    if new.trang_thai = 'cho_duyet' and old.trang_thai <> 'cho_duyet' then new.ngay_nop := hom_nay; end if;
    if new.trang_thai = 'xong' and old.trang_thai <> 'xong' and public.khoa_ten(new.nguoi_duyet) <> '' then
      new.duyet_boi := public.email_hien_tai(); new.duyet_luc := now(); new.ly_do_tra := '';
    end if;
  else
    if new.trang_thai = 'xong' and public.khoa_ten(new.nguoi_duyet) <> '' and not duoc then
      raise exception 'Bước này cần % duyệt', new.nguoi_duyet;
    end if;
    if new.trang_thai = 'cho_duyet' then new.ngay_nop := hom_nay; end if;
  end if;
  if new.trang_thai <> 'xong' then new.duyet_boi := null; new.duyet_luc := null; end if;
  return new;
end $$;

drop trigger if exists buoc_kiem_duyet on public.buoc_cong_viec;
create trigger buoc_kiem_duyet before insert or update on public.buoc_cong_viec
  for each row execute function public.kiem_duyet_buoc();

create or replace function public.ghi_nhat_ky_buoc() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into public.nhat_ky_buoc (buoc_id, hoat_dong_id, truong, gia_tri_cu, gia_tri_moi)
    values (old.id, old.hoat_dong_id, 'xoa_buoc', old.ten, null);
    return old;
  end if;
  if tg_op = 'INSERT' then
    insert into public.nhat_ky_buoc (buoc_id, hoat_dong_id, truong, gia_tri_cu, gia_tri_moi)
    values (new.id, new.hoat_dong_id, 'trang_thai', null, new.trang_thai);
    return new;
  end if;
  if new.trang_thai is distinct from old.trang_thai then
    insert into public.nhat_ky_buoc (buoc_id, hoat_dong_id, truong, gia_tri_cu, gia_tri_moi)
    values (new.id, new.hoat_dong_id, 'trang_thai', old.trang_thai, new.trang_thai);
  end if;
  if new.han is distinct from old.han then
    insert into public.nhat_ky_buoc (buoc_id, hoat_dong_id, truong, gia_tri_cu, gia_tri_moi)
    values (new.id, new.hoat_dong_id, 'han', old.han::text, new.han::text);
  end if;
  if new.nguoi_lam is distinct from old.nguoi_lam then
    insert into public.nhat_ky_buoc (buoc_id, hoat_dong_id, truong, gia_tri_cu, gia_tri_moi)
    values (new.id, new.hoat_dong_id, 'nguoi_lam', old.nguoi_lam, new.nguoi_lam);
  end if;
  if new.nguoi_duyet is distinct from old.nguoi_duyet then
    insert into public.nhat_ky_buoc (buoc_id, hoat_dong_id, truong, gia_tri_cu, gia_tri_moi)
    values (new.id, new.hoat_dong_id, 'nguoi_duyet', old.nguoi_duyet, new.nguoi_duyet);
  end if;
  if new.ly_do_tra is distinct from old.ly_do_tra and new.ly_do_tra <> '' then
    insert into public.nhat_ky_buoc (buoc_id, hoat_dong_id, truong, gia_tri_cu, gia_tri_moi)
    values (new.id, new.hoat_dong_id, 'tra_lai', null, new.ly_do_tra);
  end if;
  return new;
end $$;

drop trigger if exists buoc_nhat_ky on public.buoc_cong_viec;
create trigger buoc_nhat_ky after insert or update or delete on public.buoc_cong_viec
  for each row execute function public.ghi_nhat_ky_buoc();

-- ---------------------------------------------------------------------
-- 8. PHÂN QUYỀN (bảo mật theo dòng)
--    Khách: chỉ xem công việc, quy trình, danh mục; không thấy danh sách thành viên.
--    Thành viên: xem và sửa công việc, quy trình.
--    Quản lý: được sửa thêm danh mục và danh sách thành viên.
-- ---------------------------------------------------------------------
alter table public.nhan_hang      enable row level security;
alter table public.he_thong       enable row level security;
alter table public.thanh_vien     enable row level security;
alter table public.quy_trinh      enable row level security;
alter table public.quy_trinh_buoc enable row level security;
alter table public.hoat_dong      enable row level security;
alter table public.buoc_cong_viec enable row level security;
alter table public.nhat_ky_buoc   enable row level security;

do $$
declare
  bang text;
begin
  -- Bảng thành viên được sửa, khách chỉ xem
  foreach bang in array array['quy_trinh','quy_trinh_buoc','hoat_dong','buoc_cong_viec'] loop
    execute format('drop policy if exists "thanh_vien_xem" on public.%I', bang);
    execute format('drop policy if exists "thanh_vien_them" on public.%I', bang);
    execute format('drop policy if exists "thanh_vien_sua" on public.%I', bang);
    execute format('drop policy if exists "thanh_vien_xoa" on public.%I', bang);
    execute format('create policy "thanh_vien_xem" on public.%I for select to authenticated using (public.duoc_xem())', bang);
    execute format('create policy "thanh_vien_them" on public.%I for insert to authenticated with check (public.la_thanh_vien())', bang);
    execute format('create policy "thanh_vien_sua" on public.%I for update to authenticated using (public.la_thanh_vien()) with check (public.la_thanh_vien())', bang);
    execute format('create policy "thanh_vien_xoa" on public.%I for delete to authenticated using (public.la_thanh_vien())', bang);
  end loop;

  -- Bảng chỉ quản lý được sửa, thành viên chỉ xem
  foreach bang in array array['nhan_hang','he_thong','thanh_vien'] loop
    execute format('drop policy if exists "thanh_vien_xem" on public.%I', bang);
    execute format('drop policy if exists "quan_ly_them" on public.%I', bang);
    execute format('drop policy if exists "quan_ly_sua" on public.%I', bang);
    execute format('drop policy if exists "quan_ly_xoa" on public.%I', bang);
    -- danh mục: khách xem được; danh sách thành viên: khách chỉ thấy dòng của chính mình
    if bang = 'thanh_vien' then
      execute format('create policy "thanh_vien_xem" on public.%I for select to authenticated using (public.la_thanh_vien() or email = public.email_hien_tai())', bang);
    else
      execute format('create policy "thanh_vien_xem" on public.%I for select to authenticated using (public.duoc_xem())', bang);
    end if;
    execute format('create policy "quan_ly_them" on public.%I for insert to authenticated with check (public.la_quan_ly())', bang);
    execute format('create policy "quan_ly_sua" on public.%I for update to authenticated using (public.la_quan_ly()) with check (public.la_quan_ly())', bang);
    execute format('create policy "quan_ly_xoa" on public.%I for delete to authenticated using (public.la_quan_ly())', bang);
  end loop;
end $$;

-- Nhật ký: thành viên chỉ xem, không ai sửa tay (chỉ hệ thống tự ghi)
drop policy if exists "thanh_vien_xem" on public.nhat_ky_buoc;
create policy "thanh_vien_xem" on public.nhat_ky_buoc for select to authenticated using (public.la_thanh_vien());

grant execute on function public.duoc_xem() to authenticated;
grant execute on function public.la_thanh_vien() to authenticated;
grant execute on function public.la_quan_ly() to authenticated;

-- Quản lý không tự xóa hoặc hạ quyền chính mình (tránh bị khóa ngoài app)
create or replace function public.giu_quan_ly_cuoi() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'DELETE' and old.vai_tro = 'quan_ly')
     or (tg_op = 'UPDATE' and old.vai_tro = 'quan_ly' and new.vai_tro <> 'quan_ly') then
    if not exists (select 1 from public.thanh_vien where vai_tro = 'quan_ly' and email <> old.email) then
      raise exception 'Phải còn ít nhất một quản lý';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists thanh_vien_giu_quan_ly on public.thanh_vien;
create trigger thanh_vien_giu_quan_ly before update or delete on public.thanh_vien
  for each row execute function public.giu_quan_ly_cuoi();

-- ---------------------------------------------------------------------
-- 9. CẬP NHẬT TỨC THỜI giữa các máy (Realtime)
-- ---------------------------------------------------------------------
do $$
declare
  bang text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach bang in array array['quy_trinh','quy_trinh_buoc','hoat_dong','buoc_cong_viec','thanh_vien'] loop
      if not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = bang) then
        execute format('alter publication supabase_realtime add table public.%I', bang);
      end if;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 10. DỮ LIỆU BAN ĐẦU
-- ---------------------------------------------------------------------
-- >>> LẦN ĐẦU CÀI: THAY EMAIL Ở DÒNG DƯỚI bằng email bạn đăng nhập app <<<
-- Chỉ thêm khi chưa có quản lý nào; chạy lại file trên dự án đang dùng thì dòng này không làm gì.
-- Không bao giờ thêm email mẫu EMAIL_CUA_BAN.
insert into public.thanh_vien (email, ho_ten, vai_tro)
select lower('EMAIL_CUA_BAN@gmail.com'), 'Quản lý', 'quan_ly'
where not exists (select 1 from public.thanh_vien where vai_tro = 'quan_ly')
  and lower('EMAIL_CUA_BAN@gmail.com') not like 'email%cua%ban@%'
on conflict (email) do nothing;

insert into public.nhan_hang (ten, thu_tu) values
  ('Wil', 1), ('Gungon', 2), ('Guyumi', 3), ('Má Bảy', 4), ('Nhiều nhãn', 5)
on conflict (ten) do nothing;

insert into public.he_thong (ten, thu_tu) values
  ('GO/BigC', 1), ('Co.op', 2), ('Emart', 3), ('Lotte', 4), ('BHX', 5),
  ('WinMart/WinMart+', 6), ('Thương mại điện tử', 7), ('GT', 8),
  ('Nhiều hệ thống', 9), ('Nội bộ', 10), ('King Food', 11), ('Satra', 12), ('Oshi', 13)
on conflict (ten) do nothing;

-- Quy trình mẫu (chỉ thêm nếu chưa có mã đó). Người làm / người duyệt đặt sau trong app: Quy trình mẫu > Sửa.
with mau(ma, ten, mo_ta, thu_tu) as (values
  ('ctkm-catalogue', 'CTKM Onpost (lên catalogue siêu thị)', 'Khuyến mãi đăng trên catalogue / tờ rơi của chuỗi siêu thị, cần BOD duyệt mức giảm', 1),
  ('ctkm-offpost', 'CTKM Offpost (giảm giá tại quầy)', 'Giảm giá tại siêu thị, không lên catalogue, cần BOD duyệt mức giảm', 2),
  ('activation', 'Activation / Inline tại siêu thị', 'Dùng thử, PG bán hàng, hoạt động tại điểm bán', 3),
  ('trung-bay', 'Trưng bày / thuê vị trí', 'Ụ, đầu kệ, quầy kệ riêng tại siêu thị hoặc cửa hàng', 4),
  ('audit', 'Audit điểm bán định kỳ', 'Kiểm tra tồn, giá, trưng bày, đối thủ tại điểm bán', 5),
  ('posm', 'Sản xuất và phân bổ POSM', 'Vật phẩm quảng cáo tại điểm bán', 6),
  ('bao-cao-thang', 'Báo cáo tháng kênh MT', 'Ngày bắt đầu/kết thúc = đầu và cuối tháng báo cáo', 7)
), moi as (
  insert into public.quy_trinh (ma, ten, mo_ta, thu_tu)
  select ma, ten, mo_ta, thu_tu from mau
  on conflict (ma) do nothing
  returning id, ma
)
insert into public.quy_trinh_buoc (quy_trinh_id, thu_tu, ten, vai_tro, moc, so_ngay, ket_qua)
select moi.id, b.thu_tu, b.ten, b.vai_tro, b.moc, b.so_ngay, b.ket_qua
from moi
join (values
  ('ctkm-catalogue',1,'Lấy lịch catalogue và hạn chót đăng ký từ siêu thị','Trade MKT','bat_dau',-60,'Lịch catalogue'),
  ('ctkm-catalogue',2,'Chọn SKU, đề xuất mức giảm và tính chi phí','Trade MKT','bat_dau',-50,'File đề xuất có biên lợi nhuận'),
  ('ctkm-catalogue',3,'Trình BOD duyệt mức giảm','Trưởng nhóm','bat_dau',-45,'Link file scan tờ trình BOD đã ký'),
  ('ctkm-catalogue',4,'Gửi đăng ký cho siêu thị theo đúng % đã duyệt','Trade MKT','bat_dau',-40,'Form đăng ký đã gửi'),
  ('ctkm-catalogue',5,'Theo dõi, lấy xác nhận tham gia và bản in thử catalogue','Trade MKT','bat_dau',-30,'Xác nhận hoặc bản in thử catalogue'),
  ('ctkm-catalogue',6,'Kiểm tra tồn kho, đặt hàng đủ cho đợt KM','Trade MKT','bat_dau',-14,'Đơn đặt hàng'),
  ('ctkm-catalogue',7,'Đi kiểm tra giá KM và trưng bày tại điểm bán','Trade MKT','bat_dau',2,'Ảnh kệ, ảnh bảng giá'),
  ('ctkm-catalogue',8,'Theo dõi bán ra giữa đợt','Trade MKT','bat_dau',7,'Số bán ra theo SKU'),
  ('ctkm-catalogue',9,'Đánh giá sau CTKM so với bán trơn','Trade MKT','ket_thuc',21,'Báo cáo đánh giá'),

  ('ctkm-offpost',1,'Chọn siêu thị và thời gian chạy','Trade MKT','bat_dau',-30,'Danh sách siêu thị, thời gian'),
  ('ctkm-offpost',2,'Chọn SKU, đề xuất mức giảm và tính chi phí','Trade MKT','bat_dau',-25,'File đề xuất có biên lợi nhuận'),
  ('ctkm-offpost',3,'Trình BOD duyệt mức giảm','Trưởng nhóm','bat_dau',-21,'Link file scan tờ trình BOD đã ký'),
  ('ctkm-offpost',4,'Gửi đề nghị giảm giá cho siêu thị theo đúng % đã duyệt','Trade MKT','bat_dau',-14,'Đề nghị đã gửi'),
  ('ctkm-offpost',5,'Kiểm tra tồn kho, đặt hàng đủ cho đợt KM','Trade MKT','bat_dau',-10,'Đơn đặt hàng'),
  ('ctkm-offpost',6,'Theo dõi siêu thị xác nhận và cập nhật giá trên hệ thống','Trade MKT','bat_dau',-3,'Xác nhận của siêu thị'),
  ('ctkm-offpost',7,'Đi kiểm tra giá KM tại điểm bán','Trade MKT','bat_dau',1,'Ảnh bảng giá, ảnh kệ'),
  ('ctkm-offpost',8,'Theo dõi bán ra giữa đợt','Trade MKT','bat_dau',7,'Số bán ra theo SKU'),
  ('ctkm-offpost',9,'Đánh giá sau CTKM so với bán trơn','Trade MKT','ket_thuc',14,'Báo cáo đánh giá'),

  ('activation',1,'Chọn điểm bán và lên ý tưởng hoạt động','Trade MKT','bat_dau',-30,'Danh sách điểm, ý tưởng'),
  ('activation',2,'Lập ngân sách và chỉ số đo lường','Trade MKT','bat_dau',-25,'Bảng ngân sách, chỉ tiêu'),
  ('activation',3,'Xin phép siêu thị, đăng ký vị trí','Trade MKT','bat_dau',-14,'Xác nhận của siêu thị'),
  ('activation',4,'Tuyển và đào tạo PG','Trade MKT','bat_dau',-7,'Danh sách PG, tài liệu đào tạo'),
  ('activation',5,'Chuẩn bị vật phẩm, hàng dùng thử, quà','Trade MKT','bat_dau',-5,'Biên bản giao nhận'),
  ('activation',6,'Theo dõi triển khai, nhận báo cáo ngày từ PG','Trade MKT','bat_dau',0,'Báo cáo ngày, ảnh'),
  ('activation',7,'Đi kiểm tra đột xuất tại điểm','Trade MKT','bat_dau',3,'Ảnh, ghi chú kiểm tra'),
  ('activation',8,'Tổng kết, so sánh bán ra với bán trơn trước đó','Trade MKT','ket_thuc',14,'Báo cáo tổng kết'),

  ('trung-bay',1,'Chọn điểm bán và vị trí','Trade MKT','bat_dau',-30,'Danh sách điểm, vị trí'),
  ('trung-bay',2,'Thương lượng phí, đề xuất chi phí','Trade MKT','bat_dau',-21,'Đề xuất chi phí'),
  ('trung-bay',3,'Ký thỏa thuận với siêu thị','Trade MKT','bat_dau',-18,'Thỏa thuận/hợp đồng'),
  ('trung-bay',4,'Sản xuất vật phẩm trưng bày','Trade MKT','bat_dau',-10,'Vật phẩm đã nhận'),
  ('trung-bay',5,'Đi lắp đặt và chụp ảnh nghiệm thu','Trade MKT','bat_dau',0,'Ảnh nghiệm thu'),
  ('trung-bay',6,'Đi kiểm tra định kỳ','Trade MKT','bat_dau',14,'Ảnh kiểm tra'),
  ('trung-bay',7,'Nghiệm thu và thanh toán','Trade MKT','ket_thuc',7,'Biên bản, hóa đơn'),
  ('trung-bay',8,'Đánh giá hiệu quả','Trade MKT','ket_thuc',14,'Báo cáo đánh giá'),

  ('audit',1,'Lên danh sách điểm và chia tuyến cho nhóm','Trade MKT','bat_dau',-5,'Danh sách điểm theo người'),
  ('audit',2,'Chuẩn bị form audit','Trade MKT','bat_dau',-2,'Link form'),
  ('audit',3,'Đi audit tại điểm bán','Trade MKT','ket_thuc',0,'Dữ liệu form đầy đủ'),
  ('audit',4,'Kiểm tra dữ liệu đủ và đúng','Trade MKT','ket_thuc',1,'Danh sách điểm thiếu'),
  ('audit',5,'Tổng hợp và báo cáo audit','Trade MKT','ket_thuc',3,'Báo cáo audit'),
  ('audit',6,'Giao việc khắc phục','Trưởng nhóm','ket_thuc',5,'Danh sách việc cần sửa'),

  ('posm',1,'Xác định nhu cầu và số lượng','Trade MKT','bat_dau',-30,'Bảng số lượng theo điểm'),
  ('posm',2,'Thiết kế','Trade MKT','bat_dau',-25,'File thiết kế'),
  ('posm',3,'Lấy báo giá và đặt in','Trade MKT','bat_dau',-18,'Báo giá, đơn đặt'),
  ('posm',4,'Nhận hàng và kiểm tra chất lượng','Trade MKT','bat_dau',-5,'Biên bản nhận hàng'),
  ('posm',5,'Giao POSM về điểm bán','Trade MKT','bat_dau',-2,'Biên bản giao'),
  ('posm',6,'Đi kiểm tra lắp đặt tại điểm','Trade MKT','bat_dau',5,'Ảnh tại điểm'),

  ('bao-cao-thang',1,'Thu thập số sell-in','Trade MKT','ket_thuc',2,'Sổ chi tiết bán hàng'),
  ('bao-cao-thang',2,'Thu thập số bán ra và tồn kho từ chuỗi','Trade MKT','ket_thuc',3,'File bán ra – tồn của chuỗi'),
  ('bao-cao-thang',3,'Làm sạch và đối chiếu số liệu','Trade MKT','ket_thuc',4,'File số đã đối chiếu'),
  ('bao-cao-thang',4,'Viết báo cáo','Trade MKT','ket_thuc',6,'Bản báo cáo'),
  ('bao-cao-thang',5,'Gửi BOD','Trade MKT','ket_thuc',7,'Link/bản gửi BOD')
) as b(ma, thu_tu, ten, vai_tro, moc, so_ngay, ket_qua) on b.ma = moi.ma;

-- ---------------------------------------------------------------------
-- 11. NHẮC HẠN QUA EMAIL (dùng cùng script Google Apps Script trong thư mục nhac-han-email)
--     Script gọi hàm ds_nhac_viec(ma) mỗi sáng. Muốn gọi phải có MÃ BÍ MẬT;
--     không có mã thì hàm không trả gì. Hàm chỉ đọc, không sửa được dữ liệu.
--     Xem mã:  select ma_bi_mat from public.cau_hinh_nhac;
--     Đổi mã:  update public.cau_hinh_nhac set ma_bi_mat = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
-- ---------------------------------------------------------------------
create table if not exists public.cau_hinh_nhac (
  id         smallint primary key default 1 check (id = 1),
  ma_bi_mat  text not null check (length(ma_bi_mat) >= 32)
);
alter table public.cau_hinh_nhac enable row level security;   -- không có policy: không ai đọc được qua app
revoke all on public.cau_hinh_nhac from anon, authenticated;
insert into public.cau_hinh_nhac (id, ma_bi_mat)
values (1, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (id) do nothing;

-- Trả về: ngày hôm nay (giờ Việt Nam), email quản lý, và
--  - các bước chưa xong có hạn đến hết (hôm nay + so_ngay_toi), kèm email người làm;
--  - mọi bước đang chờ duyệt, kèm email người duyệt.
create or replace function public.ds_nhac_viec(ma text, so_ngay_toi integer default 3)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  hom_nay date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if ma is null or not exists (select 1 from public.cau_hinh_nhac where ma_bi_mat = ma) then
    raise exception 'Sai mã bí mật';
  end if;
  so_ngay_toi := least(greatest(coalesce(so_ngay_toi, 3), 0), 30);
  return jsonb_build_object(
    'ngay', hom_nay,
    'quan_ly', coalesce((select jsonb_agg(jsonb_build_object('email', email, 'ho_ten', ho_ten) order by email)
                         from public.thanh_vien where vai_tro = 'quan_ly'), '[]'::jsonb),
    'viec', coalesce((
      select jsonb_agg(jsonb_build_object(
               'hoat_dong_id', h.id, 'hoat_dong', h.ten, 'buoc', b.ten, 'thu_tu', b.thu_tu,
               'nguoi_lam', b.nguoi_lam, 'nguoi_duyet', b.nguoi_duyet, 'ngay_nop', b.ngay_nop,
               'email', tv.email, 'ho_ten', tv.ho_ten,
               'han', b.han, 'trang_thai', b.trang_thai, 'so_ngay_tre', hom_nay - b.han)
             order by b.han, h.ten, b.thu_tu)
      from public.buoc_cong_viec b
      join public.hoat_dong h on h.id = b.hoat_dong_id
      left join lateral (
        select t.email, t.ho_ten from public.thanh_vien t
        where t.vai_tro in ('quan_ly', 'thanh_vien')
          and public.khoa_ten(t.ho_ten) = public.khoa_ten(case when b.trang_thai = 'cho_duyet' then b.nguoi_duyet else b.nguoi_lam end)
          and public.khoa_ten(case when b.trang_thai = 'cho_duyet' then b.nguoi_duyet else b.nguoi_lam end) <> ''
        order by t.email limit 1
      ) tv on true
      where (b.trang_thai in ('chua_lam', 'dang_lam') and b.han is not null and b.han <= hom_nay + so_ngay_toi)
         or b.trang_thai = 'cho_duyet'          -- việc chờ duyệt: nhắc người duyệt, không phụ thuộc hạn
    ), '[]'::jsonb)
  );
end $$;
revoke all on function public.ds_nhac_viec(text, integer) from public;
grant execute on function public.ds_nhac_viec(text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 12. LỊCH POST (CTKM theo siêu thị) – đồng bộ từ Google Sheet kế hoạch
--     Script Google (nhac-han-email/dong-bo-lich-post.gs) đọc sheet rồi gọi
--     dong_bo_lich_post(ma, nguon, du_lieu): thay toàn bộ lịch bằng bản mới nhất.
--     Sửa lịch thì sửa trên Google Sheet, không sửa trong app.
-- ---------------------------------------------------------------------
create table if not exists public.lich_post (
  id             bigint generated always as identity primary key,
  nhom           text not null default '',
  chuoi          text not null default '',
  sieu_thi       text not null default '',
  nhan_hang      text not null default '',
  loai           text not null default '' check (loai in ('', 'onpost', 'offpost')),
  noi_dung       text not null default '',
  ngay_bat_dau   date not null,
  ngay_ket_thuc  date not null,
  dong           integer,          -- vị trí trong sheet, để tìm lại
  cot            integer,
  constraint lich_post_ngay_hop_le check (ngay_ket_thuc >= ngay_bat_dau)
);
create index if not exists lich_post_ngay_idx on public.lich_post (ngay_bat_dau);

create table if not exists public.dong_bo_lich (
  id      smallint primary key default 1 check (id = 1),
  nguon   text not null default '',
  so_dong integer not null default 0,
  luc     timestamptz not null default now()
);

alter table public.lich_post    enable row level security;
alter table public.dong_bo_lich enable row level security;
grant select on public.lich_post, public.dong_bo_lich to authenticated;
drop policy if exists "thanh_vien_xem" on public.lich_post;
create policy "thanh_vien_xem" on public.lich_post for select to authenticated using (public.duoc_xem());
drop policy if exists "thanh_vien_xem" on public.dong_bo_lich;
create policy "thanh_vien_xem" on public.dong_bo_lich for select to authenticated using (public.duoc_xem());
-- Không có quyền thêm/sửa/xóa trực tiếp: chỉ ghi qua hàm đồng bộ bên dưới

create or replace function public.dong_bo_lich_post(ma text, nguon text, du_lieu jsonb)
returns integer
language plpgsql volatile security definer set search_path = public as $$
declare
  so integer;
begin
  if ma is null or not exists (select 1 from public.cau_hinh_nhac where ma_bi_mat = ma) then
    raise exception 'Sai mã bí mật';
  end if;
  if jsonb_typeof(du_lieu) <> 'array' then raise exception 'Dữ liệu phải là danh sách'; end if;
  if jsonb_array_length(du_lieu) > 20000 then raise exception 'Quá nhiều dòng (tối đa 20000)'; end if;
  delete from public.lich_post where true;
  insert into public.lich_post (nhom, chuoi, sieu_thi, nhan_hang, loai, noi_dung, ngay_bat_dau, ngay_ket_thuc, dong, cot)
  select left(coalesce(x.nhom, ''), 200), left(coalesce(x.chuoi, ''), 200), left(coalesce(x.sieu_thi, ''), 200),
         left(coalesce(x.nhan_hang, ''), 200),
         case when x.loai in ('onpost', 'offpost') then x.loai else '' end,
         left(coalesce(x.noi_dung, ''), 4000), x.ngay_bat_dau, x.ngay_ket_thuc, x.dong, x.cot
  from jsonb_to_recordset(du_lieu) as x(nhom text, chuoi text, sieu_thi text, nhan_hang text, loai text,
                                         noi_dung text, ngay_bat_dau date, ngay_ket_thuc date, dong integer, cot integer)
  where x.ngay_bat_dau is not null and x.ngay_ket_thuc is not null and x.ngay_ket_thuc >= x.ngay_bat_dau;
  get diagnostics so = row_count;
  insert into public.dong_bo_lich (id, nguon, so_dong, luc) values (1, left(coalesce(nguon, ''), 300), so, now())
  on conflict (id) do update set nguon = excluded.nguon, so_dong = excluded.so_dong, luc = excluded.luc;
  return so;
end $$;
revoke all on function public.dong_bo_lich_post(text, text, jsonb) from public;
grant execute on function public.dong_bo_lich_post(text, text, jsonb) to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lich_post') then
    execute 'alter publication supabase_realtime add table public.lich_post';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 13. SỐ LIỆU KÊNH MT: SELL-IN, BÁN RA, BẢNG GIÁ – tự nạp từ thư mục Drive và Google Sheet
--     Script Google (nhac-han-email/dong-bo-du-lieu.gs) đọc mỗi giờ:
--       - thư mục Drive "DATA TRADE MT": file Sổ chi tiết bán hàng, file Co.op bán ra – tồn
--       - Google Sheet "[EMART] SELL OUT THÁNG" và "Bảng Giá Siêu Thị"
--     rồi gọi hàm nap_nguon(ma, ...) (cần mã bí mật như lịch post). App chỉ đọc.
--     Số gốc nằm ở các bảng nguon_*; app đọc các bảng tự tính (view) bên dưới.
-- ---------------------------------------------------------------------
-- Bỏ bảng chép tay của bản trước (số được nạp lại từ nguồn gốc)
drop function if exists public.dong_bo_so_ban(text, text, text, boolean, jsonb, text, text, text);
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'sell_out') then drop table public.sell_out cascade; end if;
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'sell_in') then drop table public.sell_in cascade; end if;
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'dong_bo_so_ban') then drop table public.dong_bo_so_ban cascade; end if;
end $$;

-- Sổ chi tiết bán hàng, gộp theo ngày chứng từ × hệ thống × mã hàng (giống dashboard)
create table if not exists public.nguon_sellin (
  id bigint generated always as identity primary key,
  ngay date not null, thang text not null default '', he_thong text not null default '', brand text not null default '',
  ma_hang text not null default '', ten_hang text not null default '', dvt text not null default '',
  sl_ban numeric not null default 0, sl_tra numeric not null default 0, sl_doi numeric not null default 0,
  doanh_so numeric not null default 0, chiet_khau numeric not null default 0, tra_lai numeric not null default 0,
  tep text not null default ''
);
create index if not exists nguon_sellin_ngay_idx on public.nguon_sellin (ngay);
-- Mỗi chứng từ bán: để đếm số đơn và số điểm nhận hàng
create table if not exists public.nguon_don_hang (
  id bigint generated always as identity primary key,
  ngay date not null, thang text not null default '', he_thong text not null default '',
  diem_nhan text not null default '', so_chung_tu text not null default '', tep text not null default ''
);
create index if not exists nguon_don_hang_ngay_idx on public.nguon_don_hang (ngay);
-- Sell-in theo từng điểm nhận hàng (cửa hàng) của Lotte và GO (giao thẳng từng cửa hàng): để so với kiểm tồn của CTV ở đúng cửa hàng đó
create table if not exists public.nguon_sellin_ch (
  id bigint generated always as identity primary key,
  ngay date not null, he_thong text not null default '', diem_nhan text not null default '', brand text not null default '',
  ma_hang text not null default '', ten_hang text not null default '',
  sl_ban numeric not null default 0, sl_tra numeric not null default 0, doanh_so numeric not null default 0, tep text not null default ''
);
create index if not exists nguon_sellin_ch_ngay_idx on public.nguon_sellin_ch (ngay);
alter table public.nguon_sellin_ch add column if not exists chiet_khau numeric not null default 0;
alter table public.nguon_sellin_ch add column if not exists tra_lai numeric not null default 0;
-- Co.op: kỳ × SKU Co.op × mã cửa hàng (bỏ dòng toàn số 0)
create table if not exists public.nguon_coop_ban (
  id bigint generated always as identity primary key,
  ky text not null, tu_ngay date not null, den_ngay date not null, sku text not null, ch text not null,
  sl_ban numeric not null default 0, gt_ban numeric not null default 0, sl_ton numeric not null default 0, gt_ton numeric not null default 0,
  tep text not null default ''
);
create index if not exists nguon_coop_ban_ky_idx on public.nguon_coop_ban (ky);
create table if not exists public.nguon_coop_ch (
  ma_ch text primary key, ten_ch text not null default '', ky_ten text not null default '', loai_ch text not null default '', vung text not null default ''
);
create table if not exists public.nguon_coop_sku (
  ma_sku_coop text primary key, ten_hang_coop text not null default ''
);
-- Emart: tuần trong tháng (từ tab SELL OUT theo ngày) hoặc kỳ (tab T10, T11…) × điểm bán × sản phẩm
create table if not exists public.nguon_emart (
  id bigint generated always as identity primary key,
  tuan text not null, tu date not null, den date not null, so_ngay integer not null default 0, nguon text not null default '',
  diem_ban text not null default '', brand text not null default '', san_pham_goc text not null default '',
  sl numeric not null default 0, doanh_so numeric not null default 0, ctkm text not null default ''
);
-- Danh mục sản phẩm: tên gốc ở từng nguồn -> tên ngắn thống nhất (để so sánh giữa các hệ thống)
--   nguon = 'coop_sku' (ten_goc = mã SKU Co.op) | 'emart' | 'gia:<hệ thống>'; ten_goc lưu dạng khoa_ten()
create table if not exists public.danh_muc_san_pham (
  nguon text not null, ten_goc text not null, san_pham text not null, brand text not null default '',
  ma_hang_tvp text not null default '', ten_hang_tvp text not null default '',
  primary key (nguon, ten_goc)
);
-- Bộ số đã tính sẵn (baseline bán trơn, kiểm tồn CTV…): lưu nguyên dạng như dashboard, mỗi bộ 1 dòng
create table if not exists public.bo_so_tinh_san (
  bo_so text primary key,                       -- 'baseline' | 'baseline_wil' | 'kiem_ton_ctv'
  du_lieu jsonb not null default '[]'::jsonb,   -- mảng các dòng
  so_dong integer not null default 0, ten text not null default '', mo_ta text not null default '',
  nguon_cap_nhat text not null default '', luc timestamptz not null default now()
);
-- Nhật ký nạp: mỗi file / sheet đã đọc
create table if not exists public.nhat_ky_nap (
  id bigint generated always as identity primary key,
  nguon text not null, tep text not null default '', ten_tep text not null default '', tu date, den date,
  so_dong integer not null default 0, loi text not null default '', luc timestamptz not null default now()
);
-- Trạng thái từng nguồn (app hiện ở trang Số bán)
create table if not exists public.trang_thai_nguon (
  nguon text primary key, ten text not null default '', mo_ta text not null default '', so_dong integer not null default 0,
  nguon_cap_nhat text not null default '', luc timestamptz not null default now()
);

do $$
declare bang text;
begin
  foreach bang in array array['nguon_sellin','nguon_sellin_ch','nguon_don_hang','nguon_coop_ban','nguon_coop_ch','nguon_coop_sku','nguon_emart','danh_muc_san_pham','nhat_ky_nap','trang_thai_nguon','bo_so_tinh_san'] loop
    execute format('alter table public.%I enable row level security', bang);
    execute format('grant select on public.%I to authenticated', bang);
    execute format('drop policy if exists "thanh_vien_xem" on public.%I', bang);
    execute format('create policy "thanh_vien_xem" on public.%I for select to authenticated using (public.duoc_xem())', bang);
  end loop;
  -- danh mục sản phẩm: quản lý được sửa trực tiếp (thêm tên mới)
  drop policy if exists "quan_ly_sua" on public.danh_muc_san_pham;
  create policy "quan_ly_sua" on public.danh_muc_san_pham for all to authenticated using (public.la_quan_ly()) with check (public.la_quan_ly());
  grant insert, update, delete on public.danh_muc_san_pham to authenticated;
end $$;

-- Bảng giá siêu thị. Có giá vốn, lãi gộp: CHỈ thành viên và quản lý xem được bảng này.
-- Khách xem qua view gia_ban_cong_khai (chỉ giá bán lẻ, mức giảm, trading term, ghi chú không nói về lãi/lỗ).
create table if not exists public.gia_ban (
  id                 bigint generated always as identity primary key,
  he_thong           text not null default '',   -- tên theo bảng giá
  chuoi              text not null default '',   -- tên hệ thống trong app
  nhan_hang          text not null default '',
  san_pham           text not null default '',
  ten_bang_gia       text not null default '',
  gia_mua            numeric,                    -- giá TVP bán cho siêu thị, chưa VAT
  giam               numeric,                    -- mức đang giảm cho siêu thị (0,1 = 10%)
  trading_term       numeric,
  tvp_nhan           numeric,                    -- TVP thu về
  gia_von            numeric,
  ln_tvp             numeric,                    -- lãi gộp TVP
  ty_le_ln           numeric,
  gia_le             numeric,                    -- giá bán lẻ tại quầy (gồm VAT)
  le_tren_mua        numeric,
  ghi_chu            text not null default '',
  ghi_chu_cong_khai  text not null default ''    -- phần ghi chú khách được xem
);
alter table public.gia_ban enable row level security;
grant select on public.gia_ban to authenticated;
drop policy if exists "thanh_vien_xem" on public.gia_ban;
create policy "thanh_vien_xem" on public.gia_ban for select to authenticated using (public.la_thanh_vien());

-- View này chạy bằng quyền chủ view nên tự lọc: chỉ người có trong danh sách mới thấy, và chỉ các cột công khai
create or replace view public.gia_ban_cong_khai as
select id, he_thong, chuoi, nhan_hang, san_pham, giam, trading_term, gia_le, ghi_chu_cong_khai as ghi_chu
from public.gia_ban
where public.duoc_xem();
revoke all on public.gia_ban_cong_khai from anon;
grant select on public.gia_ban_cong_khai to authenticated;

-- Hệ thống theo sổ bán hàng -> hệ thống trong app
create or replace function public.chuoi_app(he_thong text) returns text language sql immutable as $$
  select case he_thong
    when 'Co.opMart' then 'Co.op' when 'Co.op Food' then 'Co.op' when 'Co.op Finelife' then 'Co.op' when 'Co.op Xtra' then 'Co.op' when 'Co.op' then 'Co.op'
    when 'Emart' then 'Emart' when 'Lotte Mart' then 'Lotte' when 'GO! / Big C' then 'GO/BigC' when 'Bách Hóa Xanh' then 'BHX'
    when 'WinMart / WinMart+' then 'WinMart/WinMart+' when 'King Food Market' then 'King Food' else '' end;
$$;
-- Nhãn kỳ: trọn tháng ghi "T11/2026", kỳ lẻ ghi "01/11–15/11/2026"
create or replace function public.ten_ky(tu date, den date) returns text language sql immutable as $$
  select case when extract(day from tu) = 1 and den = (date_trunc('month', tu) + interval '1 month - 1 day')::date
              then 'T' || extract(month from tu)::int || '/' || extract(year from tu)::int
              else to_char(tu, 'DD/MM') || '–' || to_char(den, 'DD/MM/YYYY') end;
$$;

-- ===== Các bảng tự tính app đọc (giữ đúng tên, cột như bản trước) =====
create or replace view public.sell_in with (security_invoker = true) as
select id, ngay, he_thong, public.chuoi_app(he_thong) as chuoi,
       case when brand = 'Không theo brand' then '' else brand end as nhan_hang,
       ma_hang, ten_hang, sl_ban as so_luong, sl_tra as tra_lai_sl, doanh_so, chiet_khau, tra_lai
from public.nguon_sellin;

create or replace view public.sell_out with (security_invoker = true) as
select 'coop'::text as nguon, 'Co.op'::text as chuoi, public.ten_ky(b.tu_ngay, b.den_ngay) as ky, b.tu_ngay, b.den_ngay,
       b.ch as ma_cua_hang, coalesce(c.ten_ch, b.ch) as cua_hang, coalesce(c.loai_ch, '') as loai_cua_hang,
       coalesce(d.brand, '') as nhan_hang, b.sku as ma_sku, coalesce(d.san_pham, s.ten_hang_coop, b.sku) as ten_sku,
       b.sl_ban as so_luong, b.gt_ban as doanh_so, b.sl_ton as ton, b.gt_ton as gia_tri_ton
from public.nguon_coop_ban b
left join public.nguon_coop_ch c on c.ma_ch = b.ch
left join public.nguon_coop_sku s on s.ma_sku_coop = b.sku
left join public.danh_muc_san_pham d on d.nguon = 'coop_sku' and d.ten_goc = b.sku
union all
select 'emart', 'Emart', e.tuan, e.tu, e.den, '', e.diem_ban, '', e.brand,
       coalesce(d.san_pham, e.san_pham_goc), coalesce(d.san_pham, e.san_pham_goc), e.sl, e.doanh_so, null, null
from public.nguon_emart e
left join public.danh_muc_san_pham d on d.nguon = 'emart' and d.ten_goc = public.khoa_ten(e.san_pham_goc);

create or replace view public.sell_out_ky_sku with (security_invoker = true) as
select chuoi, nhan_hang, ky, tu_ngay, den_ngay, ma_sku, max(ten_sku) as ten_sku,
       sum(so_luong) as so_luong, sum(doanh_so) as doanh_so, sum(ton) as ton,
       count(distinct ma_cua_hang || '|' || cua_hang) filter (where so_luong > 0) as so_cua_hang_ban
from public.sell_out group by chuoi, nhan_hang, ky, tu_ngay, den_ngay, ma_sku;

create or replace view public.sell_out_ky_nhan with (security_invoker = true) as
select chuoi, nhan_hang, ky, tu_ngay, den_ngay,
       sum(so_luong) as so_luong, sum(doanh_so) as doanh_so, sum(ton) as ton,
       count(distinct ma_cua_hang || '|' || cua_hang) filter (where so_luong > 0) as so_cua_hang_ban,
       count(distinct ma_sku) filter (where so_luong > 0) as so_sku_ban
from public.sell_out group by chuoi, nhan_hang, ky, tu_ngay, den_ngay;

create or replace view public.sell_in_ngay with (security_invoker = true) as
-- doanh_so: đã trừ giá trị hàng trả lại (chưa trừ chiết khấu)
select chuoi, nhan_hang, ngay, sum(so_luong) as so_luong, sum(tra_lai_sl) as tra_lai_sl, sum(doanh_so - tra_lai) as doanh_so
from public.sell_in group by chuoi, nhan_hang, ngay;

-- Sell-in theo cửa hàng (Lotte, GO), gộp theo ngày × điểm nhận × nhãn
create or replace view public.sell_in_cua_hang with (security_invoker = true) as
select public.chuoi_app(he_thong) as chuoi, diem_nhan, case when brand = 'Không theo brand' then '' else brand end as nhan_hang, ngay,
       sum(sl_ban) as so_luong, sum(sl_tra) as tra_lai_sl, sum(doanh_so - tra_lai) as doanh_so   -- đã trừ hàng trả lại
from public.nguon_sellin_ch group by 1, 2, 3, 4;

create or replace view public.dong_bo_so_ban with (security_invoker = true) as
select nguon, ten, mo_ta, so_dong, nguon_cap_nhat, luc from public.trang_thai_nguon;

-- Dạng giống các bộ số của dashboard (cho các trang Sell-in / Sell-out / Giá dựng lại trên app)
create or replace view public.ds_coop_sku with (security_invoker = true) as
select s.ma_sku_coop, s.ten_hang_coop, coalesce(d.ma_hang_tvp, '') as ma_hang_tvp, coalesce(d.ten_hang_tvp, '') as ten_hang_tvp,
       coalesce(d.brand, '') as brand, coalesce(d.san_pham, s.ten_hang_coop) as san_pham
from public.nguon_coop_sku s left join public.danh_muc_san_pham d on d.nguon = 'coop_sku' and d.ten_goc = s.ma_sku_coop;
create or replace view public.ds_emart_tuan with (security_invoker = true) as
select e.tuan, e.tu, e.den, e.so_ngay, e.nguon, e.diem_ban, e.brand, coalesce(d.san_pham, e.san_pham_goc) as san_pham, e.sl, e.doanh_so, e.ctkm
from public.nguon_emart e left join public.danh_muc_san_pham d on d.nguon = 'emart' and d.ten_goc = public.khoa_ten(e.san_pham_goc);
-- Tên gốc chưa có trong danh mục (app hiện để quản lý bổ sung)
create or replace view public.ten_chua_co_danh_muc with (security_invoker = true) as
select 'coop_sku'::text as nguon, s.ma_sku_coop as ten_goc, s.ten_hang_coop as mo_ta from public.nguon_coop_sku s
  where not exists (select 1 from public.danh_muc_san_pham d where d.nguon = 'coop_sku' and d.ten_goc = s.ma_sku_coop)
union
select 'emart', e.san_pham_goc, e.brand from public.nguon_emart e
  where not exists (select 1 from public.danh_muc_san_pham d where d.nguon = 'emart' and d.ten_goc = public.khoa_ten(e.san_pham_goc))
union
select 'gia:' || g.he_thong, g.ten_bang_gia, g.nhan_hang from public.gia_ban g
  where not exists (select 1 from public.danh_muc_san_pham d where d.nguon = 'gia:' || g.he_thong and d.ten_goc = public.khoa_ten(g.ten_bang_gia));
grant select on public.sell_in, public.sell_out, public.sell_out_ky_sku, public.sell_out_ky_nhan, public.sell_in_ngay, public.sell_in_cua_hang,
  public.dong_bo_so_ban, public.ds_coop_sku, public.ds_emart_tuan, public.ten_chua_co_danh_muc to authenticated;


-- ===== Nạp số từ script Google =====
-- loai: 'sellin' | 'don_hang' (xóa số cũ trong khoảng tu–den rồi thêm)
--       'coop_ban' (xóa số cũ cùng kỳ rồi thêm) | 'coop_ch' | 'coop_sku' (thêm hoặc cập nhật)
--       'emart' | 'gia_ban' (lam_moi = true ở lượt đầu: xóa hết rồi thêm)
--       'danh_muc' (thêm tên ngắn cho tên gốc chưa có; không ghi đè)
--       'bo_so' (thay nguyên 1 bộ số đã tính sẵn; thong_tin.bo_so = tên bộ)
-- thong_tin: {tep, ten_tep, tu, den, ky, lam_moi, ten, mo_ta, nguon_cap_nhat, loi}
create or replace function public.nap_nguon(ma text, loai text, du_lieu jsonb, thong_tin jsonb default '{}'::jsonb)
returns integer
language plpgsql volatile security definer set search_path = public as $$
declare
  so integer := 0;
  tu date := nullif(thong_tin->>'tu', '')::date;
  den date := nullif(thong_tin->>'den', '')::date;
  lam_moi boolean := coalesce((thong_tin->>'lam_moi')::boolean, false);
  tep text := coalesce(thong_tin->>'tep', '');
begin
  if ma is null or not exists (select 1 from public.cau_hinh_nhac where ma_bi_mat = ma) then
    raise exception 'Sai mã bí mật';
  end if;
  if jsonb_typeof(du_lieu) <> 'array' or jsonb_array_length(du_lieu) > 20000 then
    raise exception 'Dữ liệu phải là danh sách, tối đa 20000 dòng mỗi lần';
  end if;

  if loai = 'sellin' then
    if lam_moi then delete from public.nguon_sellin where ngay between tu and den; end if;
    insert into public.nguon_sellin (ngay, thang, he_thong, brand, ma_hang, ten_hang, dvt, sl_ban, sl_tra, sl_doi, doanh_so, chiet_khau, tra_lai, tep)
    select x.ngay, coalesce(x.thang, to_char(x.ngay, 'YYYY-MM')), coalesce(x.he_thong, ''), coalesce(x.brand, ''), coalesce(x.ma_hang, ''),
           coalesce(x.ten_hang, ''), coalesce(x.dvt, ''), coalesce(x.sl_ban, 0), coalesce(x.sl_tra, 0), coalesce(x.sl_doi, 0),
           coalesce(x.doanh_so, 0), coalesce(x.chiet_khau, 0), coalesce(x.tra_lai, 0), tep
    from jsonb_to_recordset(du_lieu) as x(ngay date, thang text, he_thong text, brand text, ma_hang text, ten_hang text, dvt text,
         sl_ban numeric, sl_tra numeric, sl_doi numeric, doanh_so numeric, chiet_khau numeric, tra_lai numeric)
    where x.ngay is not null;
  elsif loai = 'sellin_ch' then
    if lam_moi then delete from public.nguon_sellin_ch where ngay between tu and den; end if;
    insert into public.nguon_sellin_ch (ngay, he_thong, diem_nhan, brand, ma_hang, ten_hang, sl_ban, sl_tra, doanh_so, chiet_khau, tra_lai, tep)
    select x.ngay, coalesce(x.he_thong, ''), coalesce(x.diem_nhan, ''), coalesce(x.brand, ''), coalesce(x.ma_hang, ''), coalesce(x.ten_hang, ''),
           coalesce(x.sl_ban, 0), coalesce(x.sl_tra, 0), coalesce(x.doanh_so, 0), coalesce(x.chiet_khau, 0), coalesce(x.tra_lai, 0), tep
    from jsonb_to_recordset(du_lieu) as x(ngay date, he_thong text, diem_nhan text, brand text, ma_hang text, ten_hang text, sl_ban numeric, sl_tra numeric, doanh_so numeric, chiet_khau numeric, tra_lai numeric)
    where x.ngay is not null;
  elsif loai = 'don_hang' then
    if lam_moi then delete from public.nguon_don_hang where ngay between tu and den; end if;
    insert into public.nguon_don_hang (ngay, thang, he_thong, diem_nhan, so_chung_tu, tep)
    select x.ngay, coalesce(x.thang, to_char(x.ngay, 'YYYY-MM')), coalesce(x.he_thong, ''), coalesce(x.diem_nhan, ''), coalesce(x.so_chung_tu, ''), tep
    from jsonb_to_recordset(du_lieu) as x(ngay date, thang text, he_thong text, diem_nhan text, so_chung_tu text)
    where x.ngay is not null;
  elsif loai = 'coop_ban' then
    if lam_moi then delete from public.nguon_coop_ban where ky = thong_tin->>'ky'; end if;
    insert into public.nguon_coop_ban (ky, tu_ngay, den_ngay, sku, ch, sl_ban, gt_ban, sl_ton, gt_ton, tep)
    select x.ky, split_part(x.ky, '_', 1)::date, split_part(x.ky, '_', 2)::date, x.sku, x.ch,
           coalesce(x.sl_ban, 0), coalesce(x.gt_ban, 0), coalesce(x.sl_ton, 0), coalesce(x.gt_ton, 0), tep
    from jsonb_to_recordset(du_lieu) as x(ky text, sku text, ch text, sl_ban numeric, gt_ban numeric, sl_ton numeric, gt_ton numeric)
    where x.ky like '____-__-__\_____-__-__' and x.sku is not null and x.ch is not null;
  elsif loai = 'coop_ch' then
    insert into public.nguon_coop_ch as c (ma_ch, ten_ch, ky_ten, loai_ch, vung)
    select x.ma_ch, coalesce(x.ten_ch, ''), coalesce(x.ky_ten, ''), coalesce(x.loai_ch, ''), coalesce(x.vung, '')
    from jsonb_to_recordset(du_lieu) as x(ma_ch text, ten_ch text, ky_ten text, loai_ch text, vung text) where x.ma_ch is not null
    on conflict (ma_ch) do update set ten_ch = excluded.ten_ch, ky_ten = excluded.ky_ten, loai_ch = excluded.loai_ch, vung = excluded.vung
      where excluded.ky_ten >= c.ky_ten;                                  -- giữ tên theo file mới nhất
  elsif loai = 'coop_sku' then
    insert into public.nguon_coop_sku as s (ma_sku_coop, ten_hang_coop)
    select x.ma_sku_coop, coalesce(x.ten_hang_coop, '') from jsonb_to_recordset(du_lieu) as x(ma_sku_coop text, ten_hang_coop text) where x.ma_sku_coop is not null
    on conflict (ma_sku_coop) do update set ten_hang_coop = excluded.ten_hang_coop;
  elsif loai = 'emart' then
    if lam_moi then delete from public.nguon_emart where true; end if;
    insert into public.nguon_emart (tuan, tu, den, so_ngay, nguon, diem_ban, brand, san_pham_goc, sl, doanh_so, ctkm)
    select x.tuan, x.tu, x.den, coalesce(x.so_ngay, (x.den - x.tu) + 1), coalesce(x.nguon, ''), coalesce(x.diem_ban, ''), coalesce(x.brand, ''),
           coalesce(x.san_pham, ''), coalesce(x.sl, 0), coalesce(x.doanh_so, 0), coalesce(x.ctkm, '')
    from jsonb_to_recordset(du_lieu) as x(tuan text, tu date, den date, so_ngay integer, nguon text, diem_ban text, brand text, san_pham text,
         sl numeric, doanh_so numeric, ctkm text)
    where x.tuan is not null and x.tu is not null and x.den >= x.tu;
  elsif loai = 'gia_ban' then
    if lam_moi then delete from public.gia_ban where true; end if;
    insert into public.gia_ban (he_thong, chuoi, nhan_hang, san_pham, ten_bang_gia, gia_mua, giam, trading_term, tvp_nhan,
                                gia_von, ln_tvp, ty_le_ln, gia_le, le_tren_mua, ghi_chu, ghi_chu_cong_khai)
    select coalesce(x.he_thong, ''), public.chuoi_app(x.he_thong), coalesce(x.brand, ''),
           coalesce(d.san_pham, x.ten_bang_gia, ''), coalesce(x.ten_bang_gia, ''),
           x.gia_mua, x.giam, x.trading_term, x.tvp_nhan, x.gia_von, x.ln_tvp, x.ty_le_ln, x.gia_le, x.le_tren_mua,
           coalesce(x.ghi_chu, ''),
           array_to_string(array(select p from unnest(string_to_array(coalesce(x.ghi_chu, ''), '; ')) as p
                                 where p <> '' and p !~* '(lỗ|lãi|vốn|thu về|trading|mua)'), '; ')
    from jsonb_to_recordset(du_lieu) as x(he_thong text, brand text, ten_bang_gia text, gia_mua numeric, giam numeric, trading_term numeric,
         tvp_nhan numeric, gia_von numeric, ln_tvp numeric, ty_le_ln numeric, gia_le numeric, le_tren_mua numeric, ghi_chu text)
    left join public.danh_muc_san_pham d on d.nguon = 'gia:' || x.he_thong and d.ten_goc = public.khoa_ten(x.ten_bang_gia);
  elsif loai = 'danh_muc' then
    insert into public.danh_muc_san_pham (nguon, ten_goc, san_pham, brand, ma_hang_tvp, ten_hang_tvp)
    select x.nguon, case when x.nguon = 'coop_sku' then x.ten_goc else public.khoa_ten(x.ten_goc) end, x.san_pham,
           coalesce(x.brand, ''), coalesce(x.ma_hang_tvp, ''), coalesce(x.ten_hang_tvp, '')
    from jsonb_to_recordset(du_lieu) as x(nguon text, ten_goc text, san_pham text, brand text, ma_hang_tvp text, ten_hang_tvp text)
    where x.nguon is not null and x.ten_goc is not null and x.san_pham is not null
    on conflict (nguon, ten_goc) do nothing;
  elsif loai = 'bo_so' then
    if coalesce(thong_tin->>'bo_so', '') !~ '^[a-z_]{2,40}$' then raise exception 'Thiếu tên bộ số'; end if;
    insert into public.bo_so_tinh_san as b (bo_so, du_lieu, so_dong, ten, mo_ta, nguon_cap_nhat, luc)
    values (thong_tin->>'bo_so', du_lieu, jsonb_array_length(du_lieu), coalesce(thong_tin->>'ten', ''), coalesce(thong_tin->>'mo_ta', ''),
            coalesce(thong_tin->>'nguon_cap_nhat', ''), now())
    on conflict (bo_so) do update set du_lieu = excluded.du_lieu, so_dong = excluded.so_dong,
      ten = case when excluded.ten <> '' then excluded.ten else b.ten end, mo_ta = case when excluded.mo_ta <> '' then excluded.mo_ta else b.mo_ta end,
      nguon_cap_nhat = excluded.nguon_cap_nhat, luc = excluded.luc;
  else
    raise exception 'Loại không hợp lệ: %', loai;
  end if;
  get diagnostics so = row_count;
  if loai = 'bo_so' then so := jsonb_array_length(du_lieu); end if;

  -- Trạng thái nguồn (để app hiện): lấy tổng số dòng hiện có
  if loai in ('sellin', 'coop_ban', 'emart', 'gia_ban') then
    insert into public.trang_thai_nguon (nguon, ten, mo_ta, so_dong, nguon_cap_nhat, luc)
    values (case loai when 'sellin' then 'sellin' when 'coop_ban' then 'coop' else loai end,
            coalesce(thong_tin->>'ten', ''), coalesce(thong_tin->>'mo_ta', ''),
            case loai when 'sellin' then (select count(*) from public.nguon_sellin) when 'coop_ban' then (select count(*) from public.nguon_coop_ban)
                      when 'emart' then (select count(*) from public.nguon_emart) else (select count(*) from public.gia_ban) end,
            coalesce(thong_tin->>'nguon_cap_nhat', ''), now())
    on conflict (nguon) do update set
      ten = case when excluded.ten <> '' then excluded.ten else trang_thai_nguon.ten end,
      mo_ta = case when excluded.mo_ta <> '' then excluded.mo_ta else trang_thai_nguon.mo_ta end,
      so_dong = excluded.so_dong,
      nguon_cap_nhat = case when excluded.nguon_cap_nhat <> '' then excluded.nguon_cap_nhat else trang_thai_nguon.nguon_cap_nhat end,
      luc = excluded.luc;
  end if;
  if tep <> '' or coalesce(thong_tin->>'loi', '') <> '' then
    insert into public.nhat_ky_nap (nguon, tep, ten_tep, tu, den, so_dong, loi)
    values (loai, tep, coalesce(thong_tin->>'ten_tep', ''), tu, den, so, coalesce(thong_tin->>'loi', ''));
  end if;
  return so;
end $$;
revoke all on function public.nap_nguon(text, text, jsonb, jsonb) from public;
grant execute on function public.nap_nguon(text, text, jsonb, jsonb) to anon, authenticated;

-- Script hỏi: file nào đã nạp rồi (để không đọc lại file cũ chưa đổi)
create or replace function public.tep_da_nap(ma text)
returns table (tep text, luc timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if ma is null or not exists (select 1 from public.cau_hinh_nhac where ma_bi_mat = ma) then raise exception 'Sai mã bí mật'; end if;
  return query select n.tep, max(n.luc) from public.nhat_ky_nap n where n.tep <> '' and n.loi = '' group by n.tep;
end $$;
revoke all on function public.tep_da_nap(text) from public;
grant execute on function public.tep_da_nap(text) to anon, authenticated;

-- Xong. Kiểm tra: select ten from public.quy_trinh order by thu_tu;
