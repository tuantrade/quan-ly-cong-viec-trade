/**
 * NHẮC HẠN QUA EMAIL – Quản lý công việc Trade MKT (Trí Việt Phát)
 *
 * Mỗi sáng, script lấy các bước chưa xong từ Supabase và gửi email từ Gmail của bạn:
 *  - mỗi người làm nhận 1 thư chỉ có việc của mình: đang trễ, đến hạn hôm nay, sắp đến hạn;
 *  - người duyệt nhận thêm các bước đang chờ mình duyệt;
 *  - quản lý nhận thêm phần tổng hợp cả nhóm và danh sách bước chưa giao người hoặc tên không khớp thành viên;
 *  - ai không có việc cần nhắc thì không nhận thư.
 *
 * Cách cài đặt: xem README.md, mục "Nhắc hạn qua email".
 * Không dán khóa secret / service_role vào đây. Script chỉ cần khóa publishable và MÃ BÍ MẬT nhắc việc.
 */

// ---- Có thể sửa các giá trị này ----
var CAI_DAT = {
  GIO_GUI: 7,               // gửi trong khoảng 7h–8h sáng (giờ Việt Nam)
  SO_NGAY_TOI: 3,           // nhắc các việc đến hạn trong bao nhiêu ngày tới
  BO_QUA_CHU_NHAT: true,    // true = Chủ nhật không gửi
  TEN_NGUOI_GUI: 'Nhắc việc Trade MKT'
};

// ---- Các hàm bấm chạy trong Apps Script ----

/** Gửi thư nhắc thật cho mọi người. Hàm này được hẹn giờ chạy mỗi sáng. */
function guiNhacHan() {
  var g = layThongSo_();
  var d = layDuLieu_(g);
  if (CAI_DAT.BO_QUA_CHU_NHAT && laChuNhat_(d.ngay)) { console.log('Hôm nay Chủ nhật, không gửi.'); return; }
  var thu = lapThu_(d, g.link);
  guiCacThu_(thu, null);
}

/** Gửi THỬ: mọi thư được gửi về email của chính bạn để xem trước, không ai khác nhận. */
function guiThu() {
  var g = layThongSo_();
  var d = layDuLieu_(g);
  var thu = lapThu_(d, g.link);
  if (!thu.length) { console.log('Không có việc nào cần nhắc trong ' + CAI_DAT.SO_NGAY_TOI + ' ngày tới, nên không có thư nào.'); return; }
  guiCacThu_(thu, Session.getEffectiveUser().getEmail());
}

/** Bật hẹn giờ gửi mỗi sáng. Chạy 1 lần là đủ (chạy lại cũng không bị gửi trùng). */
function batHenGio() {
  tatHenGio();
  ScriptApp.newTrigger('guiNhacHan').timeBased().everyDays(1).atHour(CAI_DAT.GIO_GUI)
    .inTimezone('Asia/Ho_Chi_Minh').create();
  console.log('Đã bật: gửi nhắc hạn mỗi ngày khoảng ' + CAI_DAT.GIO_GUI + 'h–' + (CAI_DAT.GIO_GUI + 1) + 'h sáng.');
}

/** Tắt hẹn giờ (ngừng gửi). */
function tatHenGio() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'guiNhacHan') ScriptApp.deleteTrigger(t);
  });
}

// ---- Phần bên trong ----

function layThongSo_() {
  var p = PropertiesService.getScriptProperties();
  var g = {
    url: (p.getProperty('SUPABASE_URL') || '').trim().replace(/\/+$/, ''),
    khoa: (p.getProperty('SUPABASE_KHOA') || '').trim(),
    ma: (p.getProperty('MA_BI_MAT') || '').trim(),
    link: (p.getProperty('LINK_APP') || '').trim()
  };
  var thieu = [];
  if (!g.url) thieu.push('SUPABASE_URL');
  if (!g.khoa) thieu.push('SUPABASE_KHOA');
  if (!g.ma) thieu.push('MA_BI_MAT');
  if (thieu.length) throw new Error('Chưa điền trong Thuộc tính tập lệnh (Script properties): ' + thieu.join(', '));
  if (/service_role|sb_secret_/.test(g.khoa)) throw new Error('SUPABASE_KHOA phải là khóa publishable, KHÔNG dùng khóa secret / service_role.');
  if (g.link && !/\/$/.test(g.link)) g.link += '/';
  return g;
}

function layDuLieu_(g) {
  var r = UrlFetchApp.fetch(g.url + '/rest/v1/rpc/ds_nhac_viec', {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: g.khoa },
    payload: JSON.stringify({ ma: g.ma, so_ngay_toi: CAI_DAT.SO_NGAY_TOI }),
    muteHttpExceptions: true
  });
  var code = r.getResponseCode(), text = r.getContentText();
  if (code !== 200) {
    if (/Sai mã bí mật/.test(text)) throw new Error('MA_BI_MAT không đúng. Lấy lại mã trong Supabase: select ma_bi_mat from public.cau_hinh_nhac;');
    if (/ds_nhac_viec/.test(text)) throw new Error('Supabase chưa có hàm ds_nhac_viec. Hãy chạy lại file thiet-ke-co-so-du-lieu.sql.');
    throw new Error('Supabase trả lỗi ' + code + ': ' + text);
  }
  return JSON.parse(text);
}

