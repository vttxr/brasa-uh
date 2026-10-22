// ONE-TIME preparation from the audited source. Never run automatically on deploy.
import fs from 'node:fs';import crypto from 'node:crypto';import vm from 'node:vm';import {parse} from 'parse5';
const files=['index','quem-somos','diretoria','calendario','parcerias','faca-parte'];
if(fs.existsSync('cms/content-catalog.json'))throw Error('Catalog already exists. Do not regenerate over administrator content.');
const settings=[
 ['email','E-mail público','text',''],['linkedin','LinkedIn da BRASA UH','url',''],['instagram','Instagram','url','https://www.instagram.com/brasa.uh/'],['whatsapp','WhatsApp','url',''],
 ['getinvolved_url','Portal Get Involved / inscrição UH','url','https://getinvolved.uh.edu/'],['portal_brasa_url','Portal BRASA','url','https://portalbrasa.gobrasa.org/'],['brasa_global_url','BRASA Global','url','https://gobrasa.org'],['uh_url','University of Houston','url','https://www.uh.edu/'],
 ['footer_tagline','Frase do rodapé','text','DO BRASIL. DA UH. DO SEU LADO.'],['footer_description','Descrição do rodapé','text','The Brazilian Student Association\nat the University of Houston'],
].map(([key,label,kind,value])=>({key,label,kind,value}));
const catalog=[];const shared=new Map();
const attr=(node,key)=>node.attrs?.find(a=>a.name===key)?.value||'';
const has=(node,cls)=>attr(node,'class').split(/\s+/).includes(cls);
const uuid=(s)=>{const h=crypto.createHash('sha256').update(s).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
for(const page of files){
 let html=fs.readFileSync(page+'.html','utf8');const ast=parse(html,{sourceCodeLocationInfo:true});const edits=[];let sectionIndex=0;const counts={};const marked=new Map();
 const mark=(node,key,value)=>{const end=node.sourceCodeLocation?.startTag?.endOffset;if(!end)return;let attrs=marked.get(end);if(!attrs){attrs=new Map();marked.set(end,attrs);}attrs.set(key,value);};
 const add=(entry,node)=>{const group=entry.page+'.'+entry.section;counts[group]=(counts[group]||0)+1;entry.field=entry.kind+'-'+String(counts[group]).padStart(3,'0');const key=group+'.'+entry.field;entry.target=`[data-cms-${entry.attribute||'text'}="${key}"]`;
  if(entry.page!=='shared'||!shared.has(key)){catalog.push(entry);if(entry.page==='shared')shared.set(key,true);}
  if(entry.attribute)mark(node,'data-cms-'+entry.attribute,key);else{const loc=node.sourceCodeLocation;edits.push({start:loc.startOffset,end:loc.startOffset,text:`<span data-cms-text="${key}">`},{start:loc.endOffset,end:loc.endOffset,text:'</span>'});}
 };
 function walk(node,ctx={page,section:'intro',skip:false,eligible:false,label:''}){
  const tag=node.tagName,cls=attr(node,'class'),id=attr(node,'id');let next={...ctx};
  if(tag==='section'){sectionIndex++;next.section=`section-${String(sectionIndex).padStart(2,'0')}`;}
  if(tag==='footer'){next.page='shared';next.section='footer';}
  if(cls==='topbar'){next.page='shared';next.section='topbar';}
  if(tag==='header'||tag==='noscript'||tag==='script'||tag==='style'||tag==='select'||tag==='button'||attr(node,'aria-hidden')==='true'||has(node,'logo')||has(node,'hero-crest')||['officers','local-partners','calendar','event-list'].includes(id))next.skip=true;
  if(['h1','h2','h3','p','a','small','figcaption'].includes(tag)||['eyebrow','footer-tag','identity-strip'].some(c=>has(node,c)))next.eligible=true;
  if(['h1','h2','h3','p','a','figcaption','small'].includes(tag))next.label=({h1:'Título principal',h2:'Título de seção',h3:'Subtítulo',p:'Texto',a:'Botão / link',figcaption:'Legenda',small:'Texto de apoio'})[tag];
  if(!next.skip&&node.attrs){
   const href=attr(node,'href');const setting=href&&settings.find(s=>s.kind==='url'&&s.value&&s.value.replace(/\/$/,'')===href.replace(/\/$/,''));
   if(setting)mark(node,'data-setting-link',setting.key);
   else if(tag==='a'&&href)add({page:next.page,section:next.section,kind:'url',value:href,label:'Destino do link: '+(node.childNodes?.map(c=>c.value||'').join('').trim().slice(0,45)||href),attribute:'href'},node);
   if(tag==='img')for(const [attribute,kind]of [['src','image'],['alt','alt']]){add({page:next.page,section:next.section,kind,value:attr(node,attribute),label:kind==='image'?'Imagem: '+attr(node,'src'):'Descrição acessível da imagem',attribute},node);}
   if(has(node,'footer-tag')){mark(node,'data-setting-text','footer_tagline');next.skip=true;}
   if(tag==='p'&&node.parentNode?.childNodes?.some(n=>has(n,'footer-logo'))){mark(node,'data-setting-text','footer_description');next.skip=true;}
  }
  if(node.nodeName==='#text'&&!next.skip&&next.eligible&&node.sourceCodeLocation){const raw=node.value;const value=raw.trim();if(value&&!/^[\s✳↗→◒0-9 /.,°()-]+$/.test(value)){add({page:next.page,section:next.section,kind:'text',value,label:`${next.label||'Texto'}: ${value.slice(0,65)}`,prefix:raw.match(/^\s*/)[0],suffix:raw.match(/\s*$/)[0]},node);}}
  for(const child of node.childNodes||[])walk(child,next);
 }
 walk(ast);
 for(const [end,attrs] of marked){edits.push({start:end-1,end:end-1,text:[...attrs].map(([k,v])=>` ${k}="${v}"`).join('')});}
 for(const e of edits.sort((a,b)=>b.start-a.start))html=html.slice(0,e.start)+e.text+html.slice(e.end);
 html=html.replace('<script src="script.js" defer></script>','<script type="module" src="script.js"></script>');
 fs.writeFileSync(page+'.html',html);
}
fs.writeFileSync('cms/content-catalog.json',JSON.stringify(catalog,null,2)+'\n');fs.writeFileSync('cms/settings-catalog.json',JSON.stringify(settings,null,2)+'\n');
const context={window:{}};vm.runInNewContext(fs.readFileSync('data.js','utf8'),context);const data=context.window.BRASA_DATA;
const q=v=>v===null||v===undefined?'null':typeof v==='boolean'?String(v):typeof v==='number'?String(v):"'"+String(v).replace(/'/g,"''")+"'";
let sql='-- Initial seed from vttxr/brasa-uh commit 6c2ab6ae4f9e1687b3eee02e478be8c0993d9141.\n-- Run once after both migrations, manually. Re-runs never overwrite existing rows.\nbegin;\n';
const insert=(table,obj,conflict='id')=>{sql+=`insert into public.${table} (${Object.keys(obj).join(',')}) values (${Object.values(obj).map(q).join(',')}) on conflict (${conflict}) do nothing;\n`;};
for(const c of catalog)insert('site_content',{id:uuid(c.page+'.'+c.section+'.'+c.field),page:c.page,section:c.section,field:c.field,kind:c.kind,value:c.value,published:true},'page,section,field');
for(const s of settings)insert('site_settings',{key:s.key,value:s.value,kind:s.kind,published:true},'key');
data.officers.forEach((o,i)=>insert('leadership_members',{id:uuid('member.'+o.name),full_name:o.name,role:o.role,biography:'',photo_url:o.photo||'',linkedin_url:o.linkedin||'',display_order:i,published:true}));
data.events.forEach((e,i)=>insert('events',{id:uuid('event.'+i+'.'+e.title),title:e.title,description:e.description||'',event_date:e.date,start_time:e.time||null,end_time:null,location:e.location||'',registration_url:e.url||'',image_url:e.image||'',category:e.category||'Comunidade',published:true}));
data.partners.forEach((p,i)=>insert('partners',{id:uuid('partner.'+p.name),name:p.name,logo_url:p.logo||'',description:p.description||'',website_url:p.url||'',benefit:p.benefit||'',conditions:p.conditions||'',display_order:i,published:true}));
sql+='commit;\n';fs.mkdirSync('supabase',{recursive:true});fs.writeFileSync('supabase/seed.sql',sql);console.log(`${catalog.length} content fields, ${settings.length} settings, ${data.officers.length} real members seeded. No live SQL executed.`);
