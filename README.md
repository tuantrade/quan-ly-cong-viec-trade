# Quản lý công việc Trade MKT – Trí Việt Phát

App web quản lý các hoạt động trade theo quy trình mẫu: giao việc, theo dõi hạn, cảnh báo trễ và đo tiến độ theo người và theo khâu.

- **Giao diện:** 1 trang web (`index.html`), chạy trên GitHub Pages.
- **Dữ liệu và đăng nhập:** Supabase (cơ sở dữ liệu SQL).

## Các file trong thư mục

| File | Dùng để |
|---|---|
| `index.html` | Toàn bộ giao diện app |
| `cau-hinh.js` | Điền địa chỉ và khóa Supabase (chỉ sửa file này) |
| `supabase/thiet-ke-co-so-du-lieu.sql` | Tạo bảng, phân quyền và quy trình mẫu trong Supabase (chạy 1 lần) |
| `nhac-han-email/nhac-han-qua-email.gs` | Script Google gửi email nhắc hạn mỗi sáng (xem mục “Nhắc hạn qua email”) |
| `nhac-han-email/dong-bo-lich-post.gs` | Script Google đồng bộ lịch CTKM / kỳ post từ Google Sheet kế hoạch vào app (xem mục “Lịch post”) |

---

## PHẦN A – Chuẩn bị Supabase (khoảng 10 phút)

**A1. Tạo dự án**
1. Vào https://supabase.com/dashboard, bấm **New project**.
2. Đặt tên (ví dụ `quan-ly-trade`), đặt **Database Password** và lưu lại mật khẩu này.
3. **Region:** chọn **Southeast Asia (Singapore)** để app chạy nhanh ở Việt Nam.
4. Bấm **Create** và đợi 1–2 phút.

**A2. Tạo cơ sở dữ liệu**
1. Mở file `supabase/thiet-ke-co-so-du-lieu.sql`, tìm `EMAIL_CUA_BAN@gmail.com` và **thay bằng email bạn sẽ dùng để đăng nhập app**. Email này sẽ là quản lý đầu tiên.
2. Trong Supabase, mở menu trái **SQL Editor**, bấm **New query**.
3. Dán toàn bộ nội dung file rồi bấm **Run**. Thấy chữ **Success** là xong.
4. Kiểm tra: mở **Table Editor**, phải thấy các bảng `hoat_dong`, `buoc_cong_viec`, `quy_trinh`…

**A3. Bật đăng nhập bằng email**
1. Vào **Authentication → Sign In / Providers → Email**, kiểm tra đã bật (Enabled).
2. **Giữ bật Confirm email.** App cấp quyền theo email, nên phải xác nhận email để tránh người lạ đăng ký bằng email của thành viên.

**A4. Lấy 2 thông tin kết nối**
1. Bấm nút **Connect** ở đầu trang dự án, hoặc vào **Project Settings → API Keys** / **Data API**.
2. Chép lại:
   - **Project URL**, dạng `https://abcdxyz.supabase.co`
   - **Khóa công khai**: `anon public`, hoặc `publishable` (bắt đầu bằng `sb_publishable_`)
3. ⚠️ **Không dùng** khóa `service_role` hay `secret`. Khóa đó có toàn quyền, không được đưa lên web.

---

## PHẦN B – Đưa app lên GitHub (khoảng 10 phút)

**B1. Tạo kho chứa code (repository)**
1. Vào https://github.com/new
2. **Repository name:** `quan-ly-cong-viec-trade`
3. Chọn **Public**. GitHub Pages miễn phí yêu cầu Public. Chỉ code là công khai, còn dữ liệu nằm trong Supabase và được bảo vệ bằng đăng nhập cùng phân quyền.
4. Bấm **Create repository**.

**B2. Tải file lên**
1. Trong repo vừa tạo, bấm **uploading an existing file** (hoặc **Add file → Upload files**).
2. Kéo thả **cả 3 thứ**: `index.html`, `cau-hinh.js`, `README.md` và **thư mục** `supabase`.
3. Bấm **Commit changes**.

**B3. Điền thông tin kết nối**
1. Trên GitHub, bấm vào file `cau-hinh.js`, rồi bấm biểu tượng **bút chì** (Edit).
2. Thay `DIEN_PROJECT_URL` bằng Project URL và `DIEN_KHOA_ANON` bằng khóa công khai, giữ nguyên dấu ngoặc kép.
3. Bấm **Commit changes**.

**B4. Bật trang web**
1. Vào **Settings → Pages**.
2. **Source:** chọn *Deploy from a branch*. **Branch:** `main`, thư mục `/ (root)`. Bấm **Save**.
3. Đợi 1–3 phút rồi tải lại trang. Link app sẽ hiện ra, dạng:
   `https://<tên-tài-khoản>.github.io/quan-ly-cong-viec-trade/`

