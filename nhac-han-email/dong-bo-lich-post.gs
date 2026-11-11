/**
 * ĐỒNG BỘ LỊCH CTKM / KỲ POST TỪ GOOGLE SHEET VÀO APP
 *
 * Đọc tab kế hoạch dạng Gantt (ví dụ "PLAN 2026" trong file TRADE MASTER PLAN):
 *  - cột B = chuỗi, cột C = siêu thị (có thể ghi Onpost / Offpost), cột D = nhãn hàng;
 *  - từ cột E: mỗi cột là 1 ngày; hàng tiêu đề có "THÁNG m/yyyy", hàng ngay dưới là số ngày;
 *  - mỗi chương trình là 1 ô (thường gộp nhiều ngày): chữ trong ô = nội dung, độ dài ô gộp = thời gian chạy.
 * Rồi gửi toàn bộ danh sách lên Supabase (thay hết bản cũ), app hiện ở trang "Lịch post".
 *
 * Dùng chung dự án Apps Script với file nhac-han-qua-email.gs (cùng SUPABASE_URL, SUPABASE_KHOA, MA_BI_MAT).
 * Thêm 1 thuộc tính tập lệnh: LICH_POST_SHEET_ID = mã của Google Sheet (đoạn giữa /d/ và /edit trong link).
 * Tùy chọn: LICH_POST_TAB = tên tab (mặc định: tab đầu tiên có tên bắt đầu bằng "PLAN").
 */

/** Chạy tay để đồng bộ ngay; hoặc bật hẹn giờ bằng batHenGioLichPost(). */
function dongBoLichPost() {
  var g = layThongSo_();
  var p = PropertiesService.getScriptProperties();
  var sheetId = (p.getProperty('LICH_POST_SHEET_ID') || '').trim();
  if (!sheetId) throw new Error('Chưa điền LICH_POST_SHEET_ID trong Thuộc tính tập lệnh.');
  var ss = SpreadsheetApp.openById(sheetId);
  var tenTab = (p.getProperty('LICH_POST_TAB') || '').trim();
  var sh = tenTab ? ss.getSheetByName(tenTab)
    : ss.getSheets().filter(function (s) { return /^plan/i.test(s.getName()); })[0];
  if (!sh) throw new Error('Không tìm thấy tab kế hoạch' + (tenTab ? ' "' + tenTab + '"' : ' (tên bắt đầu bằng PLAN)'));
  var vung = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn());
  var giaTri = vung.getDisplayValues();
  var gop = vung.getMergedRanges().map(function (r) {
    return { r0: r.getRow() - 1, c0: r.getColumn() - 1, r1: r.getLastRow() - 1, c1: r.getLastColumn() - 1 };
  });
  var ds = phanTichLichPost(giaTri, gop);
  var r = UrlFetchApp.fetch(g.url + '/rest/v1/rpc/dong_bo_lich_post', {
    method: 'post', contentType: 'application/json', headers: { apikey: g.khoa },
    payload: JSON.stringify({ ma: g.ma, nguon: ss.getName() + ' / ' + sh.getName(), du_lieu: ds }),
    muteHttpExceptions: true
  });
  if (r.getResponseCode() !== 200) throw new Error('Supabase trả lỗi ' + r.getResponseCode() + ': ' + r.getContentText());
  console.log('Đã đồng bộ ' + ds.length + ' chương trình từ "' + sh.getName() + '".');
}

/** Bật đồng bộ tự động mỗi giờ. */
function batHenGioLichPost() {
  tatHenGioLichPost();
  ScriptApp.newTrigger('dongBoLichPost').timeBased().everyHours(1).create();
  console.log('Đã bật: đồng bộ lịch post mỗi giờ.');
}
function tatHenGioLichPost() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dongBoLichPost') ScriptApp.deleteTrigger(t);
  });
}

/**
 * Phân tích bảng Gantt. giaTri: mảng 2 chiều chữ hiển thị (bắt đầu từ ô A1);
 * gop: danh sách ô gộp {r0,c0,r1,c1} (chỉ số từ 0, tính cả 2 đầu).
 * Trả về [{nhom, chuoi, sieu_thi, nhan_hang, loai, noi_dung, ngay_bat_dau, ngay_ket_thuc, dong, cot}]
 */
