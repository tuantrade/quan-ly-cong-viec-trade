/**
 * ĐỌC NGUỒN SỐ LIỆU (hàm thuần: nhận bảng giá trị 2 chiều, trả về các dòng số)
 * Dùng trong Apps Script (dong-bo-du-lieu.gs) và thử được trên máy bằng Node.
 * Quy tắc theo cách đang làm cho dashboard "Data Sell-in/out kênh bán MT".
 *
 *  docSoBanHang(values)      -> Sổ chi tiết bán hàng (phần mềm kế toán)  => {tu, den, sellin[], don_hang[], bo_qua{}, loi[]}
 *  docFileCoop(values)       -> File bán ra – tồn kho Co.op gửi           => {tu, den, ky, coop_ban[], coop_ch[], coop_sku[], loi[]}
 *  docEmartSellOut(tabs)     -> Google Sheet "[EMART] SELL OUT THÁNG"     => {emart_tuan[], loi[]}
 *  docBangGia(tabs)          -> Google Sheet "Bảng Giá Siêu Thị"          => {gia_ban[], loi[]}
 * `tabs` là {tênTab: values}. Ô ngày có thể là Date, số ngày Excel, hoặc chữ dd/mm/yyyy.
 */

// ---------- tiện ích chung ----------
var NGAY_FMT = (typeof Utilities !== 'undefined')
  ? function (d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
  : function (d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
function chu_(v) { return String(v == null ? '' : v).normalize('NFC').replace(/\s+/g, ' ').trim(); }
function thuong_(v) { return chu_(v).toLowerCase(); }
function so_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var t = String(v == null ? '' : v).replace(/\s/g, '');
  if (!t || /^-+$/.test(t)) return 0;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');          // 1,234.50
  else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); // 1.234,50
  else t = t.replace(',', '.');
  var n = Number(t.replace(/%$/, '')); if (isNaN(n)) return 0;
  return /%$/.test(t) ? n / 100 : n;
}
// Làm tròn kiểu “chẵn gần nhất” (giống cách dashboard đang làm tròn số Co.op)
function lamTron_(x) { var f = Math.floor(x), d = x - f; if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1; return Math.round(x); }
function soHoacTrong_(v) { var t = chu_(v); return (!t || /^-+$/.test(t)) ? null : so_(v); }
function ngay_(v) {
  if (v instanceof Date) return NGAY_FMT(v);
  if (typeof v === 'number' && v > 20000 && v < 90000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10);
  var t = chu_(v), m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : '';
}
function themNgay_(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
function soNgay_(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5) + 1; }
function cuoiThang_(ym) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); }
function timCot_(hang, mau) { for (var i = 0; i < hang.length; i++) if (mau.test(chu_(hang[i]))) return i; return -1; }
function boDau_(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase(); }

// ---------- nhãn hàng ----------
var BRAND_TU = [['wil', 'Wil'], ['gungon', 'Gungon'], ['guyumi', 'Guyumi'], ['má bảy', 'Má Bảy']];
function brandTheoTen_(ten) {
  var t = thuong_(ten);
  for (var i = 0; i < BRAND_TU.length; i++) if (new RegExp('(^|[^\\p{L}])' + BRAND_TU[i][0] + '([^\\p{L}]|$)', 'u').test(t)) return BRAND_TU[i][1];
  if (t === 'chiết khấu') return 'Không theo brand';                 // dòng chiết khấu chung trên hóa đơn (mã CK)
  if (t.indexOf('xốt ướp bbq') >= 0 && t.indexOf('dhd') >= 0) return 'Gungon';
  return null;
}
function brandChuan_(b) { var k = boDau_(b).replace(/[^a-z]/g, ''); return { wil: 'Wil', gungon: 'Gungon', guyumi: 'Guyumi', mabay: 'Má Bảy' }[k] || chu_(b); }

// ---------- 1. SỔ CHI TIẾT BÁN HÀNG ----------
var SYS_NHOM = { 'MTBHX': 'Bách Hóa Xanh', 'MTCOOP': 'Co.opMart', 'MTCOOP;SUP4': 'Co.opMart', 'MTCOOP.FOOD': 'Co.op Food', 'CTM2;WINCOM': 'WinMart / WinMart+',
  'SUP4;WINCOM': 'WinMart / WinMart+', 'MTLOTTE': 'Lotte Mart', 'CTM2;MTLOTTE': 'Lotte Mart', 'MTEMART': 'Emart', 'MTKINGFOOD': 'King Food Market',
  'MTHOMEFARM': 'Homefarm', 'MTMINISTOP': 'Ministop', 'MTOSI': 'Nhật Minh Bakery' };
