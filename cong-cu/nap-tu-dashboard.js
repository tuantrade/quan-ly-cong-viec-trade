/**
 * NẠP LẦN ĐẦU: đổ số gốc đang có trong dashboard "Data Sell-in/out kênh bán MT" vào Supabase
 * và khởi tạo danh mục tên sản phẩm. Sau lần này, script Google tự nạp file mới từ thư mục Drive.
 *
 *  1. Tải các bộ dữ liệu của dashboard về một thư mục (Claude làm: Artifact read từng file .json),
 *     đặt tên: sellin.json, don_hang.json, coop_ban.json, coop_sku.json, coop_ch.json, emart_tuan.json, gia_ban.json
 *  2. Chạy:  node cong-cu/nap-tu-dashboard.js <thư mục> [--gui]
 *     Không có --gui: chỉ đọc và tóm tắt. Có --gui: gửi lên Supabase, cần biến môi trường MA_BI_MAT.
 *     Tùy chọn EMART_XLSX=<file tải về của sheet Emart> để lấy thêm tên gốc trên sheet cho danh mục.
 * Dùng lại được khi muốn nạp lại toàn bộ từ dashboard (mỗi loại số được thay theo kỳ / thay hết).
 */
const fs = require('fs'), path = require('path');
const URL_SB = 'https://nuaiqosmnteroepiuica.supabase.co';
const KHOA = 'sb_publishable_GEVruYpDArUAKPn77762dA_PH-dwL2J';
const doc = (dir, ten) => { const f = path.join(dir, ten + '.json'); if (!fs.existsSync(f)) return null;
  const j = JSON.parse(fs.readFileSync(f, 'utf8')); return Array.isArray(j) ? j : (j.rows || j.data || []); };
const khoaTen = s => String(s || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();

async function nap(loai, du_lieu, thong_tin) {
  const ma = process.env.MA_BI_MAT; if (!ma) throw new Error('Thiếu MA_BI_MAT');
  const r = await fetch(URL_SB + '/rest/v1/rpc/nap_nguon', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: KHOA },
    body: JSON.stringify({ ma, loai, du_lieu, thong_tin }) });
  const t = await r.text(); if (r.status !== 200) throw new Error(loai + ': Supabase trả ' + r.status + ' ' + t); return Number(t);
}
async function napTheoLo(loai, rows, thong_tin, co = 5000) {
  let tong = 0; for (let i = 0; i < Math.max(rows.length, 1); i += co) tong += await nap(loai, rows.slice(i, i + co), { ...thong_tin, lam_moi: i === 0 && thong_tin.lam_moi !== false });
  console.log(`  ${loai}: ${tong}/${rows.length} dòng`); return tong;
}