function laChuNhat_(ymd) {
  var p = ymd.split('-');
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay() === 0;
}

function ngayVN_(ymd) {
  if (!ymd) return '';
  var p = ymd.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}

function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/** Phân loại 1 bước: chờ duyệt, hoặc theo số ngày trễ (>0 trễ, =0 hôm nay, <0 sắp đến hạn) */
function loai_(v) {
  if (v.trang_thai === 'cho_duyet') return 'duyet';
  return v.so_ngay_tre > 0 ? 'tre' : (v.so_ngay_tre === 0 ? 'homNay' : 'sapToi');
}

function bangViec_(ds, link, coNguoi) {
  var mau = { tre: '#b42318', homNay: '#b54708', sapToi: '#475467', duyet: '#6941c6' };
  var dong = ds.map(function (v) {
    var l = loai_(v);
    var tinhTrang = l === 'duyet'
      ? 'Chờ duyệt' + (v.ngay_nop ? ' (nộp ' + ngayVN_(v.ngay_nop) + ')' : '') + (v.so_ngay_tre > 0 ? ', trễ hạn ' + v.so_ngay_tre + ' ngày' : '')
      : (l === 'tre' ? 'Trễ ' + v.so_ngay_tre + ' ngày' : (l === 'homNay' ? 'Hạn hôm nay' : 'Còn ' + (-v.so_ngay_tre) + ' ngày'));
    var tenHd = link ? '<a href="' + esc_(link + '#hoat-dong/' + v.hoat_dong_id) + '">' + esc_(v.hoat_dong) + '</a>' : esc_(v.hoat_dong);
    return '<tr>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #eaecf0">' + esc_(v.buoc) + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #eaecf0">' + tenHd + '</td>' +
      (coNguoi ? '<td style="padding:6px 8px;border-bottom:1px solid #eaecf0">' + esc_(l === 'duyet' ? (v.nguoi_lam || 'Chưa giao') + ' nộp → ' + (v.nguoi_duyet || '') + ' duyệt' : (v.nguoi_lam || 'Chưa giao')) + '</td>' : '') +
      '<td style="padding:6px 8px;border-bottom:1px solid #eaecf0;white-space:nowrap">' + ngayVN_(v.han) + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #eaecf0;white-space:nowrap;color:' + mau[l] + ';font-weight:600">' + tinhTrang + '</td>' +
      '</tr>';
  }).join('');
  return '<table style="border-collapse:collapse;font-size:14px;width:100%;max-width:720px">' +
    '<tr style="background:#f2f4f7;text-align:left"><th style="padding:6px 8px">Bước</th><th style="padding:6px 8px">Hoạt động</th>' +
    (coNguoi ? '<th style="padding:6px 8px">Người làm</th>' : '') +
    '<th style="padding:6px 8px">Hạn</th><th style="padding:6px 8px">Tình trạng</th></tr>' + dong + '</table>';
}

function demLoai_(ds) {
  var d = { tre: 0, homNay: 0, sapToi: 0, duyet: 0 };
  ds.forEach(function (v) { d[loai_(v)]++; });
  return d;
}

