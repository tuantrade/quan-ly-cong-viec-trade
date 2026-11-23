/* THANH CHUYỂN TRANG BÊN TRÁI – dùng chung cho app (index.html), Báo cáo MT (bao-cao-mt.html), Lịch post 2027.
 * Hai trang chính: TRANG LÀM VIỆC (Tổng quan, Hoạt động, Lịch việc, Lịch post) và TRANG BÁO CÁO.
 * Đặt <script src="thanh-ben.js"></script> ngay sau thẻ <body>.
 * Màn hình rộng: thanh cố định bên trái. Điện thoại: nút "☰" mở thanh trượt ra.
 * App (index.html) tự bật/tắt thanh theo đăng nhập (lớp co-thanh-ben trên body); các trang báo cáo luôn hiện. */
(function () {
  // Giao diện sáng / tối người dùng đã chọn (nút ở đầu app), áp cho mọi trang
  try { var cdm = localStorage.getItem('cheDoMau'); if (cdm) document.documentElement.dataset.theme = cdm; } catch (e) {}
  // Trang báo cáo đang mở trong khung của app: không vẽ thanh riêng, ẩn hàng tab và đầu trang trùng với app
  var trongApp = false; try { trongApp = window.self !== window.top; } catch (e) { trongApp = true; }
  if (trongApp) {
    var s0 = document.createElement('style');
    s0.textContent = '.sv-tabs{display:none!important}.bc-top img,.bc-top a[href="./#tong-quan"],#bc-ai{display:none!important}.bc-top{border:0!important;background:transparent!important;padding:2px 4px!important}';
    document.head.appendChild(s0);
    document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a[href^="./"]'); if (a) { e.preventDefault(); window.top.location.href = a.href; } });   // link về app: mở ở cửa sổ ngoài
    return;
  }
  var duong = location.pathname.split('/').pop() || 'index.html';
  var laKhachAnDanh = /[?&]khach=1/.test(location.search);   // vào bằng nút Khách: chỉ thấy Trang báo cáo
  var TRANG = /bao-cao-mt\.html$/.test(duong) ? 'bao-cao' : /lich-post-2027\.html$/.test(duong) ? 'lich-2027' : 'app';
  var MAC_DINH = { app: 'tong-quan', 'bao-cao': 'sell-in', 'lich-2027': '' };
  var NHOM = [
    { ten: 'Trang làm việc', muc: [
      { ten: 'Tổng quan', trang: 'app', v: 'tong-quan', href: './#tong-quan', ic: 'nha' },
      { ten: 'Hoạt động', trang: 'app', v: 'hoat-dong', href: './#hoat-dong', ic: 'viec' },
      { ten: 'Lịch việc', trang: 'app', v: 'lich-viec', href: './#lich-viec', ic: 'lich' },
      { ten: 'Lịch post', trang: 'app', v: 'lich-post', href: './#lich-post', ic: 'post' },
      { ten: 'Lịch post 2027', trang: 'app', v: 'lich-post-2027', href: './#lich-post-2027', ic: 'sao' } ] },   // nay mở ngay trong app, trình bày như Lịch post
    { ten: 'Trang báo cáo', muc: [
      { ten: 'Sell-in', trang: 'bao-cao', v: 'sell-in', href: 'bao-cao-mt.html#sell-in', ic: 'vao' },
      { ten: 'Sell-out', trang: 'bao-cao', v: 'sell-out', href: 'bao-cao-mt.html#sell-out', ic: 'ra' },
      { ten: 'Baseline bán trơn', trang: 'bao-cao', v: 'baseline', href: 'bao-cao-mt.html#baseline', ic: 'nen' },
      { ten: 'Giá bán & TVP thu về', trang: 'bao-cao', v: 'gia', href: 'bao-cao-mt.html#gia', ic: 'gia' } ] },
      // Bảng giá siêu thị (./#gia) đã ẩn: trùng nội dung với Giá bán & TVP thu về. Trang vẫn mở được bằng link ./#gia
    { ten: 'Thiết lập', muc: [
      { ten: 'Quy trình mẫu', trang: 'app', v: 'quy-trinh', href: './#quy-trinh', ic: 'mau' },
      { ten: 'Thành viên', trang: 'app', v: 'thanh-vien', href: './#thanh-vien', ic: 'nguoi' } ] }
  ];
  // Biểu tượng nét mảnh (24×24), màu theo chữ
  var IC = {
    nha: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    viec: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
    lich: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    post: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M7 14h6M7 17h9"/>',
    sao: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M12 12.5l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z"/>',
    vao: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    ra: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    nen: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
    gia: '<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    mau: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    nguoi: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.7.8 2.8 2.6 3 5.2"/>'
  };
  function icon(k) { return IC[k] ? '<svg class="tb-ic" viewBox="0 0 24 24" aria-hidden="true">' + IC[k] + '</svg>' : ''; }

  var css = [
    '#thanhBen{position:fixed;top:0;left:0;bottom:0;width:212px;z-index:30;display:none;flex-direction:column;gap:2px;overflow-y:auto;',
    '  padding:14px 10px 20px;box-sizing:border-box;background:var(--surface,var(--color-panel,#fff));border-right:1px solid var(--line,var(--color-border-line,#dde3dc));',
    '  font-family:inherit;font-size:14px}',
    'body.co-thanh-ben #thanhBen{display:flex}',
    '#thanhBen .tb-logo{display:flex;align-items:center;gap:8px;padding:2px 8px 12px;color:var(--ink,var(--color-fg,#1c2621));text-decoration:none;font-weight:700;font-size:15px;font-family:"Noto Serif",Georgia,serif}',
    '#thanhBen .tb-logo img{width:30px;height:auto}',
    '#thanhBen .tb-nhom{margin:12px 8px 4px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,var(--color-fg-muted,#5d6a63))}',
    '#thanhBen .tb-nhom:first-of-type{margin-top:2px}',
    '#thanhBen .tb-ic{width:17px;height:17px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;opacity:.85}',
    '#thanhBen a.tb-muc{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:8px;color:var(--muted,var(--color-fg-muted,#5d6a63));text-decoration:none;font-weight:500;line-height:1.3}',
    '#thanhBen a.tb-muc:hover{background:var(--soft,rgba(127,127,127,.12));color:var(--ink,var(--color-fg,#1c2621))}',
    '#thanhBen a.tb-muc[aria-current="page"]{background:var(--accent-soft,rgba(47,122,79,.14));color:var(--accent,#2f7a4f);font-weight:600}',
    '#thanhBen a.tb-muc[hidden]{display:none}',
    '#thanhBen .tb-ke{height:1px;background:var(--line,var(--color-border-line,#dde3dc));margin:8px 6px 0}',
    '#tbNut{display:none;position:fixed;top:10px;left:10px;z-index:31;width:38px;height:38px;border-radius:9px;cursor:pointer;font-size:18px;line-height:1;',
    '  border:1px solid var(--line,var(--color-border-line,#dde3dc));background:var(--surface,var(--color-panel,#fff));color:var(--ink,var(--color-fg,#1c2621))}',
    '#tbNen{display:none;position:fixed;inset:0;z-index:29;background:rgba(0,0,0,.35)}',
    '@media (min-width:900px){',
    '  body.co-thanh-ben{padding-left:212px}',
    '  body.co-thanh-ben .long-den.trai{left:222px}',
    '}',
    '@media (max-width:899px){',
    '  body.co-thanh-ben #thanhBen{transform:translateX(-100%);transition:transform .2s ease;box-shadow:0 0 24px rgba(0,0,0,.2)}',
    '  body.co-thanh-ben.tb-mo #thanhBen{transform:none}',
    '  body.co-thanh-ben.tb-mo #tbNen{display:block}',
    '  body.co-thanh-ben #tbNut{display:block}',
    '  #thanhBen .tb-logo{padding-left:50px;min-height:30px}',
    '  body.co-thanh-ben > header .bar, body.co-thanh-ben .bc-top{padding-left:58px}',
    '}',
    '@media (prefers-reduced-motion:reduce){ #thanhBen{transition:none!important} }',
    /* Trang báo cáo: thanh bên thay cho hàng tab và link "Về app" */
    'body.co-thanh-ben .sv-tabs{display:none}',
    'body.co-thanh-ben .bc-top a[href="./#tong-quan"]{display:none}'
  ].join('\n');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var html = '<button id="tbNut" type="button" aria-label="Mở menu chuyển trang" aria-controls="thanhBen" aria-expanded="false">☰</button>' +
    '<div id="tbNen"></div><nav id="thanhBen" aria-label="Chuyển trang">' +
    '<a class="tb-logo" href="./#tong-quan"><img src="logo-tvp.png" alt="">Trade MKT</a>' +
    NHOM.filter(function (g) { return !laKhachAnDanh || g.ten === 'Trang báo cáo'; }).map(function (g, i) {
      return (i ? '<div class="tb-ke"></div>' : '') + '<div class="tb-nhom">' + g.ten + '</div>' +
        g.muc.map(function (m) {
          // Mục báo cáo: mở trong app (#bc-...), trừ khi đang ở chính trang bao-cao-mt.html mở riêng
          var t = m.trang, v = m.v, href;
          if (t === 'bao-cao' && TRANG !== 'bao-cao') { t = 'app'; v = 'bc-' + m.v; }
          if (t === TRANG && v) href = '#' + v;            // mục cùng trang: chỉ đổi phần #, không tải lại trang
          else if (t === 'app') href = './#' + v;
          else href = m.href;
          return '<a class="tb-muc" href="' + href + '" data-trang="' + t + '" data-muc="' + v + '"' + (t === 'app' ? ' data-v="' + v + '"' : '') + '>' + icon(m.ic) + '<span>' + m.ten + '</span></a>';
        }).join('');
    }).join('') + '</nav>';
  if (laKhachAnDanh) html = html.replace('</nav>', '<div class="tb-ke"></div><a class="tb-muc" href="./">Đăng nhập</a><div class="tb-nhom" style="text-transform:none;letter-spacing:0;font-weight:500">Bạn đang xem với tư cách khách</div></nav>');
  document.body.insertAdjacentHTML('afterbegin', html);

  function capNhat() {
    var v = location.hash.replace('#', '').split('/')[0] || MAC_DINH[TRANG];
    document.querySelectorAll('#thanhBen a.tb-muc').forEach(function (a) {
      var dung = a.dataset.trang === TRANG && (TRANG === 'lich-2027' || a.dataset.muc === v);
      a.setAttribute('aria-current', dung ? 'page' : 'false');
    });
  }
  function dong() { document.body.classList.remove('tb-mo'); document.getElementById('tbNut').setAttribute('aria-expanded', 'false'); }
  document.getElementById('tbNut').addEventListener('click', function () {
    var mo = document.body.classList.toggle('tb-mo'); this.setAttribute('aria-expanded', String(mo));
  });
  document.getElementById('tbNen').addEventListener('click', dong);
  document.getElementById('thanhBen').addEventListener('click', function (e) { if (e.target.closest('a')) dong(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') dong(); });
  window.addEventListener('hashchange', capNhat);
  if (TRANG !== 'app') document.body.classList.add('co-thanh-ben');   // app bật thanh sau khi đăng nhập
  capNhat();
  window.thanhBen = { capNhat: capNhat, hien: function (co) { document.body.classList.toggle('co-thanh-ben', !!co); if (!co) dong(); } };
})();