**B5. Báo cho Supabase biết link app** (để link trong email đặt lại mật khẩu hoạt động)
- Supabase → **Authentication → URL Configuration**: điền **Site URL** bằng link app ở bước B4, rồi bấm **Save**.

---

## PHẦN C – Dùng lần đầu

1. Mở link app, bấm **Tạo tài khoản mới**, dùng **đúng email đã điền ở bước A2** và đặt mật khẩu (ít nhất 6 ký tự).
2. Nếu chưa tắt Confirm email: mở email xác nhận rồi quay lại đăng nhập.
3. Thêm đồng nghiệp: vào mục **Thành viên**, nhập họ tên và email, bấm **Thêm thành viên**. Sau đó gửi link app để họ tự tạo tài khoản bằng đúng email đó.
4. Trên điện thoại: mở link bằng Chrome hoặc Safari, chọn **Thêm vào màn hình chính** để dùng như một app.

## Phân quyền

| Vai trò | Được làm |
|---|---|
| Thành viên | Xem tất cả; tạo, sửa, xóa hoạt động, bước công việc và quy trình mẫu |
| Quản lý | Như thành viên, thêm quyền thêm/xóa thành viên và sửa danh mục nhãn hàng, hệ thống |
| Khách (chỉ xem) | Xem tổng quan, hoạt động, lịch việc, quy trình mẫu. Không thêm, sửa, xóa được gì; không thấy danh sách thành viên và email của người khác; không có trong danh sách chọn người làm |
| Người không có trong danh sách | Đăng nhập được nhưng không thấy dữ liệu nào |

**Mời khách xem:** quản lý vào **Thành viên**, nhập họ tên và email của khách, chọn vai trò **Khách (chỉ xem)**, bấm **Thêm thành viên**. Gửi link app để khách tự tạo tài khoản bằng đúng email đó. Muốn thu hồi thì bấm **Xóa** ở dòng của khách.
Quyền chỉ xem được chặn ngay trong cơ sở dữ liệu, nên khách không sửa được gì kể cả khi tự gọi thẳng vào Supabase.

## Cập nhật cơ sở dữ liệu khi có bản mới
Khi file `supabase/thiet-ke-co-so-du-lieu.sql` thay đổi (ví dụ thêm vai trò Khách), mở Supabase → **SQL Editor** → **New query**, dán **toàn bộ** file rồi bấm **Run**. File chạy lại nhiều lần vẫn an toàn: không xóa và không tạo trùng dữ liệu. Không cần sửa dòng `EMAIL_CUA_BAN@gmail.com` nữa, vì quản lý đã có sẵn thì dòng đó được bỏ qua.

## Luồng công việc và duyệt bước
Thiết lập trong **Quy trình mẫu → Sửa** (hoặc **+ Thêm quy trình mẫu**). Mỗi bước có:
- **Người làm**: người mặc định nhận bước. Để “Giao khi tạo” thì người làm được chọn theo vai trò lúc tạo hoạt động.
- **Người duyệt**: chọn một thành viên nếu bước cần duyệt (ví dụ “Trình duyệt nội bộ” cần trưởng nhóm duyệt). Để “Không cần duyệt” thì người làm tự đánh dấu xong.

Khi chạy một hoạt động:
1. Các bước đi lần lượt từ trên xuống. Người làm nộp kết quả, dán link bằng chứng vào ô **Ghi chú / link**.
2. Bước **không cần duyệt**: người làm chọn **Xong** hoặc bấm **Đánh dấu xong**.
3. Bước **cần duyệt**: người làm bấm **Hoàn tất, gửi duyệt** (hoặc chọn “Hoàn tất (gửi duyệt)”). Bước chuyển sang **Chờ duyệt** và hiện ở mục **Đang chờ duyệt** (Tổng quan), trong **Lịch việc** của người duyệt, và trong **email nhắc** của người duyệt.
4. Người duyệt bấm **Duyệt** thì bước mới tính là **Xong**, ngày xong là ngày duyệt. Bấm **Trả lại** thì phải ghi lý do; bước quay về người làm ở trạng thái Đang làm và hiện dòng “Bị trả lại: …”.
5. Quản lý duyệt thay được. Chỉ quản lý mới đổi hoặc bỏ người duyệt của một bước đã có người duyệt. Bước đã duyệt chỉ người duyệt hoặc quản lý mới mở lại được. Các luật này được chặn ngay trong cơ sở dữ liệu.
6. Mọi lần gửi duyệt, trả lại, duyệt đều được ghi vào bảng `nhat_ky_buoc` (ai, lúc nào), dùng để đo số lần bị trả lại, thời gian chờ duyệt về sau.

