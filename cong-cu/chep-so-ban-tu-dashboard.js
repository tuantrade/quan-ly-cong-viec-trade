/**
 * CHÉP SỐ BÁN TỪ DASHBOARD "Data Sell-in/out kênh bán MT" SANG SUPABASE (cho trang Số bán của app)
 *
 * Dashboard nằm trên Claude, app không đọc thẳng được. Mỗi lần dashboard có số mới:
 *  1. Tải các bộ dữ liệu của dashboard về một thư mục (Claude làm: Artifact read từng file .json):
 *       coop_ban.json, coop_sku.json, coop_ch.json, emart_tuan.json, sellin.json
 *     (tên file đúng như trên; nội dung là mảng dòng, hoặc {rows: [...]})
 *  2. Chạy:  node cong-cu/chep-so-ban-tu-dashboard.js <thư mục dữ liệu> [--gui]
 *     - Không có --gui: chỉ đọc, tóm tắt, ghi ra <thư mục>/da-chuyen.json để kiểm tra.
 *     - Có --gui: gửi lên Supabase. Cần biến môi trường MA_BI_MAT (mã trong bảng cau_hinh_nhac).
 *     - Tùy chọn: CAP_NHAT_<NGUON>="..." (vd CAP_NHAT_COOP) = thời điểm dashboard cập nhật bộ đó.
 * Mỗi nguồn được thay toàn bộ, không cộng dồn.
 */
const fs = require('fs'), path = require('path');
const URL_SB = 'https://nuaiqosmnteroepiuica.supabase.co';
const KHOA = 'sb_publishable_GEVruYpDArUAKPn77762dA_PH-dwL2J';

