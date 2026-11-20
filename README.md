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
| `thanh-ben.js` | Thanh chuyển trang bên trái, dùng chung cho app, Báo cáo MT, Lịch post 2027. **Trang làm việc**: Tổng quan, Hoạt động, Lịch việc, Lịch post, Lịch post 2027. **Trang báo cáo**: Sell-in, Sell-out, Baseline, Giá bán \Giá bán & TVP thu về, Bảng giá siêu thị.  TVP thu về (Bảng giá siêu thị đã ẩn khỏi thanh vì trùng nội dung). **Thiết lập**: Quy trình mẫu, Thành viên. Điện thoại: nút ☰ mở thanh. Các mục Trang báo cáo mở **ngay trong app** (#bc-sell-in, #bc-sell-out, #bc-baseline, #bc-gia): app nhúng `bao-cao-mt.html?trong-app=1` trong một khung giữ suốt phiên, đổi mục không tải lại số |
| `bao-cao-mt.html` | Trang **Báo cáo MT** (Sell-in, Sell-out, Giá) – mã trang lấy nguyên từ dashboard, số lấy từ Supabase |
| `nhac-han-email/doc-nguon-so-lieu.gs`, `dong-bo-du-lieu.gs`, `appsscript.json` | Script Google tự nạp số liệu mỗi giờ từ thư mục Drive và Google Sheet (xem mục “Báo cáo MT và tự nạp số”) |
| `cong-cu/nap-tu-dashboard.js` | Nạp lần đầu / nạp lại toàn bộ số gốc từ dashboard cũ |
| `cong-cu/tao-bao-cao-mt.js`, `khung-bao-cao-mt.html` | Ghép lại trang Báo cáo MT khi dashboard đổi giao diện |
| `lich-post-2027.html`, `cong-cu/tao-lich-post-2027.js`, `khung-lich-post-2027.html` | Trang **Lịch post 2027** (lịch Tết 2027 của GO/BigC, Emart, Lotte, Co.op; hạn đăng ký; trùng lịch với Co.op). Mã trang lấy từ dashboard, lịch lưu trong Supabase (`bo_so_tinh_san`, bộ `lich_post_2027`) |
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

## Thời gian PO giảm giá theo hệ thống
Lấy từ sheet *CẬP NHẬT CTKM KÊNH MT 2026* (cột “Thời gian giảm PO” so với “Time giảm giá NTD”):

| Hệ thống | PO giảm giá bắt đầu | PO giảm giá kết thúc |
|---|---|---|
| Co.op | 14 ngày trước ngày chạy | cùng ngày kết thúc |
| Lotte | 15 ngày trước ngày chạy | cùng ngày kết thúc |
| Emart | 10 ngày trước ngày chạy | cùng ngày kết thúc |
| GO!/Big C | 17 ngày trước ngày chạy | 7 ngày trước ngày kết thúc |
| WinMart | 17 ngày trước ngày chạy | cùng ngày kết thúc |

- App dùng quy tắc này để: hiện ô **PO giảm giá** ở hoạt động và Lịch post; thêm mốc **Bắt đầu PO giảm giá** vào bảng mốc 30 ngày tới; tính **sell-in theo thời gian PO** (trước / trong / sau) trong bảng số bán. **Bán ra** vẫn tính theo ngày chạy.
- **Lotte và GO, cửa hàng có CTV:** số bán ra của hai hệ thống này chỉ có ở cửa hàng có CTV kiểm tồn, và hàng giao thẳng từng cửa hàng. Vì vậy bảng số bán có thêm phần **Ở các cửa hàng có CTV**: sell-in theo từng cửa hàng CTV (trước / trong / sau thời gian PO giảm giá) đặt cạnh số kiểm tồn của CTV (tồn đầu, nhập, bán, tồn cuối) ở đúng cửa hàng đó. Không suy ra cho cả hệ thống. Sell-in theo cửa hàng lấy từ cột “Diễn giải chung” (điểm nhận hàng) trong Sổ chi tiết bán hàng, bảng `nguon_sellin_ch`, view `sell_in_cua_hang`.
- Kỳ đặc biệt có thể lệch quy tắc (ví dụ Lotte 2701 dịp Tết PO sớm 20 ngày). Đổi số ngày: sửa bảng `PO_HT` trong `index.html`.

## Trang Tổng quan: Việc của tôi và mốc Lịch post
- Khung **Việc của tôi** ở đầu trang: việc của người đang đăng nhập bị trễ, hạn hôm nay, đến hạn trong 7 ngày, và bước đang chờ mình duyệt; bấm thẳng **Đánh dấu xong / Duyệt** tại đây. Kèm số ngày còn lại đến Mùng 1 Tết Đinh Mùi (06/02/2027).
- Bảng **Mốc Lịch post 30 ngày tới**: hạn đăng ký, ngày bắt đầu giao hàng, ngày bắt đầu chạy của từng kỳ (lấy từ Lịch post và Lịch post 2027). Kỳ chưa có hoạt động thì có nút **Tạo CTKM** (app điền sẵn hệ thống, tên kỳ, ngày chạy). Kỳ Lịch post 2027 được coi là đã có hoạt động khi hoạt động cùng hệ thống có tên chứa mã kỳ, hoặc trùng đúng ngày chạy.
- Trang **Quy trình mẫu**: mỗi mẫu có nút **+ Tạo hoạt động theo mẫu này** và số lần đã dùng. Khi tạo, app báo trước nếu có bước rơi vào ngày đã qua.

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
- Bấm một thanh hoặc một dòng (kể cả bảng **Đã chạy xong gần đây (60 ngày qua)**) là thấy luôn **số bán quanh đợt**: bán ra và sell-in từng kỳ trong 5 tuần trước đến 5 tuần sau, kèm bảng **Tóm tắt theo giai đoạn** (Trước / Trong / Sau CTKM: tổng, trung bình mỗi ngày). Chỉ cộng và chia số đã có; nếu các kỳ chồng ngày nhau thì không cộng gộp.
- **Sửa lịch thì sửa trên Google Sheet**, app chỉ đọc.

**Cách app đọc sheet:** cột B = chuỗi, cột C = siêu thị (có thể ghi Onpost / Offpost), cột D = nhãn hàng; hàng tiêu đề có “THÁNG 1/2026”, hàng ngay dưới là số ngày, mỗi cột là một ngày. Mỗi chương trình là một ô (gộp ngang nhiều ngày): chữ trong ô là nội dung, độ dài ô gộp là thời gian chạy. Giữ đúng cách trình bày này thì sang năm (tab `PLAN 2027`) vẫn đọc được.

**Cài đồng bộ tự động mỗi giờ** (làm 1 lần, cùng dự án Apps Script với phần nhắc hạn email):
1. Trong dự án Apps Script, bấm **+** cạnh “Tệp” → **Tập lệnh**, đặt tên `dong-bo-lich-post`, dán nội dung file `nhac-han-email/dong-bo-lich-post.gs`, lưu. (Dự án phải có sẵn file nhắc hạn email vì dùng chung phần đọc thông số.)
2. **Cài đặt dự án → Thuộc tính tập lệnh**, thêm `LICH_POST_SHEET_ID` = mã Google Sheet (đoạn giữa `/d/` và `/edit` trong link). Nếu tab kế hoạch không bắt đầu bằng “PLAN” thì thêm `LICH_POST_TAB` = tên tab.
3. Chọn hàm **`dongBoLichPost`** → **Chạy** (lần đầu cho phép quyền đọc Google Sheet). Mở trang Lịch post, dòng đầu ghi thời điểm đồng bộ lần cuối.
4. Chọn hàm **`batHenGioLichPost`** → **Chạy** để tự đồng bộ mỗi giờ. Muốn ngừng: chạy `tatHenGioLichPost`.

## Báo cáo MT và tự nạp số
Trang **Báo cáo MT** (menu “Báo cáo MT ↗”, file `bao-cao-mt.html`) là bản đưa nguyên dạng dashboard “Data Sell-in/out kênh bán MT” lên app: trang **Sell-in**, **Sell-out**, **Giá** với đủ bảng, biểu đồ và cách tính như dashboard. Dùng chung đăng nhập với app; khách xem được nhưng không có giá vốn, lãi gộp. Trang **Baseline** làm ở chặng sau.

Tốc độ mở trang: 3 bảng lớn (sell-in, đơn hàng, Co.op bán ra – tồn) được lưu một bản trong trình duyệt (IndexedDB, mỗi tài khoản một bản riêng). Lần mở sau, trang hiện ngay bản đã lưu rồi chỉ hỏi máy chủ số dòng và mã dòng cuối của từng bảng; chỉ khi bảng đã đổi (script vừa nạp file mới) mới tải lại cả bảng. Trình duyệt chặn lưu thì trang vẫn tải bình thường như cũ.

Lọc trên trang Báo cáo MT:
- **Hệ thống (áp dụng cho mọi trang)** ở trên cùng: Toàn bộ hệ thống, Co.op (gồm Co.opMart, Co.op Food, Co.op Finelife), GO! / Big C, Lotte, Emart, rồi các hệ thống khác. Trang Sell-in lọc toàn bộ số theo lựa chọn này; các trang Sell-out, Baseline, Giá thì ô chọn hệ thống riêng của trang đi theo và bị khóa. Lựa chọn được nhớ trong trình duyệt.
- Cột **So với tháng trước** (bảng hệ thống × brand, bảng brand): so với cả tháng trước; tháng mới nhất chưa hết tháng thì so với cùng các ngày của tháng trước.
- **Doanh số sell-in đã trừ hàng trả lại**: các view `sell_in_ngay`, `sell_in_cua_hang` (số sell-in trong Lịch post, hoạt động, cửa hàng CTV) lấy doanh số − giá trị trả lại; ô "Doanh số bán" của Báo cáo MT cũng vậy. Doanh thu thuần vẫn = doanh số − chiết khấu − trả lại.
- **Sell-out lọc khu vực HCM / Tỉnh** (ô Khu vực): xếp theo tên siêu thị (hàm `khuVuc` trong bao-cao-mt.html). Co.op vùng BN, MT là Tỉnh; tên có địa danh tỉnh (danh sách `KV_TINH`, các tiền tố CF PY/VL/KH/BL/HP/TH/HN/BH/CT) là Tỉnh, còn lại HCM. Bình Dương tính HCM (Lotte Bình Dương, GO Dĩ An, CF BD); Bà Rịa – Vũng Tàu tính Tỉnh. Emart cả 3 siêu thị là HCM. Khi lọc, ô "Hàng vào siêu thị" của Co.op, Emart không tách được nên để trống.
- **Bảng SKU** lọc thêm theo hệ thống và theo cửa hàng / điểm nhận hàng. Số theo cửa hàng lấy từ bảng `nguon_sellin_ch` (cột Diễn giải chung của Sổ chi tiết bán hàng, mọi hệ thống, có chiết khấu và hàng trả lại), chỉ tải khi chọn một hệ thống. Tên điểm nhận hàng bỏ phần ghi chú sau dấu " - ".
- Từ đợt này trang `bao-cao-mt.html` được sửa trực tiếp, không ghép lại từ dashboard nữa (chạy lại `cong-cu/tao-bao-cao-mt.js` sẽ mất các phần đã sửa).

**Số tự nạp mỗi giờ** (script Google, không cần Claude):
| Nguồn | Cách đưa vào |
|---|---|
| Sổ chi tiết bán hàng (sell-in) | Kéo thả **nguyên file Excel** xuất từ phần mềm kế toán vào thư mục Drive **DATA TRADE MT / 1. Sổ chi tiết bán hàng**. Gửi lại file cùng kỳ thì số mới thay số cũ. |
| Co.op bán ra – tồn | Kéo thả **nguyên file Co.op gửi** (vd `T10-Tri Viet Phat.xlsx`) vào **DATA TRADE MT / 2. Co.op bán ra – tồn**. Mỗi file là 1 kỳ. |
| Emart bán ra | Google Sheet **“[EMART] SELL OUT THÁNG”** (tab SELL OUT theo ngày; tab T10, T11… theo kỳ). Sửa sheet là tự nạp lại. |
| Bảng giá | Google Sheet **“Bảng Giá Siêu Thị”** (tab EMART, GO, SG Co.op, LOTTE). Sửa sheet là tự nạp lại. |
| Kiểm tồn CTV (Lotte, GO) | Thư mục **3. Kiểm tồn CTV** – chặng sau mới đọc. |

- Khoảng **1 giờ** sau khi thả file / sửa sheet, app có số mới. Mỗi lần đọc được ghi vào **nhật ký nạp** (bảng `nhat_ky_nap`), file lỗi ghi rõ lý do (vd “CHƯA BIẾT HỆ THỐNG: …”, “CHƯA BIẾT BRAND …”).
- **Tên sản phẩm** ở các nguồn được quy về tên ngắn qua bảng `danh_muc_san_pham` (mã SKU Co.op, tên trên sheet Emart, tên trên bảng giá từng hệ thống). Tên mới chưa có trong danh mục hiện ở view `ten_chua_co_danh_muc`; quản lý thêm 1 dòng vào danh mục là xong.
- Trang **Giá** và bảng “Số bán quanh đợt CTKM” trong từng hoạt động cũng đọc cùng nguồn số này (số bán đầy đủ xem ở trang **Báo cáo MT**).

**Cài script tự nạp** (làm 1 lần, cùng dự án Apps Script với nhắc hạn email):
1. Trong dự án Apps Script, thêm 2 tệp `doc-nguon-so-lieu` và `dong-bo-du-lieu` (dán nội dung 2 file `.gs` cùng tên).
2. **Cài đặt dự án** → tích “Hiển thị tệp kê khai appsscript.json” → mở `appsscript.json`, dán nội dung file `nhac-han-email/appsscript.json` (bật Drive API, múi giờ Việt Nam).
3. **Thuộc tính tập lệnh**: ngoài SUPABASE_URL, SUPABASE_KHOA, MA_BI_MAT, thêm `EMART_SHEET_ID` và `GIA_SHEET_ID` (mã giữa `/d/` và `/edit` trong link 2 Google Sheet).
4. Chạy **`taoThuMucDuLieu`** (tạo thư mục DATA TRADE MT trong Drive), rồi **`thuDocNguon`** (thử đọc Emart, bảng giá, không gửi gì), rồi **`dongBoDuLieu`** (nạp lần đầu), cuối cùng **`batHenGioNapSo`** (bật chạy mỗi giờ).
5. Chia sẻ thư mục DATA TRADE MT cho người trong nhóm (quyền chỉnh sửa) để ai cũng thả file được.

**Nạp lại toàn bộ từ dashboard cũ** (lần đầu đã làm): `node cong-cu/nap-tu-dashboard.js <thư mục các file .json của dashboard> --gui` với biến môi trường MA_BI_MAT.
**Dashboard đổi giao diện**: tải `files/index.html` của dashboard rồi chạy `node cong-cu/tao-bao-cao-mt.js <file>`.

## Giá (bảng giá siêu thị)
Trang **Giá** trong app (và tab Giá của Báo cáo MT) lấy từ Google Sheet “Bảng Giá Siêu Thị”:
- **Từng mã tại một hệ thống**: giá TVP bán cho siêu thị (chưa VAT), mức đang giảm, trading term, **TVP thu về**, **giá vốn**, **lãi gộp** (số âm tô đỏ), giá bán lẻ tại quầy, giá bán lẻ ÷ giá siêu thị mua, ghi chú cần kiểm tra.
- **Giá bán lẻ cùng một mã ở các hệ thống** đặt cạnh nhau.
- **Khách (chỉ xem)** chỉ thấy mức giảm, trading term, giá bán lẻ và ghi chú kiểu “chưa có giá”. Giá bán cho siêu thị, TVP thu về, giá vốn, lãi gộp và ghi chú nói về lãi/lỗ bị chặn ngay trong cơ sở dữ liệu (bảng `gia_ban` chỉ thành viên đọc được; khách đọc view `gia_ban_cong_khai`).

## Sửa danh mục nhãn hàng / hệ thống
Supabase → **Table Editor** → bảng `nhan_hang` hoặc `he_thong` → **Insert row**. Muốn ẩn một mục mà không xóa thì đổi `dang_dung` thành `false`.

## Đo lường về sau
Bảng `nhat_ky_buoc` tự ghi lại mọi lần đổi **trạng thái**, **hạn** và **người làm**: ai đổi, lúc nào. Dữ liệu này dùng để đo số lần dời hạn, thời gian thực tế của từng khâu… mà không cần sửa lại cơ sở dữ liệu.

## Lưu ý gói miễn phí
- Nếu dự án Supabase lâu không có ai dùng, nó có thể bị tạm dừng. Khi đó vào Supabase và bấm **Restore** là chạy lại, dữ liệu vẫn còn.
- Nên định kỳ xuất dữ liệu ra file để sao lưu: Table Editor → chọn bảng → **Export to CSV**.
