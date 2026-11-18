/**
 * GHÉP TRANG "BÁO CÁO MT" TỪ TRANG DASHBOARD
 * Lấy nguyên mã trang của dashboard "Data Sell-in/out kênh bán MT" (files/index.html trong kho của dashboard),
 * đặt vào khung cong-cu/khung-bao-cao-mt.html (lớp thay cho bộ máy dashboard, lấy số từ Supabase),
 * ghi ra bao-cao-mt.html ở thư mục gốc của app.
 *   node cong-cu/tao-bao-cao-mt.js <file index.html của dashboard (hoặc file .json Claude tải về)>
 * Khi dashboard đổi giao diện: tải lại files/index.html rồi chạy lại lệnh này.
 */
const fs = require('fs'), path = require('path');
const nguon = process.argv[2]; if (!nguon) { console.log('Cách dùng: node cong-cu/tao-bao-cao-mt.js <index.html của dashboard>'); process.exit(1); }
let trang = fs.readFileSync(nguon, 'utf8');
if (/\.json$/i.test(nguon)) { const j = JSON.parse(trang); trang = (j.data || j).text; }
const khung = fs.readFileSync(path.join(__dirname, 'khung-bao-cao-mt.html'), 'utf8');
if (!khung.includes('<!--TRANG_DASHBOARD-->')) throw new Error('Khung thiếu chỗ đặt trang');
// Không cho trang tham chiếu tài nguyên ngoài (giống quy định của dashboard)
if (/<script[^>]+src=/i.test(trang)) throw new Error('Trang dashboard có script ngoài, cần xem lại');
const ra = khung.replace('<!--TRANG_DASHBOARD-->', () => trang);
const dich = path.join(__dirname, '..', 'bao-cao-mt.html');
fs.writeFileSync(dich, ra);
console.log('Đã tạo', dich, '·', Math.round(ra.length / 1024), 'KB');
