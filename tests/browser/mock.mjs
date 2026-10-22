import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('cms/content-catalog.json',root)));
const settings=JSON.parse(await readFile(new URL('cms/settings-catalog.json',root)));
const sandbox={window:{}};vm.runInNewContext(await readFile(new URL('data.js',root),'utf8'),sandbox);
const stamp='2026-10-22T12:00:00Z';
export async function mockCMS(context,{authorized=true,offline=false}={}) {
 const user={id:'00000000-0000-4000-8000-000000000001',email:'admin@example.test',aud:'authenticated',role:'authenticated'};
 const db={site_content:catalog.map((c,i)=>({...c,id:'content-'+i,published:true,updated_at:stamp})),site_settings:settings.map(c=>({...c,published:true,updated_at:stamp})),leadership_members:sandbox.window.BRASA_DATA.officers.map((o,i)=>({id:'member-'+i,full_name:o.name,role:o.role,photo_url:o.photo||'',linkedin_url:o.linkedin||'',biography:'',display_order:i,published:true,updated_at:stamp})),partners:[],events:[],admin_users:authorized?[{user_id:user.id,role:'admin'}]:[]};
 const requests=[],files=[];
 const response=async(route,data,status=200,headers={})=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range',...headers},body:JSON.stringify(data)});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.hostname==='127.0.0.1')return route.continue();
  if(url.hostname!=='bhrgcnoohoptugbggubl.supabase.co')return route.fulfill({status:200,body:''});
  requests.push({path:url.pathname,search:url.search,method:req.method(),authorization:req.headers().authorization,body:req.postData()});
  if(offline)return response(route,{message:'Simulated unavailable'},503);
  if(url.pathname.endsWith('/token'))return response(route,{access_token:'mock-access-token',refresh_token:'mock-refresh-token',expires_in:3600,token_type:'bearer',user});
  if(url.pathname.endsWith('/logout'))return response(route,{});
  if(url.pathname.endsWith('/user'))return response(route,user);
  if(url.pathname.includes('/storage/v1/object/list/'))return response(route,files);
  if(url.pathname.startsWith('/storage/v1/object/public/'))return route.fulfill({contentType:'image/png',body:await readFile(new URL('assets/uh-logo.png',root))});
  if(url.pathname.startsWith('/storage/v1/object/site-images/')&&req.method()==='POST'){
   const name=url.pathname.split('/').pop();files.push({id:crypto.randomUUID(),name,metadata:{size:1024},created_at:stamp});return response(route,{Key:'site-images/'+name,Id:files.at(-1).id});
  }
  if(url.pathname.endsWith('/rpc/reorder_cms_records')){
   const {entity,ordered_ids}=req.postDataJSON();for(const [i,id] of ordered_ids.entries())db[entity].find(r=>r.id===id).display_order=i*10;
   return response(route,ordered_ids.length);
  }
  const table=url.pathname.split('/').pop();
  if(!db[table])return response(route,{message:'Not implemented by local mock'},400);
  const matches=row=>[...url.searchParams].every(([key,value])=>{
   if(value.startsWith('eq.'))return String(row[key])===value.slice(3);
   if(value.startsWith('in.('))return value.slice(4,-1).split(',').map(v=>v.replace(/^"|"$/g,'')).includes(String(row[key]));
   return true;
  });
  let rows=db[table].filter(matches);
  if(req.method()==='POST'){
   const body=req.postDataJSON(),incoming=Array.isArray(body)?body:[body];rows=[];
   for(const payload of incoming){const key=url.searchParams.get('on_conflict')?.split(',')||['id'];let record=db[table].find(r=>key.every(k=>payload[k]!==undefined&&r[k]===payload[k]));if(record)Object.assign(record,payload,{updated_at:stamp});else{record={id:crypto.randomUUID(),published:false,...payload,updated_at:stamp};db[table].push(record);}rows.push(record);}
  }else if(req.method()==='PATCH'){for(const row of rows)Object.assign(row,req.postDataJSON(),{updated_at:stamp});}
  else if(req.method()==='DELETE'){db[table]=db[table].filter(r=>!rows.includes(r));}
  const count=rows.length;
  if(req.method()==='GET'){
   const order=url.searchParams.get('order')?.split('.')[0];if(order)rows.sort((a,b)=>typeof a[order]==='number'?a[order]-b[order]:String(a[order]).localeCompare(String(b[order])));
   const start=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||1000);rows=rows.slice(start,start+limit);
  }
  const singular=req.headers().accept?.includes('vnd.pgrst.object');
  return response(route,req.method()==='HEAD'?null:singular?rows[0]??null:rows,200,{'content-range':`0-${Math.max(0,count-1)}/${count}`});
 });
 return {db,requests,user};
}
export async function login(page){await page.goto('/admin/');await page.locator('#login-email').fill('admin@example.test');await page.locator('#login-password').fill('local-mock-password');await page.locator('#login-submit').click();}
