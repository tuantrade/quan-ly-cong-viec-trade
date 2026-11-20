/**
 * TỰ NẠP SỐ LIỆU KÊNH MT VÀO APP (chạy mỗi giờ)
 *
 * Đọc:
 *  - Thư mục Drive "DATA TRADE MT" (tạo bằng hàm taoThuMucDuLieu):
 *      "1. Sổ chi tiết bán hàng"  -> kéo thả nguyên file Excel xuất từ phần mềm kế toán
 *      "2. Co.op bán ra – tồn"    -> kéo thả nguyên file Co.op gửi (T10-Tri Viet Phat.xlsx …)
 *      "3. Kiểm tồn CTV"          -> để dành cho chặng sau (file kiểm tồn Lotte, GO)
 *    File mới hoặc vừa sửa sẽ được đọc ở lần chạy kế tiếp. Gửi lại file cùng kỳ thì số mới thay số cũ.
 *  - Google Sheet "[EMART] SELL OUT THÁNG" và "Bảng Giá Siêu Thị": đọc lại khi sheet có thay đổi.
 * Rồi gửi vào Supabase qua hàm nap_nguon (cần mã bí mật). Kết quả từng lần đọc xem ở trang Số bán của app.
 *
 * Cần trong cùng dự án: nhac-han-qua-email.gs (phần đọc thông số), doc-nguon-so-lieu.gs (phần đọc file).
 * Cần bật dịch vụ nâng cao "Drive API" (v3) – đã khai báo trong appsscript.json.
 * Thuộc tính tập lệnh: SUPABASE_URL, SUPABASE_KHOA, MA_BI_MAT (như phần nhắc hạn), và
 *   THU_MUC_DU_LIEU (hàm taoThuMucDuLieu tự điền), EMART_SHEET_ID, GIA_SHEET_ID.
 */

// Đổi phiên bản đọc của một loại file thì các file đã đọc sẽ được đọc lại 1 lần (VD: v2 = sổ bán hàng có thêm số theo cửa hàng Lotte, GO)
var PHIEN_BAN_DOC = { so_ban_hang: '#v3', coop: '#v2' };
var THU_MUC_CON = { '1. Sổ chi tiết bán hàng': 'so_ban_hang', '2. Co.op bán ra – tồn': 'coop', '3. Kiểm tồn CTV': 'kiem_ton' };

/** Chạy 1 lần: tạo thư mục DATA TRADE MT và 3 thư mục con trong Drive của bạn. */
function taoThuMucDuLieu() {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty('THU_MUC_DU_LIEU'), goc;
  try { goc = id ? DriveApp.getFolderById(id) : null; } catch (e) { goc = null; }
  if (!goc) { goc = DriveApp.createFolder('DATA TRADE MT'); p.setProperty('THU_MUC_DU_LIEU', goc.getId()); }
  Object.keys(THU_MUC_CON).forEach(function (ten) { if (!goc.getFoldersByName(ten).hasNext()) goc.createFolder(ten); });
  console.log('Thư mục dữ liệu: ' + goc.getUrl());
}

/** Bật tự nạp mỗi giờ. */
function batHenGioNapSo() {
  tatHenGioNapSo();
  ScriptApp.newTrigger('dongBoDuLieu').timeBased().everyHours(1).create();
  console.log('Đã bật: tự nạp số liệu mỗi giờ.');
}
function tatHenGioNapSo() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'dongBoDuLieu') ScriptApp.deleteTrigger(t); });
}

