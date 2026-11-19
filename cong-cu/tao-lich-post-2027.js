/**
 * GHÉP TRANG "LỊCH POST 2027" TỪ TRANG DASHBOARD
 * Lấy nguyên mã trang của dashboard "Lịch post Tết 2027 – 4 hệ thống MT" (files/index.html trong kho của dashboard),
 * đặt vào khung cong-cu/khung-lich-post-2027.html (lớp thay cho bộ máy dashboard, lấy lịch từ Supabase),
 * ghi ra lich-post-2027.html ở thư mục gốc của app.
 *   node cong-cu/tao-lich-post-2027.js <file index.html của dashboard (hoặc file .json Claude tải về)>
 * Số lịch không nằm trong trang: nạp vào Supabase (bo_so_tinh_san, bộ "lich_post_2027"). Đổi giao diện: tải lại files/index.html rồi chạy lại lệnh này.
 */
const fs = require('fs'), path = require('path');
const nguon = process.argv[2]; if (!nguon) { console.log('Cách dùng: node cong-cu/tao-lich-post-2027.js <index.html của dashboard>'); process.exit(1); }
let trang = fs.readFileSync(nguon, 'utf8');
if (/\.json$/i.test(nguon)) { const j = JSON.parse(trang); trang = (j.data || j).text; }
trang = trang.normalize('NFC');   // chữ Việt dựng sẵn, tránh dấu bị tách khi hiện bằng font có chân
const khung = fs.readFileSync(path.join(__dirname, 'khung-lich-post-2027.html'), 'utf8');
if (!khung.includes('<!--TRANG_DASHBOARD-->')) throw new Error('Khung thiếu chỗ đặt trang');
// Không cho trang tham chiếu tài nguyên ngoài (giống quy định của dashboard)
if (/<script[^>]+src=/i.test(trang)) throw new Error('Trang dashboard có script ngoài, cần xem lại');
const ra = khung.replace('<!--TRANG_DASHBOARD-->', () => trang);
const dich = path.join(__dirname, '..', 'lich-post-2027.html');
fs.writeFileSync(dich, ra);
console.log('Đã tạo', dich, '·', Math.round(ra.length / 1024), 'KB');