/** Lập danh sách thư cần gửi: [{to, ten, subject, html}] */
function lapThu_(d, link) {
  var viec = d.viec || [];
  var theoEmail = {};
  viec.forEach(function (v) {
    if (!v.email) return;
    (theoEmail[v.email] = theoEmail[v.email] || { ten: v.ho_ten, ds: [] }).ds.push(v);
  });

  // Phần tổng hợp cho quản lý (chỉ số đếm)
  var theoNguoi = {};
  viec.forEach(function (v) {
    var ten = v.trang_thai === 'cho_duyet' ? v.nguoi_duyet : v.nguoi_lam;
    var k = v.email ? v.ho_ten : (String(ten || '').trim() ? ten + ' (không khớp thành viên)' : 'Chưa giao');
    var o = theoNguoi[k] = theoNguoi[k] || { tre: 0, homNay: 0, sapToi: 0, duyet: 0 };
    o[loai_(v)]++;
  });
  var khongCoEmail = viec.filter(function (v) { return !v.email; });
  var tongHop = '';
  if (viec.length) {
    var tenNguoi = Object.keys(theoNguoi).sort(function (a, b) { return a.localeCompare(b, 'vi'); });
    tongHop = '<h3 style="margin:24px 0 8px">Tổng hợp cả nhóm</h3>' +
      '<table style="border-collapse:collapse;font-size:14px"><tr style="background:#f2f4f7;text-align:left">' +
      '<th style="padding:6px 8px">Người làm</th><th style="padding:6px 8px">Đang trễ</th><th style="padding:6px 8px">Hạn hôm nay</th><th style="padding:6px 8px">' + CAI_DAT.SO_NGAY_TOI + ' ngày tới</th><th style="padding:6px 8px">Chờ người này duyệt</th></tr>' +
      tenNguoi.map(function (k) {
        var o = theoNguoi[k];
        return '<tr><td style="padding:6px 8px;border-bottom:1px solid #eaecf0">' + esc_(k) + '</td>' +
          '<td style="padding:6px 8px;border-bottom:1px solid #eaecf0;text-align:right;color:' + (o.tre ? '#b42318' : 'inherit') + '">' + o.tre + '</td>' +
          '<td style="padding:6px 8px;border-bottom:1px solid #eaecf0;text-align:right">' + o.homNay + '</td>' +
          '<td style="padding:6px 8px;border-bottom:1px solid #eaecf0;text-align:right">' + o.sapToi + '</td>' +
          '<td style="padding:6px 8px;border-bottom:1px solid #eaecf0;text-align:right">' + o.duyet + '</td></tr>';
      }).join('') + '</table>' +
      (khongCoEmail.length ? '<h3 style="margin:24px 0 8px">Bước chưa giao người hoặc tên không khớp thành viên (không ai nhận thư nhắc)</h3>' +
        bangViec_(khongCoEmail, link, true) : '');
  }

  var nguoiNhan = {};
  Object.keys(theoEmail).forEach(function (em) { nguoiNhan[em] = { ten: theoEmail[em].ten, ds: theoEmail[em].ds, quanLy: false }; });
  (d.quan_ly || []).forEach(function (q) {
    if (!viec.length) return;
    nguoiNhan[q.email] = nguoiNhan[q.email] || { ten: q.ho_ten, ds: [] };
    nguoiNhan[q.email].quanLy = true;
  });

  return Object.keys(nguoiNhan).sort().map(function (em) {
    var n = nguoiNhan[em], dem = demLoai_(n.ds);
    var phan = [];
    if (dem.tre) phan.push(dem.tre + ' việc trễ');
    if (dem.homNay) phan.push(dem.homNay + ' việc hạn hôm nay');
    if (dem.sapToi) phan.push(dem.sapToi + ' việc sắp đến hạn');
    if (dem.duyet) phan.unshift(dem.duyet + ' việc chờ bạn duyệt');
    var tieuDe = '[Trade MKT] ' + (phan.length ? phan.join(', ') : 'Tổng hợp việc của nhóm') + ' – ' + ngayVN_(d.ngay);
    var html = '<div style="font-family:Arial,sans-serif;color:#101828;line-height:1.5">' +
      '<p>Chào ' + esc_(n.ten) + ',</p>' +
      (n.ds.length
        ? (dem.duyet ? '<h3 style="margin:16px 0 8px">Chờ bạn duyệt</h3>' + bangViec_(n.ds.filter(function (v) { return loai_(v) === 'duyet'; }), link, true) : '') +
          (n.ds.length > dem.duyet ? '<p>Các bước công việc của bạn đang trễ hoặc đến hạn trong ' + CAI_DAT.SO_NGAY_TOI + ' ngày tới (tính đến ngày ' + ngayVN_(d.ngay) + '):</p>' +
            bangViec_(n.ds.filter(function (v) { return loai_(v) !== 'duyet'; }), link, false) : '')
        : '<p>Hôm nay bạn không có bước nào trễ hoặc sắp đến hạn.</p>') +
      (n.quanLy ? tongHop : '') +
      (link ? '<p style="margin-top:20px"><a href="' + esc_(link) + '">Mở app Quản lý công việc Trade MKT</a></p>' : '') +
      '<p style="color:#667085;font-size:12px;margin-top:20px">Thư tự động gửi mỗi sáng. Đánh dấu "Xong" trong app thì bước đó sẽ không còn được nhắc.</p>' +
      '</div>';
    return { to: em, ten: n.ten, subject: tieuDe, html: html };
  });
}

function guiCacThu_(thu, guiVeEmail) {
  var conLai = MailApp.getRemainingDailyQuota();
  if (thu.length > conLai) throw new Error('Gmail hôm nay chỉ còn gửi được ' + conLai + ' thư, cần ' + thu.length + ' thư.');
  thu.forEach(function (t) {
    MailApp.sendEmail({
      to: guiVeEmail || t.to,
      subject: guiVeEmail ? '[THỬ – gửi cho ' + t.to + '] ' + t.subject : t.subject,
      htmlBody: t.html,
      name: CAI_DAT.TEN_NGUOI_GUI
    });
    console.log('Đã gửi: ' + (guiVeEmail ? guiVeEmail + ' (thư thử của ' + t.to + ')' : t.to) + ' – ' + t.subject);
  });
  if (!thu.length) console.log('Không có việc nào cần nhắc, không gửi thư.');
}