/** Chạy tay hoặc theo giờ: đọc mọi thứ mới và gửi vào app. */
function dongBoDuLieu() {
  var khoa = LockService.getScriptLock(); if (!khoa.tryLock(5000)) { console.log('Đang có lượt khác chạy, bỏ qua.'); return; }
  try {
    var g = layThongSo_(), p = PropertiesService.getScriptProperties();
    var daDoc = JSON.parse(p.getProperty('DA_DOC') || '{}');
    var thuMuc = p.getProperty('THU_MUC_DU_LIEU'), coMoi = false;   // coMoi: có đọc file/sheet mới -> tính lại cảnh báo
    if (thuMuc) {
      var goc = DriveApp.getFolderById(thuMuc);
      Object.keys(THU_MUC_CON).forEach(function (tenCon) {
        var it = goc.getFoldersByName(tenCon); if (!it.hasNext()) return;
        var tepIt = it.next().getFiles();
        while (tepIt.hasNext()) {
          var tep = tepIt.next(), ma = tep.getId() + '@' + tep.getLastUpdated().toISOString() + (PHIEN_BAN_DOC[THU_MUC_CON[tenCon]] || '');
          if (daDoc[ma] || /^_tam_/.test(tep.getName())) continue;
          coMoi = true;
          try { napTep_(g, THU_MUC_CON[tenCon], tep, ma); }
          catch (e) { ghiLoi_(g, THU_MUC_CON[tenCon], tep, ma, e.message); }
          daDoc[ma] = new Date().toISOString();
          p.setProperty('DA_DOC', JSON.stringify(daDoc));
        }
      });
    }
    // Google Sheet Emart và Bảng giá: đọc lại khi có thay đổi
    [['EMART_SHEET_ID', 'emart'], ['GIA_SHEET_ID', 'gia_ban']].forEach(function (x) {
      var id = thongSo_(x[0]); if (!id) return;
      var f = DriveApp.getFileById(id), ma = id + '@' + f.getLastUpdated().toISOString();
      if (daDoc[ma]) return;
      coMoi = true;
      try { napSheet_(g, x[1], id, f.getName(), ma, f.getLastUpdated().toISOString()); }
      catch (e) { ghiLoi_(g, x[1], f, ma, e.message); }
      Object.keys(daDoc).forEach(function (k) { if (k.indexOf(id + '@') === 0) delete daDoc[k]; });   // chỉ giữ bản mới nhất của sheet
      daDoc[ma] = new Date().toISOString();
      p.setProperty('DA_DOC', JSON.stringify(daDoc));
    });
    // Tính sẵn cảnh báo sụt giảm sức nhập / sức bán cho trang Tổng quan (mất khoảng 10 giây)
    if (coMoi) { try { goi_(g, 'canh_bao', [], {}); console.log('Đã tính lại cảnh báo sụt giảm'); } catch (e) { console.log('Chưa tính được cảnh báo: ' + e.message); } }
  } finally { khoa.releaseLock(); }
}

/** Đọc lại toàn bộ (khi cần nạp lại từ đầu): quên danh sách đã đọc rồi chạy. */
function napLaiTatCa() { PropertiesService.getScriptProperties().deleteProperty('DA_DOC'); dongBoDuLieu(); }