var SYS_TEN = [['FINELIFE', 'Co.op Finelife'], ['DỊCH VỤ EB', 'GO! / Big C'], ['MEGA MARKET', 'MM Mega Market'], ['WINCOMMERCE', 'WinMart / WinMart+'],
  ['LOTTE', 'Lotte Mart'], ['BÁCH HÓA XANH', 'Bách Hóa Xanh'], ['THISO', 'Emart'], ['KING FOOD', 'King Food Market'], ['HOMEFARM', 'Homefarm'],
  ['MINISTOP', 'Ministop'], ['GIA ĐÌNH VIỆT NAM', 'FamilyMart'], ['NHẬT MINH', 'Nhật Minh Bakery'], ['THỰC PHẨM SAIGON CO.OP', 'Co.op Food'], ['CO.OP FOOD', 'Co.op Food'],
  ['CO.OP', 'Co.opMart'], ['CO-OP', 'Co.opMart'], ['CO. OP', 'Co.opMart'], ['SÀI GÒN', 'Co.opMart'], ['LIÊN HIỆP HỢP TÁC XÃ THƯƠNG MẠI', 'Co.opMart'],
  ['MARSIX', 'Co.opMart'], ['MARFOUR', 'Co.opMart'], ['ĐỒNG THỊNH', 'Co.opMart'], ['TRUNG MỸ TÂY', 'Co.opMart'], ['BÌNH ĐÔNG', 'Co.opMart'], ['AN ĐÔNG', 'Co.opMart']];
