import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {File} from 'node:buffer';
import {parseHTML} from 'linkedom';
import {safeLink,safeImage,validateImage,makeImagePath} from '../cms/safety.js';
import {applyContent,applySettings,readPublished} from '../cms/public.js';
import {renderOfficers,renderPartners,buildMonth,calendarDateKey} from '../cms/render.js';
import {uploadImage} from '../admin/media.js';
const catalog=JSON.parse(await readFile(new URL('../cms/content-catalog.json',import.meta.url)));
const settings=JSON.parse(await readFile(new URL('../cms/settings-catalog.json',import.meta.url)));
const dom=html=>{const {document}=parseHTML(html);globalThis.document=document;return document;};
test('Links rejeitam protocolos executáveis e preservam âncoras locais',()=>{
 for(const v of ['javascript:alert(1)','data:text/html,evil','vbscript:x','//evil.test','https://a:b@example.com','https://exam\nple.com','http://external.test','https:\\evil.test'])assert.equal(safeLink(v),'',v);
 assert.equal(safeLink('#conteudo'),'#conteudo');assert.equal(safeLink('calendario.html'),'https://brasauh-test.netlify.app/calendario.html');assert.equal(safeLink('mailto:brasa@example.com'),'mailto:brasa@example.com');
 assert.equal(safeImage('https://evil.test/file.png'),'');assert.equal(safeImage('assets/vector.svg'),'');assert.ok(safeImage('assets/uh-logo.png'));assert.ok(safeImage('https://bhrgcnoohoptugbggubl.supabase.co/storage/v1/object/public/site-images/id.webp'));
});
test('Catálogo aplica texto como texto e ignora campos/drafts/URLs maliciosos',()=>{
 const c=catalog.find(c=>c.kind==='text'),u=catalog.find(c=>c.kind==='url');
 const d=dom(`<html><body><span data-cms-text="${c.page}.${c.section}.${c.field}">Original</span><a data-cms-href="${u.page}.${u.section}.${u.field}" href="#safe">Link</a></body></html>`);
 applyContent([{...c,value:'<img src=x onerror=alert(1)>',published:true},{...u,value:'javascript:alert(1)',published:true}],catalog,d);
 assert.equal(d.querySelectorAll('img').length,0);assert.ok(d.querySelector('span').textContent.includes('<img'));assert.equal(d.querySelector('a').getAttribute('href'),'#safe');
 applyContent([{...c,value:'PRIVATE',published:false},{...c,field:'unknown',value:'WRONG'}],catalog,d);assert.ok(!d.body.textContent.includes('PRIVATE'));assert.ok(!d.body.textContent.includes('WRONG'));
});
test('Conteúdo inicial aplicado mantém textos de todas as páginas',async()=>{
 for(const page of ['index','quem-somos','diretoria','calendario','parcerias','faca-parte']){
  const d=dom(await readFile(new URL(`../${page}.html`,import.meta.url),'utf8'));
  const text=d.body.textContent.replace(/\s+/g,' ').trim();
  applyContent(catalog.map(c=>({...c,published:true})),catalog,d);applySettings(settings.map(c=>({...c,published:true})),d);
  assert.equal(d.body.textContent.replace(/\s+/g,' ').trim(),text,page);
 }
});
test('Listas públicas só consultam publicados, paginam e propagam falhas',async()=>{
 const ranges=[];
 const client={from(table){
  assert.equal(table,'site_content');
  return {select(){return this},eq(k,v){assert.equal(k,'published');assert.equal(v,true);return this},order(){return this},in(k,v){assert.equal(k,'page');assert.deepEqual(v,['index']);return this},async range(a,b){ranges.push([a,b]);return {data:a===0?Array.from({length:500},(_,id)=>({id})):[{id:500}],error:null}}};
 }};
 assert.equal((await readPublished(client,'site_content',{page:['index']})).length,501);assert.deepEqual(ranges,[[0,499],[500,999]]);
 const fail={from(){return {select(){return this},eq(){return this},order(){return this},range(){return {data:null,error:new Error('offline')}}}}};await assert.rejects(readPublished(fail,'events'),/offline/);
});
test('Diretoria e parceiros renderizam XSS como texto e respostas vazias removem registros',()=>{
 const d=dom('<html><body><div id="officers"></div><div id="partners"></div></body></html>');const o=d.getElementById('officers'),p=d.getElementById('partners');
 renderOfficers(o,[{name:'<img onerror=bad()>',role:'<script>bad()</script>',photo:'javascript:bad()',linkedin:'javascript:bad()',biography:'Bio'}]);assert.equal(o.querySelectorAll('script,img,a').length,0);assert.ok(o.textContent.includes('<script>'));
 renderPartners(p,[{name:'Empresa',logo:'assets/uh-logo.png',description:'<iframe>',benefit:'Benefício',conditions:'Termos',url:'https://example.com'}]);assert.equal(p.querySelectorAll('iframe').length,0);assert.equal(p.querySelector('a').rel,'noopener noreferrer');
 renderOfficers(o,[]);renderPartners(p,[]);assert.equal(o.querySelectorAll('.officer').length,0);assert.equal(p.querySelectorAll('article').length,0);
});
test('Calendário mantém semanas completas e datas em viradas de ano',()=>{
 const jan=buildMonth(2027,0);assert.equal(jan.length%7,0);assert.equal(jan[0].getDay(),0);assert.equal(jan[0].getFullYear(),2026);assert.ok(jan.some(d=>calendarDateKey(d.getFullYear(),d.getMonth(),d.getDate())==='2027-01-31'));
 assert.equal(buildMonth(2028,1).filter(d=>d.getMonth()===1).length,29);
});
test('Upload valida assinatura, formato/tamanho e usa nome único sem sobrescrita',async()=>{
 const png=new File([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])],'foto.png',{type:'image/png'});await validateImage(png);assert.notEqual(makeImagePath(png),makeImagePath(png));
 await assert.rejects(validateImage(new File(['fake'],'foto.png',{type:'image/png'})));await assert.rejects(validateImage(new File([new Uint8Array(5*1024*1024+1)],'large.png',{type:'image/png'})));await assert.rejects(validateImage(new File(['<svg>'],'x.svg',{type:'image/svg+xml'})));
 let calls=0;const messages=[];
 const client={storage:{from(bucket){
  assert.equal(bucket,'site-images');
  return {
   async upload(path,file,options){calls++;assert.match(path,/^[0-9a-f-]{36}\.png$/);assert.equal(options.upsert,false);assert.equal(file,png);return {error:null}},
   getPublicUrl(path){return {data:{publicUrl:'https://bhrgcnoohoptugbggubl.supabase.co/storage/v1/object/public/site-images/'+path}}}
  };
 }}};
 assert.match(await uploadImage(client,png,s=>messages.push(s)),/\.png$/);assert.equal(calls,1);assert.equal(messages.length,3);
 await assert.rejects(uploadImage(client,new File(['bad'],'fake.jpg',{type:'image/jpeg'})));assert.equal(calls,1);
});