function phanTichLichPost(giaTri, gop) {
  var soDong = giaTri.length, soCot = 0;
  giaTri.forEach(function (h) { if (h.length > soCot) soCot = h.length; });
  var o = function (r, c) { return String((giaTri[r] || [])[c] == null ? '' : giaTri[r][c]).trim(); };

  // 1. Hàng tiêu đề tháng ("THÁNG 1/2026") và hàng số ngày ngay dưới
  var hangThang = -1;
  for (var r = 0; r < Math.min(soDong, 20) && hangThang < 0; r++)
    for (var c = 0; c < soCot; c++) if (/TH[ÁA]NG\s*\d{1,2}\s*\/\s*\d{4}/i.test(o(r, c))) { hangThang = r; break; }
  if (hangThang < 0) throw new Error('Không thấy hàng tiêu đề tháng dạng "THÁNG 1/2026".');
  var hangNgay = hangThang + 1;

  // 2. Ngày của từng cột: lấy tháng/năm ở tiêu đề tháng đầu tiên, sau đó đi theo số ngày
  //    (số ngày tăng 1 = cùng tháng; quay về 1 = sang tháng sau), nên tiêu đề tháng sau có ghi sai cũng không lệch
  var ngayCot = [], cotDau = -1, ngayTruoc = null, soTruoc = 0;
  var ymd = function (dt) { return dt.getUTCFullYear() + '-' + ('0' + (dt.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + dt.getUTCDate()).slice(-2); };
  for (var c2 = 0; c2 < soCot; c2++) {
    var d = parseInt(o(hangNgay, c2), 10);
    if (!(d >= 1 && d <= 31)) continue;
    if (!ngayTruoc) {
      var m = null;
      for (var k = c2; k >= 0 && !m; k--) m = o(hangThang, k).match(/TH[ÁA]NG\s*(\d{1,2})\s*\/\s*(\d{4})/i);
      if (!m) continue;
      ngayTruoc = new Date(Date.UTC(+m[2], +m[1] - 1, d));
      cotDau = c2;
    } else {
      var tiep = new Date(ngayTruoc.getTime() + 86400000);
      if (tiep.getUTCDate() !== d) {           // cột bị bỏ cách / ghi lệch: tìm ngày d gần nhất phía sau
        for (var buoc = 1; buoc <= 31 && tiep.getUTCDate() !== d; buoc++) tiep = new Date(tiep.getTime() + 86400000);
      }
      ngayTruoc = tiep;
    }
    ngayCot[c2] = ymd(ngayTruoc); soTruoc = d;
  }
  if (cotDau < 0) throw new Error('Không đọc được hàng số ngày dưới hàng tiêu đề tháng.');

  // 3. Ô gộp: cột thông tin (A–D) lấy giá trị ô trên cùng; vùng ngày thì đánh dấu đã thuộc ô gộp
  var giaTriGop = {}, thuocGop = {};
  gop.forEach(function (g) {
    if (g.c0 < cotDau) {
      for (var rr = g.r0; rr <= g.r1; rr++) for (var cc = g.c0; cc <= Math.min(g.c1, cotDau - 1); cc++) giaTriGop[rr + ',' + cc] = o(g.r0, g.c0);
    } else {
      for (var r3 = g.r0; r3 <= g.r1; r3++) for (var c3 = g.c0; c3 <= g.c1; c3++) thuocGop[r3 + ',' + c3] = true;
    }
  });
  var thongTin = function (r, c) { var k = r + ',' + c; return k in giaTriGop ? giaTriGop[k] : o(r, c); };

  // 4. Dữ liệu bắt đầu từ hàng đầu tiên dưới hàng số ngày có chữ ở cột A–D (bỏ qua hàng thứ trong tuần)
  var hangDau = hangNgay + 1;
  while (hangDau < soDong && !o(hangDau, 0) && !o(hangDau, 1) && !o(hangDau, 2) && !o(hangDau, 3)) hangDau++;
  // Nhóm (vd "TRADE PROMOTION"): hàng chỉ có chữ ở cột A
  var nhomDong = [], nhom = '';
  for (var r4 = hangDau; r4 < soDong; r4++) {
    var a = o(r4, 0);
    if (a && !/^\d+$/.test(a) && !thongTin(r4, 1) && !thongTin(r4, 2) && !thongTin(r4, 3)) nhom = a;
    nhomDong[r4] = nhom;
  }

  var ketQua = [];
  function them(r0, c0, c1) {
    var noiDung = o(r0, c0); if (!/[0-9A-Za-zÀ-ỹ]/.test(noiDung)) return;   // bỏ ô chỉ có ký tự lạ
    var bd = ngayCot[c0], kt = null;
    for (var c = c1; c >= c0 && !kt; c--) kt = ngayCot[c] || null;
    if (!bd || !kt) return;
    var sieuThi = thongTin(r0, 2), chu = (sieuThi + ' ' + noiDung).toLowerCase();
    ketQua.push({
      nhom: nhomDong[r0] || '', chuoi: thongTin(r0, 1).replace(/\s*\n\s*/g, ' / '), sieu_thi: sieuThi,
      nhan_hang: thongTin(r0, 3),
      loai: /off\s*-?\s*post/.test(chu) ? 'offpost' : (/on\s*-?\s*post/.test(chu) ? 'onpost' : ''),
      noi_dung: noiDung, ngay_bat_dau: bd, ngay_ket_thuc: kt, dong: r0 + 1, cot: c0 + 1
    });
  }
  // 5. Chương trình = ô gộp trong vùng ngày, hoặc ô đơn có chữ
  gop.forEach(function (g) { if (g.c0 >= cotDau && g.r0 >= hangDau) them(g.r0, g.c0, g.c1); });
  for (var r5 = hangDau; r5 < soDong; r5++)
    for (var c5 = cotDau; c5 < soCot; c5++)
      if (!thuocGop[r5 + ',' + c5] && o(r5, c5)) them(r5, c5, c5);
  ketQua.sort(function (x, y) { return x.dong - y.dong || x.ngay_bat_dau.localeCompare(y.ngay_bat_dau); });
  return ketQua;
}