function heThongSo_(nhom, tenKhach) {
  var n = chu_(tenKhach).toUpperCase(), g = chu_(nhom);
  if (!g || g.split(';').indexOf('CTM2') >= 0 || n.indexOf('FINELIFE') >= 0)
    for (var i = 0; i < SYS_TEN.length; i++) if (n.indexOf(SYS_TEN[i][0]) >= 0) return SYS_TEN[i][1];
  return SYS_NHOM[g] || null;
}
// (Trước đây chỉ giữ số theo cửa hàng cho Lotte, GO; nay giữ cho mọi hệ thống.)
function docSoBanHang(values) {
  var loi = [], tu = '', den = '';
  for (var r = 0; r < Math.min(6, values.length) && !tu; r++) {
    var t = chu_(values[r][0]), m = t.match(/Từ ngày (\d\d\/\d\d\/\d{4}) đến ngày (\d\d\/\d\d\/\d{4})/i);
    if (m) { tu = ngay_(m[1]); den = ngay_(m[2]); }
    else if ((m = t.match(/Tháng (\d{1,2}) năm (\d{4})/i))) { tu = m[2] + '-' + ('0' + m[1]).slice(-2) + '-01'; den = cuoiThang_(tu.slice(0, 7)); }
  }
  var h = -1; for (var r2 = 0; r2 < Math.min(10, values.length) && h < 0; r2++) if (timCot_(values[r2], /^Mã hàng$/i) >= 0 && timCot_(values[r2], /^Tên hàng$/i) >= 0) h = r2;
  if (h < 0) return { loi: ['Không thấy dòng tiêu đề có cột “Mã hàng”, “Tên hàng”'], sellin: [], don_hang: [] };
  var H = values[h], c = {
    ngay: timCot_(H, /^Ngày chứng từ$/i), so_ct: timCot_(H, /^Số chứng từ$/i), dien_giai: timCot_(H, /^Diễn giải chung$/i), nhom: timCot_(H, /^Mã nhóm khách hàng$/i),
    khach: timCot_(H, /^Tên khách hàng$/i), ma: timCot_(H, /^Mã hàng$/i), ten: timCot_(H, /^Tên hàng$/i), dvt: timCot_(H, /^ĐVT$/i),
    sl: timCot_(H, /^Tổng số lượng bán$/i), sl_tra: timCot_(H, /^Tổng số lượng trả lại$/i), ds: timCot_(H, /^Doanh số bán$/i),
    ck: timCot_(H, /^Chiết khấu$/i), tl: timCot_(H, /^Giá trị trả lại$/i) };
  var thieu = Object.keys(c).filter(function (k) { return c[k] < 0 && k !== 'nhom'; });
  if (thieu.length) return { loi: ['Thiếu cột: ' + thieu.join(', ')], sellin: [], don_hang: [] };
  if (!tu) { // không có dòng kỳ: lấy theo ngày chứng từ nhỏ nhất / lớn nhất
    for (var r3 = h + 1; r3 < values.length; r3++) { var d0 = ngay_(values[r3][c.ngay]); if (d0) { if (!tu || d0 < tu) tu = d0; if (!den || d0 > den) den = d0; } }
  }
  var gom = {}, gomCh = {}, don = {}, boQua = {}, thieuHT = {}, thieuBR = {};
  for (var i = h + 1; i < values.length; i++) {
    var v = values[i], ma = chu_(v[c.ma]); if (!ma) continue;
    var ten = chu_(v[c.ten]), br = brandTheoTen_(ten), dsv = so_(v[c.ds]), tlv = so_(v[c.tl]);
    if (!br) { if (Math.abs(dsv) + Math.abs(tlv) > 0) thieuBR[ten] = 1; else boQua[ten] = (boQua[ten] || 0) + so_(v[c.sl]); continue; }
    var ht = heThongSo_(c.nhom >= 0 ? v[c.nhom] : '', v[c.khach]);
    if (!ht) { thieuHT[chu_(c.nhom >= 0 ? v[c.nhom] : '') + ' / ' + chu_(v[c.khach])] = 1; continue; }
    var ngay = ngay_(v[c.ngay]); if (!ngay) { loi.push('Dòng ' + (i + 1) + ': không đọc được ngày chứng từ'); continue; }
    var soCt = chu_(v[c.so_ct]), laBT = /^BT/.test(soCt), laDoi = !laBT && dsv === 0, sl = so_(v[c.sl]);
    var k = [ngay, ht, br, ma, ten, chu_(v[c.dvt])].join('|');
    var o = gom[k] || (gom[k] = { ngay: ngay, thang: ngay.slice(0, 7), he_thong: ht, brand: br, ma_hang: ma, ten_hang: ten, dvt: chu_(v[c.dvt]),
      sl_ban: 0, sl_tra: 0, sl_doi: 0, doanh_so: 0, chiet_khau: 0, tra_lai: 0 });
    if (laDoi) o.sl_doi += sl; else o.sl_ban += sl;
    o.sl_tra += so_(v[c.sl_tra]); o.doanh_so += dsv; o.chiet_khau += so_(v[c.ck]); o.tra_lai += tlv;
    if (!laDoi) {   // giữ thêm số theo điểm nhận hàng (mọi hệ thống): dùng cho đối chiếu CTV (Lotte, GO) và bảng SKU lọc theo cửa hàng
      var dn = chu_(v[c.dien_giai]), kc = [ngay, ht, dn, br, ma].join('|');
      var oc = gomCh[kc] || (gomCh[kc] = { ngay: ngay, he_thong: ht, diem_nhan: dn, brand: br, ma_hang: ma, ten_hang: ten, sl_ban: 0, sl_tra: 0, doanh_so: 0, chiet_khau: 0, tra_lai: 0 });
      oc.sl_ban += sl; oc.sl_tra += so_(v[c.sl_tra]); oc.doanh_so += dsv; oc.chiet_khau += so_(v[c.ck]); oc.tra_lai += tlv;
    }
    if (!laBT && !laDoi) { var kd = ngay + '|' + ht + '|' + soCt; if (!don[kd]) don[kd] = { ngay: ngay, thang: ngay.slice(0, 7), he_thong: ht, diem_nhan: chu_(v[c.dien_giai]), so_chung_tu: soCt }; }
  }
  Object.keys(thieuHT).forEach(function (x) { loi.push('CHƯA BIẾT HỆ THỐNG: ' + x); });
  Object.keys(thieuBR).forEach(function (x) { loi.push('CHƯA BIẾT BRAND (có doanh số): ' + x); });
  var sellin = Object.keys(gom).map(function (k) { var o = gom[k]; ['doanh_so', 'chiet_khau', 'tra_lai'].forEach(function (f) { o[f] = Math.round(o[f]); }); return o; });
  var sellinCh = Object.keys(gomCh).map(function (k) { var o = gomCh[k]; ['doanh_so', 'chiet_khau', 'tra_lai'].forEach(function (f) { o[f] = Math.round(o[f]); }); return o; });
  return { tu: tu, den: den, sellin: sellin, sellin_ch: sellinCh, don_hang: Object.keys(don).map(function (k) { return don[k]; }), bo_qua: boQua, loi: loi };
}