// ---------- bên trong ----------
function giaTriTep_(tep) {
  if (tep.getMimeType() === MimeType.GOOGLE_SHEETS) return SpreadsheetApp.openById(tep.getId()).getSheets()[0].getDataRange().getValues();
  if (!/\.xlsx?$/i.test(tep.getName())) throw new Error('Không phải file Excel / Google Sheet');
  var tam = Drive.Files.create({ name: '_tam_' + tep.getName(), mimeType: MimeType.GOOGLE_SHEETS }, tep.getBlob());   // đổi Excel sang Google Sheet tạm
  try { return SpreadsheetApp.openById(tam.id).getSheets()[0].getDataRange().getValues(); }
  finally { DriveApp.getFileById(tam.id).setTrashed(true); }
}
function goi_(g, loai, du_lieu, thong_tin) {
  var r = UrlFetchApp.fetch(g.url + '/rest/v1/rpc/nap_nguon', { method: 'post', contentType: 'application/json', headers: { apikey: g.khoa },
    payload: JSON.stringify({ ma: g.ma, loai: loai, du_lieu: du_lieu, thong_tin: thong_tin || {} }), muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('Supabase trả lỗi ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300));
  return Number(r.getContentText());
}
function goiTheoLo_(g, loai, rows, thong_tin) {
  var tong = 0, co = 4000;
  for (var i = 0; i < Math.max(rows.length, 1); i += co) {
    var tt = JSON.parse(JSON.stringify(thong_tin || {})); tt.lam_moi = i === 0 && tt.lam_moi !== false; if (i > 0) { delete tt.tep; delete tt.ten_tep; }
    tong += goi_(g, loai, rows.slice(i, i + co), tt);
  }
  return tong;
}
function ghiLoi_(g, loai, tep, ma, loi) {
  console.log('LỖI ' + tep.getName() + ': ' + loi);
  try { goi_(g, loai === 'so_ban_hang' ? 'sellin' : loai === 'coop' ? 'coop_ban' : loai, [], { tep: ma, ten_tep: tep.getName(), loi: String(loi).slice(0, 500), lam_moi: false }); } catch (e) { console.log('Không ghi được nhật ký: ' + e.message); }
}
function napTep_(g, loai, tep, ma) {
  if (loai === 'kiem_ton') { console.log('Bỏ qua (chặng sau mới đọc file kiểm tồn): ' + tep.getName()); return; }
  var v = giaTriTep_(tep);
  if (loai === 'so_ban_hang') {
    var s = docSoBanHang(v);
    if (s.loi.length) throw new Error(s.loi.join(' | '));
    if (!s.sellin.length) throw new Error('Không có dòng bán hàng nào');
    var n = goiTheoLo_(g, 'sellin', s.sellin, { tu: s.tu, den: s.den, tep: ma, ten_tep: tep.getName(), ten: 'Sell-in (giao vào)',
      mo_ta: 'Sổ chi tiết bán hàng theo ngày × hệ thống × mã hàng; tiền chưa gồm thuế GTGT', nguon_cap_nhat: new Date().toISOString() });
    goiTheoLo_(g, 'don_hang', s.don_hang, { tu: s.tu, den: s.den });
    goiTheoLo_(g, 'sellin_ch', s.sellin_ch || [], { tu: s.tu, den: s.den });
    console.log('Đã nạp sổ bán hàng ' + s.tu + ' → ' + s.den + ': ' + n + ' dòng (' + tep.getName() + ')');
  } else if (loai === 'coop') {
    var c = docFileCoop(v, tep.getName());
    if (c.loi.length && !c.coop_ban.length) throw new Error(c.loi.join(' | '));
    goi_(g, 'coop_sku', c.coop_sku, {}); goi_(g, 'coop_ch', c.coop_ch, {});
    var m = goiTheoLo_(g, 'coop_ban', c.coop_ban, { ky: c.ky, tep: ma, ten_tep: tep.getName(), ten: 'Co.op bán ra',
      mo_ta: 'Theo kỳ file Co.op × cửa hàng × SKU, có tồn cuối kỳ; doanh số theo giá vốn Co.op', nguon_cap_nhat: new Date().toISOString(),
      loi: c.loi.join(' | ') });
    console.log('Đã nạp Co.op kỳ ' + c.ky + ': ' + m + ' dòng (' + tep.getName() + ')');
  }
}
function napSheet_(g, loai, id, ten, ma, sua) {
  var ss = SpreadsheetApp.openById(id), tabs = {};
  ss.getSheets().forEach(function (sh) { tabs[sh.getName()] = sh.getDataRange().getValues(); });
  if (loai === 'emart') {
    var e = docEmartSellOut(tabs); if (!e.emart_tuan.length) throw new Error('Không đọc được số bán nào. ' + e.loi.join(' | '));
    var n = goiTheoLo_(g, 'emart', e.emart_tuan, { tep: ma, ten_tep: ten, ten: 'Emart bán ra', nguon_cap_nhat: sua,
      mo_ta: 'Theo tuần trong tháng (1–7, 8–14, …) hoặc kỳ của tab T10, T11 × điểm bán × sản phẩm; doanh số theo giá bán lẻ sau KM' });
    console.log('Đã nạp Emart: ' + n + ' dòng');
  } else {
    var gb = docBangGia(tabs); if (!gb.gia_ban.length) throw new Error('Không đọc được dòng giá nào. ' + gb.loi.join(' | '));
    var m = goiTheoLo_(g, 'gia_ban', gb.gia_ban, { tep: ma, ten_tep: ten, ten: 'Bảng giá siêu thị', nguon_cap_nhat: sua, loi: gb.loi.join(' | '),
      mo_ta: 'Hệ thống × sản phẩm: giá bán cho siêu thị, mức giảm, trading term, TVP thu về, giá vốn, lãi gộp, giá bán lẻ' });
    console.log('Đã nạp bảng giá: ' + m + ' dòng');
  }
}

/** Thử đọc (không gửi gì): in tóm tắt để đối chiếu. */
function thuDocNguon() {
  var p = PropertiesService.getScriptProperties();
  [['EMART_SHEET_ID', 'emart'], ['GIA_SHEET_ID', 'gia']].forEach(function (x) {
    var id = thongSo_(x[0]); if (!id) return; var tabs = {};
    SpreadsheetApp.openById(id).getSheets().forEach(function (sh) { tabs[sh.getName()] = sh.getDataRange().getValues(); });
    if (x[1] === 'emart') { var e = docEmartSellOut(tabs), t = {}; e.emart_tuan.forEach(function (r) { var k = r.tuan.slice(0, 7); t[k] = (t[k] || 0) + r.sl; });
      console.log('Emart: ' + e.emart_tuan.length + ' dòng; sản lượng theo tháng ' + JSON.stringify(t)); }
    else { var gb = docBangGia(tabs), h = {}; gb.gia_ban.forEach(function (r) { h[r.he_thong] = (h[r.he_thong] || 0) + 1; });
      console.log('Bảng giá: ' + gb.gia_ban.length + ' dòng ' + JSON.stringify(h) + (gb.loi.length ? ' · lỗi: ' + gb.loi.join(' | ') : '')); console.log('Mẫu: ' + JSON.stringify(gb.gia_ban[0])); }
  });
}
