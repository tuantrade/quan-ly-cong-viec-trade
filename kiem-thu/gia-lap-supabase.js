(function(){
let seq=0;
const DB={nhan_hang:[{id:1,ten:'Wil',thu_tu:1,dang_dung:true},{id:2,ten:'Gungon',thu_tu:2,dang_dung:true}],
he_thong:[{id:1,ten:'Co.op',thu_tu:1,dang_dung:true}],
thanh_vien:[{email:'a@x.com',ho_ten:'An',vai_tro:'quan_ly'}],
quy_trinh:[{id:'q1',ten:'CTKM catalogue',mo_ta:'mô tả',thu_tu:1}],
quy_trinh_buoc:[{id:'s1',quy_trinh_id:'q1',thu_tu:1,ten:'Nhận lịch',vai_tro:'Sales MT',moc:'bat_dau',so_ngay:-60,ket_qua:'x'},{id:'s2',quy_trinh_id:'q1',thu_tu:2,ten:'Đánh giá',vai_tro:'Trade MKT',moc:'ket_thuc',so_ngay:21,ket_qua:''}],
hoat_dong:[{id:'h1',ten:'CTKM Tết Co.op',nhan_hang_id:1,he_thong_id:1,ngay_bat_dau:'2026-12-01',ngay_ket_thuc:'2026-12-20',quy_trinh_ten:'CTKM'}],buoc_cong_viec:[
{id:'b1',hoat_dong_id:'h1',thu_tu:1,ten:'A',nguoi_lam:'Chị Thương',han:'2026-11-10',trang_thai:'xong',ngay_xong:'2026-11-10'},
{id:'b2',hoat_dong_id:'h1',thu_tu:2,ten:'B',nguoi_lam:'Chị Thương',han:'2026-11-12',trang_thai:'dang_lam',ngay_xong:null},
{id:'b3',hoat_dong_id:'h1',thu_tu:3,ten:'C',nguoi_lam:'Tiên',han:'2026-11-09',trang_thai:'chua_lam',ngay_xong:null},
{id:'b4',hoat_dong_id:'h1',thu_tu:4,ten:'D',nguoi_lam:'Tiên',han:'2026-11-11',trang_thai:'xong',ngay_xong:'2026-11-12'},
{id:'b5',hoat_dong_id:'h1',thu_tu:5,ten:'E',nguoi_lam:'',han:'2026-11-20',trang_thai:'chua_lam',ngay_xong:null}]};
window.__DB=DB;
function qb(table){ let op='select',payload=null,filters=[],single=false;
 const b={select(){return b},order(){return b},range(){return b},eq(k,v){filters.push([k,v]);return b},
 insert(p){op='insert';payload=p;return b},update(p){op='update';payload=p;return b},delete(){op='delete';return b},single(){single=true;return b},
 then(res,rej){ return new Promise((ok,ko)=>{ try{ const match=r=>filters.every(([k,v])=>r[k]===v); let data;
  if(op==='select') data=DB[table].filter(match).map(r=>({...r}));
  if(op==='insert'){ data=(Array.isArray(payload)?payload:[payload]).map(p=>({id:'id'+(++seq),...(table==='buoc_cong_viec'?{trang_thai:'chua_lam',ngay_xong:null,ket_qua:'',ghi_chu:'',nguoi_lam:'',vai_tro:'',nguoi_duyet:'',ly_do_tra:'',ngay_nop:null}:{}),...p})); DB[table].push(...data); }
  if(op==='update'){ DB[table].filter(match).forEach(r=>Object.assign(r,payload)); data=[]; }
  if(op==='delete'){ const gone=DB[table].filter(match); DB[table]=DB[table].filter(r=>!match(r)); if(table==='hoat_dong') DB.buoc_cong_viec=DB.buoc_cong_viec.filter(s=>!gone.some(g=>g.id===s.hoat_dong_id)); if(table==='quy_trinh') DB.quy_trinh_buoc=DB.quy_trinh_buoc.filter(s=>!gone.some(g=>g.id===s.quy_trinh_id)); data=[]; }
  if(single) data=data[0];
  setTimeout(()=>ok({data,error:null}),5);
 }catch(e){ko(e)} }).then(res,rej) }}; return b; }
const client={from:qb,rpc:async()=>({data:true,error:null}),
 auth:{onAuthStateChange(){},getSession:async()=>({data:{session:{user:{id:'u',email:'a@x.com'}}}}),signOut:async()=>{}},
 channel(){return {on(){return this},subscribe(){return this}}},removeChannel(){}};
window.supabase={createClient:()=>client};
})();