// Tên hệ thống trong sổ bán hàng / dashboard -> tên hệ thống trong app ('' = app chưa có)
const HE_THONG = {
  'Co.opMart': 'Co.op', 'Co.op Food': 'Co.op', 'Co.op Finelife': 'Co.op', 'Co.op Xtra': 'Co.op',
  'Emart': 'Emart', 'Lotte Mart': 'Lotte', 'GO! / Big C': 'GO/BigC', 'Bách Hóa Xanh': 'BHX',
  'WinMart / WinMart+': 'WinMart/WinMart+', 'King Food Market': 'King Food'
};
const NHAN = { wil: 'Wil', gungon: 'Gungon', guyumi: 'Guyumi', 'mabay': 'Má Bảy' };
const boDau = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]/g, '');
const nhan = s => NHAN[boDau(s)] || '';
const tenGon = s => String(s || '').replace(/\s*\(.*$/, '').replace(/\s+/g, ' ').trim();   // bỏ phần quy cách trong ngoặc
const so = v => (v === '' || v == null || isNaN(Number(v))) ? 0 : Number(v);

function doc(dir, ten) {
  const f = path.join(dir, ten + '.json');
  if (!fs.existsSync(f)) return null;
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  return Array.isArray(j) ? j : (j.rows || j.data || j.results || []);
}

function chuyen(dir) {
  const out = { sell_out: {}, sell_in: null };
  // Co.op: kỳ "2026-01-01_2026-01-31" × SKU Co.op × mã cửa hàng
  const coop = doc(dir, 'coop_ban');
  if (coop) {
    const sku = new Map((doc(dir, 'coop_sku') || []).map(x => [String(x.ma_sku_coop), x]));
    const ch = new Map((doc(dir, 'coop_ch') || []).map(x => [String(x.ma_ch), x]));
    out.sell_out.coop = coop.map(r => {
      const [tu, den] = String(r.ky).split('_'); const s = sku.get(String(r.sku)) || {}; const c = ch.get(String(r.ch)) || {};
      return { chuoi: 'Co.op', ky: 'T' + Number(tu.slice(5, 7)) + '/' + tu.slice(0, 4), tu_ngay: tu, den_ngay: den,
        ma_cua_hang: String(r.ch), cua_hang: c.ten_ch || String(r.ch), loai_cua_hang: c.loai_ch || '',
        nhan_hang: nhan(s.brand), ma_sku: String(r.sku), ten_sku: tenGon(s.ten_hang_tvp) || s.ten_hang_coop || String(r.sku),
        so_luong: so(r.sl_ban), doanh_so: so(r.gt_ban), ton: r.sl_ton == null ? null : so(r.sl_ton), gia_tri_ton: r.gt_ton == null ? null : so(r.gt_ton) };
    });
  }
  // Emart: tuần trong tháng × cửa hàng × sản phẩm (không có mã SKU: dùng tên sản phẩm làm mã)
  const emart = doc(dir, 'emart_tuan');
  if (emart) out.sell_out.emart = emart.map(r => ({ chuoi: 'Emart', ky: String(r.tuan), tu_ngay: r.tu, den_ngay: r.den,
    ma_cua_hang: '', cua_hang: r.diem_ban || '', loai_cua_hang: '', nhan_hang: nhan(r.brand),
    ma_sku: tenGon(r.san_pham), ten_sku: tenGon(r.san_pham), so_luong: so(r.sl), doanh_so: so(r.doanh_so), ton: null, gia_tri_ton: null }));
  // Sell-in: ngày × hệ thống × mã hàng TVP
  const si = doc(dir, 'sellin');
  if (si) out.sell_in = si.map(r => ({ ngay: r.ngay, he_thong: r.he_thong || '', chuoi: HE_THONG[r.he_thong] || '', nhan_hang: nhan(r.brand),
    ma_hang: r.ma_hang || '', ten_hang: tenGon(r.ten_hang), so_luong: so(r.sl_ban), tra_lai_sl: so(r.sl_tra),
    doanh_so: so(r.doanh_so), chiet_khau: so(r.chiet_khau), tra_lai: so(r.tra_lai) }));
  return out;
}

const TEN = { coop: ['Co.op bán ra', 'Theo tháng × cửa hàng × SKU, có tồn cuối kỳ; doanh số theo giá vốn Co.op'],
  emart: ['Emart bán ra', 'Theo tuần trong tháng (ngày 1–7, 8–14, …) × cửa hàng × sản phẩm; doanh số theo giá bán lẻ sau KM'],
  sellin: ['Sell-in (giao vào)', 'Sổ chi tiết bán hàng theo ngày × hệ thống × mã hàng; tiền chưa gồm thuế GTGT'] };

async function gui(bang, nguon, rows) {
  const ma = process.env.MA_BI_MAT; if (!ma) throw new Error('Thiếu MA_BI_MAT');
  let tong = 0;
  for (let i = 0; i < Math.max(rows.length, 1); i += 5000) {
    const r = await fetch(URL_SB + '/rest/v1/rpc/dong_bo_so_ban', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: KHOA },
      body: JSON.stringify({ ma, bang, nguon, lam_moi: i === 0, du_lieu: rows.slice(i, i + 5000), ten: TEN[nguon][0], mo_ta: TEN[nguon][1],
        nguon_cap_nhat: process.env['CAP_NHAT_' + nguon.toUpperCase()] || '' }) });
    const t = await r.text(); if (r.status !== 200) throw new Error(nguon + ': Supabase trả ' + r.status + ' ' + t);
    tong += Number(t); process.stdout.write(`  ${nguon}: ${tong}/${rows.length}\r`);
  }
  console.log(`  ${nguon}: đã chép ${tong}/${rows.length} dòng`);
}

(async () => {
  const dir = process.argv[2]; if (!dir) { console.log('Cách dùng: node cong-cu/chep-so-ban-tu-dashboard.js <thư mục dữ liệu> [--gui]'); process.exit(1); }
  const d = chuyen(dir);
  for (const [n, rows] of Object.entries(d.sell_out)) {
    const ky = [...new Set(rows.map(r => r.ky))]; const thieuNhan = rows.filter(r => !r.nhan_hang).length;
    console.log(`${TEN[n][0]}: ${rows.length} dòng · ${ky.length} kỳ (${rows.reduce((m, r) => r.tu_ngay < m ? r.tu_ngay : m, '9')} → ${rows.reduce((m, r) => r.den_ngay > m ? r.den_ngay : m, '0')}) · SL ${rows.reduce((m, r) => m + r.so_luong, 0)}${thieuNhan ? ' · ' + thieuNhan + ' dòng chưa rõ nhãn' : ''}`);
  }
  if (d.sell_in) console.log(`Sell-in: ${d.sell_in.length} dòng · ${d.sell_in.filter(r => !r.chuoi).length} dòng hệ thống app chưa có (giữ tên gốc)`);
  fs.writeFileSync(path.join(dir, 'da-chuyen.json'), JSON.stringify(d));
  if (process.argv.includes('--gui')) {
    for (const [n, rows] of Object.entries(d.sell_out)) await gui('sell_out', n, rows);
    if (d.sell_in) await gui('sell_in', 'sellin', d.sell_in);
    console.log('Xong.');
  }
})().catch(e => { console.error('LỖI:', e.message); process.exit(1); });