// ---------- 2. FILE CO.OP (bán ra – tồn kho) ----------
var LOAI_CH_COOP = { CM: 'Co.opMart', CF: 'Co.op Food', Xtra: 'Co.op Xtra', FL: 'Finelife' };
function docFileCoop(values, tenTep) {
  var loi = [], tu = '', den = '';
  for (var r = 0; r < 3 && !tu; r++) {
    var m = chu_(values[r] && values[r][0]).match(/từ ngày (\d\d\/\d\d\/\d{4}) đến ngày (\d\d\/\d\d\/\d{4})/i);
    if (m) { tu = ngay_(m[1]); den = ngay_(m[2]); }
  }
  if (!tu) { // file không có dòng kỳ (VD Coop_ban-ra-ton_2026-08.xlsx): lấy tháng trong tên file, tính cả tháng
    var mt = String(tenTep || '').match(/(20\d\d)[-_.](\d\d)(?!\d)/);
    if (mt) { tu = mt[1] + '-' + mt[2] + '-01'; den = cuoiThang_(tu.slice(0, 7)); }
  }
  if (!tu) return { loi: ['Không thấy dòng “Doanh số bán từ ngày … đến ngày …” ở đầu file, tên file cũng không có tháng (VD 2026-08)'], coop_ban: [] };
  var h = -1; for (var r2 = 0; r2 < 6 && h < 0; r2++) if (timCot_(values[r2] || [], /^SKU$/i) >= 0 && timCot_(values[r2], /^MaST$/i) >= 0) h = r2;
  if (h < 0) return { loi: ['Không thấy dòng tiêu đề có cột SKU, MaST'], coop_ban: [] };
  var H = values[h], c = { sku: timCot_(H, /^SKU$/i), ten: timCot_(H, /^TenHang$/i), mast: timCot_(H, /^MaST$/i), tenst: timCot_(H, /^TenST$/i),
    sl: timCot_(H, /^Luong-TH$/i), gt: timCot_(H, /^TTVon-TH$/i), slt: timCot_(H, /^LuongTon$/i), gtt: timCot_(H, /^TriGiaTon$/i) };
  var ky = tu + '_' + den, ban = [], ch = {}, sku = {}, tong = { sl_ban: 0, gt_ban: 0, sl_ton: 0 };
  for (var i = h + 1; i < values.length; i++) {
    var v = values[i], s = chu_(v[c.sku]).replace(/\.0+$/, ''); if (!/^\d+$/.test(s)) continue;
    var maCh = chu_(v[c.mast]).replace(/\.0+$/, ''), tenCh = chu_(v[c.tenst]);
    var x = { ky: ky, sku: s, ch: maCh, sl_ban: lamTron_(so_(v[c.sl])), gt_ban: lamTron_(so_(v[c.gt])), sl_ton: lamTron_(so_(v[c.slt])), gt_ton: lamTron_(so_(v[c.gtt])) };
    tong.sl_ban += x.sl_ban; tong.gt_ban += x.gt_ban; tong.sl_ton += x.sl_ton;
    if (!sku[s]) sku[s] = { ma_sku_coop: s, ten_hang_coop: chu_(v[c.ten]) };
    if (!ch[maCh]) {
      var phan = tenCh.split(' - '), loai = '', vung = phan.length > 2 ? phan[phan.length - 1] : '';
      for (var p = 1; p < phan.length && !loai; p++) loai = LOAI_CH_COOP[phan[p].split(' ')[0]] || '';
      ch[maCh] = { ma_ch: maCh, ten_ch: tenCh, ky_ten: ky, loai_ch: loai, vung: ['LMX', 'BD', 'VT', 'MT', 'BN'].indexOf(vung) >= 0 ? vung : '' };
      if (!loai) loi.push('Chưa biết loại cửa hàng: ' + tenCh);
    }
    if (x.sl_ban || x.gt_ban || x.sl_ton || x.gt_ton) ban.push(x);       // bỏ các dòng toàn số 0
  }
  return { tu: tu, den: den, ky: ky, coop_ban: ban, coop_ch: Object.keys(ch).map(function (k) { return ch[k]; }),
    coop_sku: Object.keys(sku).map(function (k) { return sku[k]; }), tong: tong, loi: loi };
}

