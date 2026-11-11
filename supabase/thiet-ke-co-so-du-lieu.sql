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
  ('Nhiều hệ thống', 9), ('Nội bộ', 10)
on conflict (ten) do nothing;

-- Quy trình mẫu (chỉ thêm nếu chưa có mã đó)
with mau(ma, ten, mo_ta, thu_tu) as (values
  ('ctkm-catalogue', 'CTKM catalogue siêu thị (MT)', 'Đăng ký và chạy chương trình giảm giá trên catalogue của chuỗi siêu thị', 1),
  ('activation',     'Activation / Inline tại siêu thị', 'Dùng thử, PG bán hàng, hoạt động tại điểm bán', 2),
  ('trung-bay',      'Trưng bày / thuê vị trí', 'Ụ, đầu kệ, quầy kệ riêng tại siêu thị hoặc cửa hàng', 3),
  ('audit',          'Audit điểm bán định kỳ', 'Kiểm tra tồn, giá, trưng bày, đối thủ tại điểm bán', 4),
  ('posm',           'Sản xuất và phân bổ POSM', 'Vật phẩm quảng cáo tại điểm bán', 5),
  ('bao-cao-thang',  'Báo cáo tháng kênh MT', 'Ngày bắt đầu/kết thúc = đầu và cuối tháng báo cáo', 6)
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
  ('ctkm-catalogue',1,'Nhận lịch catalogue và hạn chót đăng ký từ siêu thị','Sales MT','bat_dau',-60,'Lịch catalogue'),
  ('ctkm-catalogue',2,'Chọn SKU, đề xuất mức giảm và tính chi phí','Trade MKT','bat_dau',-50,'File đề xuất có biên lợi nhuận'),
  ('ctkm-catalogue',3,'Trình duyệt nội bộ','Trưởng nhóm','bat_dau',-45,'Email/tin nhắn duyệt'),
  ('ctkm-catalogue',4,'Gửi đăng ký cho siêu thị','Sales MT','bat_dau',-40,'Form đăng ký đã gửi'),
  ('ctkm-catalogue',5,'Siêu thị xác nhận tham gia','Sales MT','bat_dau',-30,'Xác nhận hoặc bản in thử catalogue'),
  ('ctkm-catalogue',6,'Kiểm tra tồn kho, đặt hàng đủ cho đợt KM','Sales MT','bat_dau',-14,'Đơn đặt hàng'),
  ('ctkm-catalogue',7,'Kiểm tra giá KM và trưng bày tại điểm bán','Sale rep','bat_dau',2,'Ảnh kệ, ảnh bảng giá'),
  ('ctkm-catalogue',8,'Theo dõi bán ra giữa đợt','Trade MKT','bat_dau',7,'Số bán ra theo SKU'),
  ('ctkm-catalogue',9,'Đánh giá sau CTKM so với bán trơn','Trade MKT','ket_thuc',21,'Báo cáo đánh giá'),

  ('activation',1,'Chọn điểm bán và lên ý tưởng hoạt động','Trade MKT','bat_dau',-30,'Danh sách điểm, ý tưởng'),
  ('activation',2,'Lập ngân sách và chỉ số đo lường','Trade MKT','bat_dau',-25,'Bảng ngân sách, chỉ tiêu'),
  ('activation',3,'Trình duyệt','Trưởng nhóm','bat_dau',-21,'Duyệt đề xuất'),
  ('activation',4,'Xin phép siêu thị, đăng ký vị trí','Sales MT','bat_dau',-14,'Xác nhận của siêu thị'),
  ('activation',5,'Tuyển và đào tạo PG','Trade MKT','bat_dau',-7,'Danh sách PG, tài liệu đào tạo'),
  ('activation',6,'Chuẩn bị vật phẩm, hàng dùng thử, quà','Trade MKT','bat_dau',-5,'Biên bản giao nhận'),
  ('activation',7,'Triển khai và báo cáo hằng ngày','Sale rep','bat_dau',0,'Báo cáo ngày, ảnh'),
  ('activation',8,'Kiểm tra đột xuất tại điểm','Trade MKT','bat_dau',3,'Ảnh, ghi chú kiểm tra'),
  ('activation',9,'Tổng kết, so sánh bán ra với bán trơn trước đó','Trade MKT','ket_thuc',14,'Báo cáo tổng kết'),

  ('trung-bay',1,'Chọn điểm bán và vị trí','Trade MKT','bat_dau',-30,'Danh sách điểm, vị trí'),
  ('trung-bay',2,'Thương lượng phí và ký thỏa thuận','Sales MT','bat_dau',-21,'Thỏa thuận/hợp đồng'),
  ('trung-bay',3,'Trình duyệt','Trưởng nhóm','bat_dau',-18,'Duyệt chi phí'),
  ('trung-bay',4,'Sản xuất vật phẩm trưng bày','Trade MKT','bat_dau',-10,'Vật phẩm đã nhận'),
  ('trung-bay',5,'Lắp đặt và chụp ảnh nghiệm thu','Sale rep','bat_dau',0,'Ảnh nghiệm thu'),
  ('trung-bay',6,'Kiểm tra định kỳ','Sale rep','bat_dau',14,'Ảnh kiểm tra'),
  ('trung-bay',7,'Nghiệm thu và thanh toán','Trade MKT','ket_thuc',7,'Biên bản, hóa đơn'),
  ('trung-bay',8,'Đánh giá hiệu quả','Trade MKT','ket_thuc',14,'Báo cáo đánh giá'),

  ('audit',1,'Lên danh sách điểm và phân công','Trade MKT','bat_dau',-5,'Danh sách điểm theo người'),
  ('audit',2,'Gửi form audit cho sale rep','Trade MKT','bat_dau',-2,'Link form'),
  ('audit',3,'Sale rep thực hiện audit','Sale rep','ket_thuc',0,'Dữ liệu form đầy đủ'),
  ('audit',4,'Kiểm tra dữ liệu đủ và đúng','Trade MKT','ket_thuc',1,'Danh sách điểm thiếu'),
  ('audit',5,'Tổng hợp và báo cáo','Trade MKT','ket_thuc',3,'Báo cáo audit'),
  ('audit',6,'Giao việc khắc phục','Trưởng nhóm','ket_thuc',5,'Danh sách việc cần sửa'),

  ('posm',1,'Xác định nhu cầu và số lượng','Trade MKT','bat_dau',-30,'Bảng số lượng theo điểm'),
  ('posm',2,'Thiết kế','Trade MKT','bat_dau',-25,'File thiết kế'),
  ('posm',3,'Duyệt thiết kế','Trưởng nhóm','bat_dau',-20,'Bản đã duyệt'),
  ('posm',4,'Lấy báo giá và đặt in','Trade MKT','bat_dau',-18,'Báo giá, đơn đặt'),
  ('posm',5,'Nhận hàng và kiểm tra chất lượng','Trade MKT','bat_dau',-5,'Biên bản nhận hàng'),
  ('posm',6,'Phân bổ về điểm bán','Sales MT','bat_dau',-2,'Biên bản giao'),
  ('posm',7,'Kiểm tra lắp đặt','Sale rep','bat_dau',5,'Ảnh tại điểm'),

  ('bao-cao-thang',1,'Thu thập số sell-in','Trade MKT','ket_thuc',2,'Sổ chi tiết bán hàng'),
  ('bao-cao-thang',2,'Thu thập số bán ra và tồn kho','Sales MT','ket_thuc',3,'File bán ra – tồn của chuỗi'),
  ('bao-cao-thang',3,'Làm sạch và đối chiếu số liệu','Trade MKT','ket_thuc',4,'File số đã đối chiếu'),
  ('bao-cao-thang',4,'Viết báo cáo','Trade MKT','ket_thuc',5,'Bản báo cáo'),
  ('bao-cao-thang',5,'Gửi trưởng nhóm duyệt','Trưởng nhóm','ket_thuc',6,'Góp ý/duyệt'),
  ('bao-cao-thang',6,'Gửi BOD','Trade MKT','ket_thuc',7,'Link/bản gửi BOD')
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

-- Xong. Kiểm tra: select ten from public.quy_trinh order by thu_tu;