Đổi quy trình mẫu chỉ áp dụng cho hoạt động tạo sau đó. Hoạt động đã tạo thì sửa người duyệt ngay trong màn chi tiết (cột **Người duyệt**).

## Giao người làm
- Người làm của mỗi bước được **chọn từ danh sách thành viên**, không gõ tay. Vì vậy mỗi người trong nhóm cần được thêm vào màn **Thành viên** trước.
- Khi thống kê, tên được so không phân biệt chữ hoa/thường và khoảng trắng thừa: “Chị Thương” và “chị  thương” được tính là một người.
- Tên gõ tay từ trước mà không khớp thành viên nào sẽ hiện ở bảng **Tên người làm chưa khớp thành viên** (màn Thành viên, chỉ quản lý thấy). Chọn đúng thành viên rồi bấm **Gộp** để chuyển tất cả các bước mang tên đó sang thành viên này.

## Nhắc hạn qua email
Mỗi sáng (khoảng 7h–8h, trừ Chủ nhật), một script Google gửi thư **từ Gmail của bạn**:
- **Mỗi người làm** nhận 1 thư chỉ có việc của mình: bước **đang trễ**, **hạn hôm nay**, **đến hạn trong 3 ngày tới**. Bấm tên hoạt động trong thư là mở thẳng hoạt động đó trong app.
- **Quản lý** nhận thêm bảng tổng hợp cả nhóm (số bước trễ / hạn hôm nay / 3 ngày tới theo từng người) và danh sách bước **chưa giao người** hoặc **tên không khớp thành viên** (những bước này không ai nhận thư nhắc, cần sửa trong app).
- Ai không có việc cần nhắc thì không nhận thư. Khách (chỉ xem) không bao giờ nhận thư.
- Email người nhận lấy từ bảng **Thành viên**, so theo họ tên với ô “Người làm”.

**Cài đặt (khoảng 10 phút, làm 1 lần)**

*Bước 1 – Lấy mã bí mật trong Supabase*
1. Chạy lại toàn bộ file `supabase/thiet-ke-co-so-du-lieu.sql` (xem mục “Cập nhật cơ sở dữ liệu khi có bản mới”).
2. Mở **SQL Editor → New query**, dán dòng dưới rồi bấm **Run**:
   `select ma_bi_mat from public.cau_hinh_nhac;`
3. Chép lại chuỗi 64 ký tự hiện ra. **Không gửi mã này cho ai.**

*Bước 2 – Tạo script Google*
1. Đăng nhập Gmail sẽ dùng để gửi thư, mở https://script.google.com và bấm **Dự án mới** (New project).
2. Đặt tên dự án, ví dụ `Nhắc hạn Trade MKT`.
3. Xóa hết nội dung có sẵn trong `Code.gs`, dán toàn bộ nội dung file `nhac-han-email/nhac-han-qua-email.gs`, bấm biểu tượng **Lưu**.
4. Bấm **Cài đặt dự án** (biểu tượng bánh răng bên trái):
   - **Múi giờ:** chọn `(GMT+07:00) Bangkok/Hà Nội/Jakarta`.
   - Kéo xuống **Thuộc tính tập lệnh** (Script properties), bấm **Thêm thuộc tính** và thêm 4 dòng:

| Thuộc tính | Giá trị |
|---|---|
| `SUPABASE_URL` | `https://nuaiqosmnteroepiuica.supabase.co` |
| `SUPABASE_KHOA` | khóa publishable (giống trong `cau-hinh.js`, bắt đầu bằng `sb_publishable_`) |
| `MA_BI_MAT` | mã 64 ký tự ở Bước 1 |
| `LINK_APP` | `https://tuantrade.github.io/quan-ly-cong-viec-trade/` |

   Bấm **Lưu thuộc tính tập lệnh**. Mã bí mật nằm ở đây, không nằm trong code.

*Bước 3 – Gửi thử*
1. Quay lại màn **Trình chỉnh sửa** (biểu tượng `< >`), ở ô chọn hàm phía trên chọn **`guiThu`**, bấm **Chạy**.
2. Lần đầu Google hỏi cấp quyền: **Xem lại quyền** → chọn tài khoản → nếu hiện “Google chưa xác minh ứng dụng này” thì bấm **Nâng cao** → **Đi tới … (không an toàn)** → **Cho phép**. Đây là script của chính bạn nên an toàn; script chỉ xin quyền gửi thư và kết nối ra ngoài.
3. Mở hộp thư của bạn: mọi thư được gửi **về chính bạn**, tiêu đề có chữ `[THỬ – gửi cho …]` để xem trước từng người sẽ nhận gì.