// ---------- 3. GOOGLE SHEET EMART SELL OUT ----------
// Tab "SELL OUT": mỗi dòng 1 ngày × điểm bán × sản phẩm -> cộng theo tuần trong tháng (1–7, 8–14, 15–21, 22–28, 29–cuối tháng)
// Tab "T10", "T11"…: cột Ngày ghi khoảng "01/11/2026-08/11/2026" -> mỗi khoảng là 1 kỳ; ngày đầu trùng kỳ trước thì bỏ
function cotEmart_(H) {
  return { ngay: timCot_(H, /^Ngày$/i), diem: timCot_(H, /^Điểm bán$/i), brand: timCot_(H, /^Brand$/i), sp: timCot_(H, /^Sản phẩm$/i),
    ctkm: timCot_(H, /^CTKM$/i), sl: timCot_(H, /^Sản lượng$/i), ds: timCot_(H, /^Doanh số$/i), ky_post: timCot_(H, /^Kỳ post$/i) };
}
function docEmartSellOut(tabs) {
  var loi = [], gom = {};
  function them(tuan, tu, den, nguon, v, c) {
    var diem = chu_(v[c.diem]), sp = chu_(v[c.sp]); if (!diem || !sp) return;
    var k = nguon + '|' + tuan + '|' + diem + '|' + sp;   // tách theo nguồn: tab theo ngày và tab theo kỳ không gộp lẫn nhau
    var o = gom[k] || (gom[k] = { tuan: tuan, tu: tu, den: den, so_ngay: soNgay_(tu, den), nguon: nguon, diem_ban: diem, brand: brandChuan_(v[c.brand]),
      san_pham: sp, sl: 0, doanh_so: 0, ctkm: '' });
    o.sl += so_(v[c.sl]); o.doanh_so += so_(v[c.ds]);
    var km = c.ctkm >= 0 ? chu_(v[c.ctkm]) : ''; if (km && o.ctkm.indexOf(km) < 0) o.ctkm = o.ctkm ? o.ctkm + '; ' + km : km;
  }
  Object.keys(tabs).forEach(function (ten) {
    var values = tabs[ten]; if (!values || !values.length) return;
    var c = cotEmart_(values[0]); if (c.ngay < 0 || c.sl < 0 || c.sp < 0) return;       // không phải tab số bán
    if (/^SELL OUT$/i.test(chu_(ten))) {
      for (var i = 1; i < values.length; i++) {
        var d = ngay_(values[i][c.ngay]); if (!d) continue;
        var day = +d.slice(8), ym = d.slice(0, 7), t = Math.min(5, Math.floor((day - 1) / 7) + 1);
        var tu = ym + '-' + ('0' + ((t - 1) * 7 + 1)).slice(-2), den = t < 5 ? ym + '-' + ('0' + t * 7).slice(-2) : cuoiThang_(ym);
        them(ym + '-T' + t, tu, den, 'SELL OUT (theo ngày)', values[i], c);
      }
    } else if (/^T\d{1,2}$/i.test(chu_(ten))) {
      var khoang = {};
      for (var j = 1; j < values.length; j++) {
        var m = chu_(values[j][c.ngay]).match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
        if (m) khoang[ngay_(m[1]) + '_' + ngay_(m[2])] = 1;
      }
      var ds = Object.keys(khoang).sort(), sua = {}, denTruoc = '';
      ds.forEach(function (k, idx) { var p = k.split('_'), a = p[0]; if (denTruoc && a <= denTruoc) a = themNgay_(denTruoc, 1); sua[k] = [a, p[1], idx + 1]; denTruoc = p[1]; });
      for (var j2 = 1; j2 < values.length; j2++) {
        var m2 = chu_(values[j2][c.ngay]).match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{4})/); if (!m2) continue;
        var s = sua[ngay_(m2[1]) + '_' + ngay_(m2[2])];
        them(s[0].slice(0, 7) + '-T' + s[2], s[0], s[1], chu_(ten) + ' (theo kỳ)', values[j2], c);
      }
    }
  });
  // Tháng đã có trong tab kỳ (T10, T11…) thì bỏ số theo ngày của tháng đó (tránh cộng trùng)
  var thangKy = {}; Object.keys(gom).forEach(function (k) { if (gom[k].nguon !== 'SELL OUT (theo ngày)') thangKy[gom[k].tu.slice(0, 7)] = 1; });
  var out = Object.keys(gom).map(function (k) { return gom[k]; }).filter(function (o) { return !(o.nguon === 'SELL OUT (theo ngày)' && thangKy[o.tu.slice(0, 7)]); });
  return { emart_tuan: out, loi: loi };
}