(async () => {
  const dir = process.argv[2]; if (!dir) { console.log('Cách dùng: node cong-cu/nap-tu-dashboard.js <thư mục> [--gui]'); process.exit(1); }
  const gui = process.argv.includes('--gui');
  const sellin = doc(dir, 'sellin') || [], don = doc(dir, 'don_hang') || [], coop = doc(dir, 'coop_ban') || [], sku = doc(dir, 'coop_sku') || [],
        ch = doc(dir, 'coop_ch') || [], emart = doc(dir, 'emart_tuan') || [], gia = doc(dir, 'gia_ban') || [];

  // Danh mục tên sản phẩm
  const dm = [];
  sku.forEach(s => s.san_pham && dm.push({ nguon: 'coop_sku', ten_goc: String(s.ma_sku_coop), san_pham: s.san_pham, brand: s.brand || '', ma_hang_tvp: s.ma_hang_tvp || '', ten_hang_tvp: s.ten_hang_tvp || '' }));
  gia.forEach(g => g.san_pham && dm.push({ nguon: 'gia:' + g.he_thong, ten_goc: g.ten_bang_gia, san_pham: g.san_pham, brand: g.brand || '' }));
  const tenEmart = [...new Set(emart.map(e => e.san_pham))];
  tenEmart.forEach(t => dm.push({ nguon: 'emart', ten_goc: t, san_pham: t }));            // tên ngắn trỏ về chính nó
  const THEM_EMART = { 'trà thơm dừa dừa hawaii': 'Trà thơm dừa', 'trà cam ổi': 'Trà cam ổi ruby' };   // tên trên sheet khác tên ngắn
  if (process.env.EMART_XLSX) {
    const XLSX = require(process.env.XLSX_LIB || 'xlsx'); const wb = XLSX.readFile(process.env.EMART_XLSX);
    const tenSheet = new Set(); wb.SheetNames.forEach(t => { const r = XLSX.utils.sheet_to_json(wb.Sheets[t], { header: 1, defval: '' }); const c = (r[0] || []).findIndex(x => String(x).trim() === 'Sản phẩm'); if (c >= 0) r.slice(1).forEach(v => v[c] && tenSheet.add(String(v[c]).trim())); });
    tenSheet.forEach(t => { const k = khoaTen(t); const ngan = THEM_EMART[k] || tenEmart.find(x => khoaTen(x) === k); if (ngan) dm.push({ nguon: 'emart', ten_goc: t, san_pham: ngan }); else console.log('  Tên Emart chưa ghép được:', t); });
  } else Object.entries(THEM_EMART).forEach(([g, n]) => dm.push({ nguon: 'emart', ten_goc: g, san_pham: n }));
  const dmGon = [...new Map(dm.map(x => [x.nguon + '|' + (x.nguon === 'coop_sku' ? x.ten_goc : khoaTen(x.ten_goc)), x])).values()];

  const ky = [...new Set(coop.map(r => r.ky))].sort(), ngaySi = sellin.map(r => r.ngay).sort(), ngayDon = don.map(r => r.ngay).sort();
  console.log(`Danh mục: ${dmGon.length} tên · Sell-in: ${sellin.length} dòng (${ngaySi[0]} → ${ngaySi[ngaySi.length - 1]}) · Đơn: ${don.length} · Co.op: ${coop.length} dòng, ${ky.length} kỳ · Cửa hàng Co.op: ${ch.length} · SKU Co.op: ${sku.length} · Emart: ${emart.length} · Bảng giá: ${gia.length}`);
  if (!gui) return;

  await napTheoLo('danh_muc', dmGon, { lam_moi: false });
  await napTheoLo('sellin', sellin, { tu: ngaySi[0], den: ngaySi[ngaySi.length - 1], ten: 'Sell-in (giao vào)', mo_ta: 'Sổ chi tiết bán hàng theo ngày × hệ thống × mã hàng; tiền chưa gồm thuế GTGT', tep: 'dashboard:sellin', ten_tep: 'Nạp lần đầu từ dashboard' });
  await napTheoLo('don_hang', don, { tu: ngayDon[0], den: ngayDon[ngayDon.length - 1] });
  await napTheoLo('coop_sku', sku.map(s => ({ ma_sku_coop: String(s.ma_sku_coop), ten_hang_coop: s.ten_hang_coop || '' })), { lam_moi: false });
  await napTheoLo('coop_ch', ch.map(c => ({ ...c, ma_ch: String(c.ma_ch) })), { lam_moi: false });
  for (const k of ky) await napTheoLo('coop_ban', coop.filter(r => r.ky === k).map(r => ({ ...r, sku: String(r.sku), ch: String(r.ch) })),
    { ky: k, ten: 'Co.op bán ra', mo_ta: 'Theo kỳ file Co.op × cửa hàng × SKU, có tồn cuối kỳ; doanh số theo giá vốn Co.op', tep: 'dashboard:coop:' + k, ten_tep: 'Nạp lần đầu từ dashboard (' + k + ')' });
  await napTheoLo('emart', emart, { ten: 'Emart bán ra', mo_ta: 'Theo tuần trong tháng (1–7, 8–14, …) hoặc kỳ của tab T10, T11 × điểm bán × sản phẩm; doanh số theo giá bán lẻ sau KM', tep: 'dashboard:emart', ten_tep: 'Nạp lần đầu từ dashboard' });
  await napTheoLo('gia_ban', gia.map(g => ({ he_thong: g.he_thong, brand: g.brand, ten_bang_gia: g.ten_bang_gia, gia_mua: g.gia_mua, giam: g.giam, trading_term: g.trading_term,
    tvp_nhan: g.tvp_nhan, gia_von: g.gia_von, ln_tvp: g.ln_tvp, ty_le_ln: g.ty_le_ln, gia_le: g.gia_le, le_tren_mua: g.le_tren_mua, ghi_chu: g.ghi_chu })),
    { ten: 'Bảng giá siêu thị', mo_ta: 'Hệ thống × sản phẩm: giá bán cho siêu thị, mức giảm, trading term, TVP thu về, giá vốn, lãi gộp, giá bán lẻ', tep: 'dashboard:gia', ten_tep: 'Nạp lần đầu từ dashboard' });
  console.log('Xong.');
})().catch(e => { console.error('LỖI:', e.message); process.exit(1); });
