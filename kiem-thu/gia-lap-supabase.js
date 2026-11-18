(function(){
// Supabase giả lập để chạy giao diện không cần mạng. Dữ liệu nằm trong window.__DB, tải lại trang là về ban đầu.
// Thêm ?email=... vào địa chỉ để đăng nhập bằng người khác (mặc định a@x.com – quản lý).
let seq=0;
const DB={nhan_hang:[{id:1,ten:'Wil',thu_tu:1,dang_dung:true},{id:2,ten:'Gungon',thu_tu:2,dang_dung:true}],
he_thong:[{id:1,ten:'Co.op',thu_tu:1,dang_dung:true}],
thanh_vien:[{email:'a@x.com',ho_ten:'An',vai_tro:'quan_ly'},{email:'t@x.com',ho_ten:'Chị Thương',vai_tro:'thanh_vien'},{email:'tien@x.com',ho_ten:'Tiên',vai_tro:'thanh_vien'},{email:'k@x.com',ho_ten:'Khách A',vai_tro:'khach'}],
quy_trinh:[{id:'q1',ten:'CTKM catalogue',mo_ta:'mô tả',thu_tu:1}],
quy_trinh_buoc:[{id:'s1',quy_trinh_id:'q1',thu_tu:1,ten:'Nhận lịch',vai_tro:'Sales MT',moc:'bat_dau',so_ngay:-60,ket_qua:'x'},{id:'s2',quy_trinh_id:'q1',thu_tu:2,ten:'Đánh giá',vai_tro:'Trade MKT',moc:'ket_thuc',so_ngay:21,ket_qua:''}],
hoat_dong:[{id:'h1',ten:'CTKM Tết Co.op',nhan_hang_id:1,he_thong_id:1,ngay_bat_dau:'2026-12-01',ngay_ket_thuc:'2026-12-20',quy_trinh_ten:'CTKM'}],buoc_cong_viec:[
{id:'b1',hoat_dong_id:'h1',thu_tu:1,ten:'A',nguoi_lam:'Chị Thương',han:'2026-11-10',trang_thai:'xong',ngay_xong:'2026-11-10'},
{id:'b2',hoat_dong_id:'h1',thu_tu:2,ten:'B',nguoi_lam:'Chị Thương',han:'2026-11-12',trang_thai:'dang_lam',ngay_xong:null},
{id:'b3',hoat_dong_id:'h1',thu_tu:3,ten:'C',nguoi_lam:'Tiên',han:'2026-11-09',trang_thai:'chua_lam',ngay_xong:null},
{id:'b4',hoat_dong_id:'h1',thu_tu:4,ten:'D',nguoi_lam:'Tiên',han:'2026-11-11',trang_thai:'xong',ngay_xong:'2026-11-12'},
{id:'b5',hoat_dong_id:'h1',thu_tu:5,ten:'E',nguoi_lam:'',han:'2026-11-20',trang_thai:'chua_lam',ngay_xong:null}],
lich_post:[], dong_bo_lich:[], sell_out:[], sell_in:[], dong_bo_so_ban:[], gia_ban:[]};
window.__DB=DB;
const MAC_DINH={buoc_cong_viec:{trang_thai:'chua_lam',ngay_xong:null,ket_qua:'',ghi_chu:'',nguoi_lam:'',vai_tro:'',nguoi_duyet:'',ly_do_tra:'',ngay_nop:null},
};
// Bảng tổng hợp (view) giống trên Supabase
function nhom(rows, khoa, cong){ const g=new Map(); rows.forEach(r=>{ const k=khoa.map(c=>r[c]).join('|'); let o=g.get(k); if(!o){ o={}; khoa.forEach(c=>o[c]=r[c]); o._ch=new Set(); o._sku=new Set(); g.set(k,o); } cong(o,r); }); return [...g.values()]; }
function view(ten){
  const so=(o,r)=>{ o.so_luong=(o.so_luong||0)+(+r.so_luong||0); o.doanh_so=(o.doanh_so||0)+(+r.doanh_so||0); if(r.ton!=null) o.ton=(o.ton||0)+(+r.ton); if(+r.so_luong>0){ o._ch.add(r.ma_cua_hang+'|'+r.cua_hang); o._sku.add(r.ma_sku); } if(r.ten_sku) o.ten_sku=r.ten_sku; };
  const xong=(arr,sku)=>arr.map(({_ch,_sku,...x})=>({...x, ton:x.ton??null, so_cua_hang_ban:_ch.size, ...(sku?{}:{so_sku_ban:_sku.size})}));
  if(ten==='sell_out_ky_sku') return xong(nhom(DB.sell_out,['chuoi','nhan_hang','ky','tu_ngay','den_ngay','ma_sku'],so),true);
  if(ten==='sell_out_ky_nhan') return xong(nhom(DB.sell_out,['chuoi','nhan_hang','ky','tu_ngay','den_ngay'],so),false);
  if(ten==='gia_ban_cong_khai') return DB.gia_ban.map(x=>({id:x.id,he_thong:x.he_thong,chuoi:x.chuoi,nhan_hang:x.nhan_hang,san_pham:x.san_pham,giam:x.giam,trading_term:x.trading_term,gia_le:x.gia_le,ghi_chu:x.ghi_chu_cong_khai}));
  if(ten==='sell_in_ngay') return nhom(DB.sell_in,['chuoi','nhan_hang','ngay'],(o,r)=>{ o.so_luong=(o.so_luong||0)+(+r.so_luong||0); o.tra_lai_sl=(o.tra_lai_sl||0)+(+r.tra_lai_sl||0); o.doanh_so=(o.doanh_so||0)+(+r.doanh_so||0); }).map(({_ch,_sku,...x})=>x);
}
function qb(table){ let op='select',payload=null,filters=[],single=false,conflict=null,lim=null,ord=null,rg=null,cot='*',dem=false,chiDem=false,motDong=false;
 const b={select(c,o){ if(c) cot=c; if(o&&o.count) dem=true; if(o&&o.head) chiDem=true; return b},maybeSingle(){motDong=true;return b},order(k,o){ord=[k,o&&o.ascending===false];return b},range(a,z){rg=[a,z];return b},limit(n){lim=n;return b},
 eq(k,v){filters.push(r=>r[k]===v);return b}, gte(k,v){filters.push(r=>r[k]>=v);return b}, lte(k,v){filters.push(r=>r[k]<=v);return b}, in(k,v){filters.push(r=>v.includes(r[k]));return b},
 insert(p){op='insert';payload=p;return b},upsert(p,o){op='upsert';payload=p;conflict=(o&&o.onConflict||'').split(',');return b},
 update(p){op='update';payload=p;return b},delete(){op='delete';return b},single(){single=true;return b},
 then(res,rej){ return new Promise((ok,ko)=>{ try{ const match=r=>filters.every(f=>f(r)); let data;
  const laKhach=(DB.thanh_vien.find(m=>m.email===email)||{}).vai_tro==='khach';
  if(table==='gia_ban' && laKhach && op==='select'){ setTimeout(()=>ok({data:[],error:null}),5); return; }   // giống RLS: khách không đọc bảng giá đầy đủ
  const bang=['sell_out_ky_sku','sell_out_ky_nhan','sell_in_ngay','gia_ban_cong_khai'].includes(table)?view(table):(DB[table]||(table.startsWith('nguon_')||table.startsWith('ds_')||table==='dong_bo_so_ban'?[]:undefined));
  if(!bang) throw new Error('Không có bảng '+table);
  if(op==='select'){ data=bang.filter(match).map(r=>({...r})); if(ord) data.sort((x,y)=>(x[ord[0]]>y[ord[0]]?1:x[ord[0]]<y[ord[0]]?-1:0)*(ord[1]?-1:1)); if(lim) data=data.slice(0,lim); if(rg) data=data.slice(rg[0],rg[1]+1);
    if(cot!=='*'){ const ds=cot.split(',').map(x=>x.trim()).filter(Boolean).map(x=>{ const p=x.split(':'); return p.length>1?[p[0],p[1]]:[x,x]; }); data=data.map(r=>{ const o={}; ds.forEach(([a,c])=>o[a]=r[c]); return o; }); } }
  if(op==='insert'){ data=(Array.isArray(payload)?payload:[payload]).map(p=>({id:'id'+(++seq),...(MAC_DINH[table]||{}),...p})); DB[table].push(...data); }
  if(op==='upsert'){ data=[]; (Array.isArray(payload)?payload:[payload]).forEach(p=>{ const cu=DB[table].find(r=>conflict.every(k=>r[k]===p[k])); if(cu) Object.assign(cu,p); else DB[table].push({id:'id'+(++seq),...p}); }); }
  if(op==='update'){ DB[table].filter(match).forEach(r=>Object.assign(r,payload)); data=[]; }
  if(op==='delete'){ const gone=DB[table].filter(match); DB[table]=DB[table].filter(r=>!match(r));
    if(table==='hoat_dong') DB.buoc_cong_viec=DB.buoc_cong_viec.filter(s=>!gone.some(g=>g.id===s.hoat_dong_id));
    if(table==='quy_trinh') DB.quy_trinh_buoc=DB.quy_trinh_buoc.filter(s=>!gone.some(g=>g.id===s.quy_trinh_id));
    data=[]; }
  const soDong=Array.isArray(data)?bang.filter(match).length:null;
  if(single) data=data[0]; if(motDong) data=data[0]||null; if(chiDem) data=null;
  setTimeout(()=>ok({data,error:null,count:dem?soDong:null}),5);
 }catch(e){ setTimeout(()=>ok({data:null,error:{message:e.message}}),5); } }).then(res,rej) }}; return b; }
const email=new URLSearchParams(location.search).get('email')||'a@x.com';
const client={from:qb,rpc:async()=>({data:true,error:null}),
 auth:{onAuthStateChange(){},getSession:async()=>({data:{session:{user:{id:'u',email}}}}),signOut:async()=>{}},
 channel(){return {on(){return this},subscribe(){return this}}},removeChannel(){}};
window.supabase={createClient:()=>client};
})();