// ---------- 4. GOOGLE SHEET BẢNG GIÁ SIÊU THỊ ----------
var TAB_GIA = { 'EMART': 'Emart', 'GO': 'GO! / Big C', 'SG CO.OP': 'Co.op', 'LOTTE': 'Lotte Mart' };
function docBangGia(tabs) {
  var loi = [], out = [];
  Object.keys(tabs).forEach(function (ten) {
    var ht = TAB_GIA[chu_(ten).toUpperCase()]; if (!ht) return;
    var values = tabs[ten], h = -1;
    for (var r = 0; r < Math.min(8, values.length) && h < 0; r++) if (timCot_(values[r], /trading\s*term/i) >= 0) h = r;
    if (h < 0) { loi.push('Tab ' + ten + ': không thấy cột Trading Term'); return; }
    var H = values[h], c = { ten: timCot_(H, /^(Tên|Danh Mục)/i), mua: timCot_(H, /(Giá mua|Chưa VAT|ĐƠN GIÁ)/i), cost: timCot_(H, /^Cost$/i),
      tt: timCot_(H, /trading\s*term/i), giam: timCot_(H, /%\s*giảm/i) };
    if (c.mua >= 0 && /thùng/i.test(chu_(H[c.mua]))) c.mua = -1;
    for (var k2 = 0; k2 < H.length && c.mua < 0; k2++) if (/(giá|đơn giá)/i.test(chu_(H[k2])) && !/thùng/i.test(chu_(H[k2]))) c.mua = k2;
    var cotCuoi = 0; values.forEach(function (v, i) { if (i > h) for (var q = v.length - 1; q > cotCuoi; q--) if (chu_(v[q])) { cotCuoi = q; break; } });
    var brand = '';
    for (var i = h + 1; i < values.length; i++) {
      var v = values[i], tenSp = chu_(v[c.ten]);
      var dauDong = chu_(v[0]);
      if (dauDong && !tenSp && /^[\p{L} ]+$/u.test(dauDong)) { brand = brandChuan_(dauDong); continue; }    // dòng tên nhãn (GUNGON, WIL…)
      if (!tenSp || !brand) continue;
      var giaMua = soHoacTrong_(v[c.mua]), giam = c.giam >= 0 ? (soHoacTrong_(v[c.giam]) || 0) : 0, tt = soHoacTrong_(v[c.tt]),
          von = c.cost >= 0 ? soHoacTrong_(v[c.cost]) : null, le = cotCuoi > c.giam ? soHoacTrong_(v[cotCuoi]) : null;
      if (giam > 1) giam = giam / 100; if (tt != null && tt > 1) tt = tt / 100;
      var thu = giaMua != null && tt != null ? Math.round(giaMua * (1 - giam) * (1 - tt)) : null;
      var ln = thu != null && von != null ? Math.round(thu - von) : null;
      var ghi = [];
      if (le == null) ghi.push('Chưa có giá bán lẻ'); if (giaMua == null) ghi.push('Chưa có giá bán cho siêu thị'); if (von == null) ghi.push('Chưa có giá vốn');
      if (ln != null && ln < 0) ghi.push('TVP lỗ trên mỗi đơn vị sau trading term');
      if (le != null && giaMua) { if (le < giaMua) ghi.push('Giá bán lẻ thấp hơn giá siêu thị mua vào: cần kiểm tra lại'); else if (le / giaMua > 1.8) ghi.push('Giá bán lẻ cao bất thường so với giá mua (gấp hơn 1,8 lần): cần kiểm tra lại'); }
      out.push({ he_thong: ht, brand: brand, ten_bang_gia: tenSp, gia_mua: giaMua, giam: giam, trading_term: tt, tvp_nhan: thu, gia_von: von, ln_tvp: ln,
        ty_le_ln: ln != null && thu ? Math.round(ln / thu * 10000) / 10000 : null, gia_le: le, le_tren_mua: le != null && giaMua ? Math.round(le / giaMua * 1000) / 1000 : null,
        ghi_chu: ghi.join('; ') });
    }
  });
  return { gia_ban: out, loi: loi };
}

