import {connectPublic,applySettings} from './cms/public.js';
import {renderOfficers,renderPartners,createCalendar,renderUpcoming} from './cms/render.js';
import {initImageFallbacks} from './cms/images.js';
function init(){
 initImageFallbacks();
 const data=structuredClone(window.BRASA_DATA||{contacts:{},officers:[],partners:[],events:[]});
 const menu=document.getElementById('menu-toggle'),nav=document.getElementById('nav');
 const closeMenu=()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Abrir menu');};
 menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('open')){closeMenu();menu.focus();}});nav.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu();});
 const tabs=[...document.querySelectorAll('[role="tab"]')];
 function activate(tab){tabs.forEach(t=>{const on=t===tab;t.setAttribute('aria-selected',String(on));t.tabIndex=on?0:-1;document.getElementById(t.getAttribute('aria-controls')).hidden=!on;});}
 tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>{activate(tab);history.replaceState(null,'',tab.id==='global-tab'?'#global':'#local');});tab.addEventListener('keydown',e=>{const n={ArrowRight:(i+1)%tabs.length,ArrowLeft:(i+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1}[e.key];if(n!==undefined){e.preventDefault();activate(tabs[n]);tabs[n].focus();}});});
 if(location.hash==='#global'&&tabs.length)activate(document.getElementById('global-tab'));
 applySettings(Object.entries(data.contacts).filter(([,v])=>v).map(([key,value])=>({key,value,published:true})));
 const officers=document.getElementById('officers'),partners=document.getElementById('local-partners');
 // Keep the original static HTML (and its CMS text slots) until a list response succeeds.
 const refreshCalendar=createCalendar(document,()=>data.events);
 connectPublic((name,rows)=>{
  if(name==='officers'){data.officers=rows.sort((a,b)=>a.display_order-b.display_order||a.full_name.localeCompare(b.full_name)).map(r=>({name:r.full_name,role:r.role,photo:r.photo_url,linkedin:r.linkedin_url,biography:r.biography}));if(officers)renderOfficers(officers,data.officers);}
  if(name==='partners'){data.partners=rows.sort((a,b)=>a.display_order-b.display_order||a.name.localeCompare(b.name)).map(r=>({name:r.name,logo:r.logo_url,description:r.description,benefit:r.benefit,conditions:r.conditions,url:r.website_url}));if(partners)renderPartners(partners,data.partners);}
  if(name==='events'){data.events=rows.map(r=>({title:r.title,date:r.event_date,time:r.start_time?.slice(0,5),endTime:r.end_time?.slice(0,5),location:r.location,description:r.description,url:r.registration_url,image:r.image_url,category:r.category}));refreshCalendar();renderUpcoming(data.events);}
 }).catch(()=>console.warn('BRASA UH: CMS indisponível; versão local preservada.'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
