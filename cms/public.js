import {getPublicClient} from './client.js';
import {safeLink,safeImage,element} from './safety.js';
import {setIconText,decorateIcons} from './icons.js';
import {applyHeadingTypography} from './typography.js';
const rootURL=new URL('../',import.meta.url);
const key=r=>`${r.page}.${r.section}.${r.field}`;
export async function readPublished(client,table,filters={}){
 const rows=[];
 for(let start=0;;start+=500){let query=client.from(table).select('*').eq('published',true).order(table==='site_settings'?'key':'id');
  for(const [name,value] of Object.entries(filters))query=query.in(name,value);
  const {data,error}=await query.range(start,start+499);if(error)throw error;
  if(!Array.isArray(data))throw Error('Resposta inválida do CMS.');rows.push(...data);if(data.length<500)return rows;
 }
}
export function applyContent(rows,catalog,doc=document){
 const permitted=new Map(catalog.map(c=>[key(c),c]));
 for(const row of rows){const c=permitted.get(key(row));if(!c||row.published===false||c.kind!==row.kind||typeof row.value!=='string')continue;
  for(const node of doc.querySelectorAll(c.target)){
   if(c.kind==='text')setIconText(node,(c.prefix||'')+row.value+(c.suffix||''));
   else if(c.kind==='alt')node.setAttribute('alt',row.value);
   else if(!row.value.trim()){node.removeAttribute(c.attribute);if(c.kind==='image')node.hidden=true;}
   else {
    // Old seeded branding should not restore the opaque JPEGs after CMS load.
    const legacyImages={'assets/brasa-uh-color.jpeg':'assets/brasa-uh-color.png','assets/brasa-uh-white.jpeg':'assets/brasa-uh-white.png','assets/brasa-uh-outline.png':'assets/brasa-uh-outline.png?v=7e105ed66b07'};
    const value=c.kind==='image'?safeImage(legacyImages[row.value]?(c.value||legacyImages[row.value]):row.value):safeLink(row.value);
    if(value){node.setAttribute(c.attribute,value);if(c.kind==='image')node.hidden=false;}
   }
  }
 }
 applyHeadingTypography(doc);
}
export function applySettings(rows,doc=document){
 const settings=Object.fromEntries(rows.filter(r=>r.published!==false&&typeof r.value==='string').map(r=>[r.key,r.value]));
 for(const node of doc.querySelectorAll('[data-setting-link]')){const k=node.dataset.settingLink;if(!(k in settings))continue;const link=safeLink(settings[k]);if(link)node.setAttribute('href',link);else node.removeAttribute('href');}
 for(const node of doc.querySelectorAll('[data-setting-text]')){const k=node.dataset.settingText;if(!(k in settings))continue;
  const prefix=node.textContent.match(/^\s*/)[0],suffix=node.textContent.match(/\s*$/)[0];
  node.replaceChildren(doc.createTextNode(prefix));settings[k].split('\n').forEach((line,i)=>{if(i)node.append(element('br'));node.append(doc.createTextNode(line));});node.append(doc.createTextNode(suffix));decorateIcons(node);}
 for(const kind of ['email','linkedin','whatsapp']){
  if(!(kind in settings))continue;let nodes=[...doc.querySelectorAll(`[data-contact="${kind}"]`)];
  if(!nodes.length&&kind==='whatsapp'&&settings.whatsapp){const contact=doc.querySelector('[data-contact="email"]')?.parentElement;if(contact){const span=element('span');span.dataset.contact=kind;contact.append(span);nodes=[span];}}
  for(const node of nodes){const value=settings[kind];const href=safeLink(kind==='email'&&value?'mailto:'+value:value);
   const next=element(href?'a':'span',href?(kind==='email'?value:kind==='linkedin'?'LinkedIn ↗':'WhatsApp ↗'):(kind==='email'?'E-mail':kind==='linkedin'?'LinkedIn':'WhatsApp')+' · em breve');next.dataset.contact=kind;
   if(href){next.href=href;if(kind!=='email'){next.target='_blank';next.rel='noopener noreferrer';}}node.replaceWith(next);
  }
 }
}
export async function connectPublic(onData){
 const page=location.pathname.split('/').pop()?.replace(/\.html$/,'')||'index';
 const catalog=await fetch(new URL('content-catalog.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Catálogo indisponível');return r.json();});
 // Preview is same-origin and can only supply structured values for trusted catalog targets.
 if(new URLSearchParams(location.search).has('cms-preview')&&window.parent!==window){
  const original=new Map(catalog.filter(c=>[page,'shared'].includes(c.page)).map(c=>[key(c),{...c,published:true}]));
  window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==window.parent||e.data?.type!=='brasa-cms-preview')return;
   const rows=Array.isArray(e.data.rows)?e.data.rows:[];applyContent([...original.values()],catalog);applyContent(rows,catalog);
   if(Array.isArray(e.data.settings))applySettings(e.data.settings);
  });window.parent.postMessage({type:'brasa-cms-preview-ready'},location.origin);return;
 }
 const client=await getPublicClient();
 const queries=[['content',()=>readPublished(client,'site_content',{page:[page,'shared']})],['settings',()=>readPublished(client,'site_settings')]];
 if(page==='diretoria')queries.push(['officers',()=>readPublished(client,'leadership_members')]);
 if(page==='parcerias')queries.push(['partners',()=>readPublished(client,'partners')]);
 if(['index','calendario'].includes(page))queries.push(['events',()=>readPublished(client,'events')]);
 const results=await Promise.allSettled(queries.map(([,fn])=>fn()));
 results.forEach((result,i)=>{if(result.status!=='fulfilled')return;const name=queries[i][0];
  if(name==='content')applyContent(result.value,catalog);else if(name==='settings')applySettings(result.value);else onData(name,result.value);
 });
 if(results.some(r=>r.status==='rejected'))console.warn('BRASA UH: parte do CMS está indisponível; o conteúdo local foi preservado.');
}