/**
 * File "CẬP NHẬT CTKM KÊNH MT 2026": mỗi tháng 1 tab (T1.2026 …), dòng tiêu đề có "KỲ POST" và "BRAND".
 * Mỗi dòng 1 sản phẩm; hệ thống, kỳ, thời gian PO, thời gian NTD, brand chỉ ghi ở dòng đầu khối -> điền xuống.
 * Trả về [{tab, he_thong, ky, po_tu, po_den, ntd_tu, ntd_den, brand, san_pham, co_cau, gia_thuong, gia_ck, fc, ds_act, ghi_chu}]
 */
function docCtkm(tabs) {
  var ra = [], loi = [];
  var khoang = function (v) { var m = chu_(v).match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{4})/); return m ? [ngay_(m[1]), ngay_(m[2])] : ['', '']; };
  Object.keys(tabs).forEach(function (ten) {
    if (!/^T\d{1,2}[.\/]\d{4}$/i.test(chu_(ten))) return;
    var v = tabs[ten], h = -1;
    for (var i = 0; i < Math.min(8, v.length); i++) if (v[i].some(function (x) { return /KỲ POST/i.test(chu_(x)); })) { h = i; break; }
    if (h < 0) { loi.push(ten + ': không thấy dòng tiêu đề'); return; }
    var H = v[h].map(function (x) { return boDau_(x); }), c = function (re) { for (var j = 0; j < H.length; j++) if (re.test(H[j])) return j; return -1; };
    var C = { ht: c(/he thong|chain/), ky: c(/ky post/), po: c(/giam po/), ntd: c(/giam gia ntd|ntd/), br: c(/^brand/), sp: c(/ten san pham/), cc: c(/co cau/),
              gt: c(/gia thuong/), gck: c(/gia ck/), fc: c(/fc so ban/), ds: c(/doanh so/), gc: c(/ghi chu/) };
    if (C.ky < 0 || C.sp < 0 || C.ntd < 0) { loi.push(ten + ': thiếu cột'); return; }
    var cur = { ht: '', ky: '', po: ['', ''], ntd: ['', ''], br: '' };
    for (var r = h + 1; r < v.length; r++) {
      var d = v[r], sp = chu_(d[C.sp]);
      if (C.ht >= 0 && chu_(d[C.ht])) { cur.ht = chu_(d[C.ht]); cur.br = ''; }
      if (chu_(d[C.ky])) { cur.ky = chu_(d[C.ky]); cur.br = ''; }
      if (C.po >= 0 && chu_(d[C.po])) cur.po = khoang(d[C.po]);
      if (chu_(d[C.ntd])) cur.ntd = khoang(d[C.ntd]);
      if (C.br >= 0 && chu_(d[C.br])) cur.br = brandChuan_(d[C.br]);
      if (!sp || !cur.ht || !cur.ntd[0]) continue;
      ra.push({ tab: chu_(ten), he_thong: cur.ht, ky: cur.ky, po_tu: cur.po[0], po_den: cur.po[1], ntd_tu: cur.ntd[0], ntd_den: cur.ntd[1], brand: cur.br, san_pham: sp,
        co_cau: C.cc >= 0 ? chu_(d[C.cc]) : '', gia_thuong: C.gt >= 0 ? so_(d[C.gt]) : null, gia_ck: C.gck >= 0 ? so_(d[C.gck]) : null,
        fc: C.fc >= 0 && chu_(d[C.fc]) ? so_(d[C.fc]) : null, ds_act: C.ds >= 0 && chu_(d[C.ds]) ? so_(d[C.ds]) : null, ghi_chu: C.gc >= 0 ? chu_(d[C.gc]) : '' });
    }
  });
  return { ctkm: ra, loi: loi };
}

if (typeof module !== 'undefined') module.exports = { docSoBanHang: docSoBanHang, docFileCoop: docFileCoop, docEmartSellOut: docEmartSellOut, docBangGia: docBangGia, docCtkm: docCtkm, so_: so_, ngay_: ngay_ };