*Bước 4 – Bật gửi hằng ngày*
- Chọn hàm **`batHenGio`** rồi bấm **Chạy**. Từ hôm sau, thư tự gửi mỗi sáng.
- Muốn ngừng: chạy hàm **`tatHenGio`**.
- Muốn đổi giờ gửi, số ngày nhắc trước, hoặc gửi cả Chủ nhật: sửa phần `CAI_DAT` ở đầu script, lưu, rồi chạy lại `batHenGio`.

**Khi có lỗi**
- Xem mục **Lần thực thi** (Executions) bên trái trong Apps Script. Thông báo lỗi bằng tiếng Việt, ví dụ “MA_BI_MAT không đúng”.
- Nghi lộ mã bí mật: chạy trong SQL Editor
  `update public.cau_hinh_nhac set ma_bi_mat = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');`
  rồi lấy mã mới (Bước 1) dán lại vào `MA_BI_MAT`. Người có mã chỉ đọc được danh sách nhắc việc, không sửa được gì.
- Gmail cá nhân gửi tối đa khoảng 100 thư/ngày; nhóm nhỏ dùng không hết.

## Lịch post (lịch CTKM theo siêu thị)
Trang **Lịch post** hiện lịch CTKM của từng chuỗi / nhãn hàng dạng thanh thời gian, lấy từ Google Sheet kế hoạch (ví dụ tab `PLAN 2026` trong file *TRADE MASTER PLAN*).

- Mỗi hàng là một chuỗi · nhãn hàng; mỗi thanh là một chương trình. Màu xanh = Onpost, màu vàng = Offpost (đọc từ chữ “onpost/offpost” trong ô hoặc ở cột siêu thị), xám = không ghi.
- Thanh có viền xanh lá và dấu ✓ = đã có hoạt động trong app cùng kênh, cùng nhãn, trùng thời gian.
- Bấm một thanh để xem đầy đủ nội dung và bấm **Tạo hoạt động CTKM**: app tự chọn mẫu Onpost/Offpost, điền tên, nhãn, kênh, ngày chạy; hạn các bước tự tính.
- Bảng **Sắp bắt đầu (45 ngày tới)** cho biết chương trình nào chưa được tạo trong app.
- **Sửa lịch thì sửa trên Google Sheet**, app chỉ đọc.

**Cách app đọc sheet:** cột B = chuỗi, cột C = siêu thị (có thể ghi Onpost / Offpost), cột D = nhãn hàng; hàng tiêu đề có “THÁNG 1/2026”, hàng ngay dưới là số ngày, mỗi cột là một ngày. Mỗi chương trình là một ô (gộp ngang nhiều ngày): chữ trong ô là nội dung, độ dài ô gộp là thời gian chạy. Giữ đúng cách trình bày này thì sang năm (tab `PLAN 2027`) vẫn đọc được.

**Cài đồng bộ tự động mỗi giờ** (làm 1 lần, cùng dự án Apps Script với phần nhắc hạn email):
1. Trong dự án Apps Script, bấm **+** cạnh “Tệp” → **Tập lệnh**, đặt tên `dong-bo-lich-post`, dán nội dung file `nhac-han-email/dong-bo-lich-post.gs`, lưu. (Dự án phải có sẵn file nhắc hạn email vì dùng chung phần đọc thông số.)
2. **Cài đặt dự án → Thuộc tính tập lệnh**, thêm `LICH_POST_SHEET_ID` = mã Google Sheet (đoạn giữa `/d/` và `/edit` trong link). Nếu tab kế hoạch không bắt đầu bằng “PLAN” thì thêm `LICH_POST_TAB` = tên tab.
3. Chọn hàm **`dongBoLichPost`** → **Chạy** (lần đầu cho phép quyền đọc Google Sheet). Mở trang Lịch post, dòng đầu ghi thời điểm đồng bộ lần cuối.
4. Chọn hàm **`batHenGioLichPost`** → **Chạy** để tự đồng bộ mỗi giờ. Muốn ngừng: chạy `tatHenGioLichPost`.

## Sửa danh mục nhãn hàng / hệ thống
Supabase → **Table Editor** → bảng `nhan_hang` hoặc `he_thong` → **Insert row**. Muốn ẩn một mục mà không xóa thì đổi `dang_dung` thành `false`.

## Đo lường về sau
Bảng `nhat_ky_buoc` tự ghi lại mọi lần đổi **trạng thái**, **hạn** và **người làm**: ai đổi, lúc nào. Dữ liệu này dùng để đo số lần dời hạn, thời gian thực tế của từng khâu… mà không cần sửa lại cơ sở dữ liệu.

## Lưu ý gói miễn phí
- Nếu dự án Supabase lâu không có ai dùng, nó có thể bị tạm dừng. Khi đó vào Supabase và bấm **Restore** là chạy lại, dữ liệu vẫn còn.
- Nên định kỳ xuất dữ liệu ra file để sao lưu: Table Editor → chọn bảng → **Export to CSV**.
