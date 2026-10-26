import {element,externalLink,safeImage} from './safety.js';
import {setIconText} from './icons.js';
import {applyHeadingTypography} from './typography.js';
function image(src,alt){const url=safeImage(src);if(!url)return null;const img=element('img');img.src=url;img.alt=alt;img.loading='lazy';return img;}
function empty(container,title,message){const box=element('div',undefined,'empty-state');box.append(element('h3',title),element('p',message));container.replaceChildren(box);}
export function renderOfficers(container,members){
 if(!members.length){container.className='officers';empty(container,'Diretoria em atualização.','Os perfis publicados aparecerão aqui.');return;}
 container.className='officer-grid';const cards=members.map(o=>{const card=element('article',undefined,'officer');let portrait=image(o.photo,'Foto oficial de '+o.name);
  if(!portrait){portrait=element('div',undefined,'officer-placeholder');portrait.setAttribute('aria-hidden','true');const n=o.name.trim().split(/\s+/);portrait.append(element('span',((n[0]?.[0]||'')+(n.length>1?n.at(-1)[0]:'')).toUpperCase()),element('small','BRASA UH'));}
  card.append(portrait,element('h3',o.name),element('p',o.role));if(o.biography)card.append(element('p',o.biography));const link=externalLink('LinkedIn ↗',o.linkedin);if(link){link.setAttribute('aria-label','LinkedIn de '+o.name);card.append(link);}return card;});container.replaceChildren(...cards);
}
export function renderPartners(container,partners){
 if(!partners.length){container.className='';empty(container,'Novas parcerias serão anunciadas aqui.','Consulte esta página para conhecer os parceiros locais, as condições e a forma de acessar cada benefício assim que forem divulgados.');return;}
 container.className='partner-grid';container.replaceChildren(...partners.map(p=>{const card=element('article');const logo=image(p.logo,p.name);if(logo)card.append(logo);card.append(element('h3',p.name));for(const text of [p.description,p.benefit,p.conditions])if(text)card.append(element('p',text));const link=externalLink('Conhecer parceria ↗',p.url);if(link)card.append(link);return card;}));
}
export function calendarDateKey(y,m,d){return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
export function buildMonth(y,m){const offset=new Date(y,m,1).getDay(),total=Math.ceil((offset+new Date(y,m+1,0).getDate())/7)*7;return Array.from({length:total},(_,i)=>new Date(y,m,i-offset+1));}
export function createCalendar(doc,getEvents){
 const calendar=doc.getElementById('calendar');if(!calendar)return ()=>{};
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const value=k=>Number(parts.find(p=>p.type===k).value);
 const today={year:value('year'),month:value('month')-1,day:value('day')};let year=today.year,month=today.month;
 const label=doc.getElementById('month-label'),list=doc.getElementById('event-list'),filter=doc.getElementById('category');
 function render(){label.textContent=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(year,month,1));const prefix=calendarDateKey(year,month,1).slice(0,7);
  const all=getEvents();const events=all.filter(e=>String(e.date).startsWith(prefix)&&(filter.value==='all'||e.category===filter.value)).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
  const week=element('div',undefined,'calendar-week');for(const day of ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'])week.append(element('div',day));const days=element('div',undefined,'calendar-days');
  const eventId=e=>'event-'+all.indexOf(e);
  for(const date of buildMonth(year,month)){const key=calendarDateKey(date.getFullYear(),date.getMonth(),date.getDate()),isToday=key===calendarDateKey(today.year,today.month,today.day);const cell=element('div',undefined,'day'+(date.getMonth()!==month?' outside':'')+(isToday?' today':''));if(isToday)cell.setAttribute('aria-label','Hoje');cell.append(element('span',date.getDate()));for(const e of events.filter(e=>e.date===key)){const link=element('a',e.title);link.href='#'+eventId(e);cell.append(link);}days.append(cell);}
  calendar.replaceChildren(week,days);
  if(!events.length){const box=element('div',undefined,'agenda-empty');box.append(element('p','Nenhum evento publicado para este mês'+(filter.value==='all'?'':', nesta categoria')+'.'),element('small','As próximas datas serão adicionadas assim que confirmadas.'));list.replaceChildren(box);return;}
  list.replaceChildren(...events.map(e=>{const card=element('article',undefined,'event-row');card.id=eventId(e);const time=element('time',e.date.slice(8,10)+'/'+e.date.slice(5,7));time.dateTime=e.date;if(e.time)time.append(element('br'),document.createTextNode(e.time+(e.endTime?' – '+e.endTime+(e.endTime<e.time?' (dia seguinte)':''):'')));const body=element('div');body.append(element('span',e.category,'eyebrow'),element('h3',e.title),element('p',e.location),element('p',e.description));const photo=image(e.image,e.title);if(photo){photo.style.maxWidth='320px';body.append(photo);}card.append(time,body);const link=externalLink('Ver detalhes ↗',e.url);if(link)card.append(link);return card;}));
 }
 doc.getElementById('previous-month').addEventListener('click',()=>{month--;if(month<0){month=11;year--;}render();});doc.getElementById('next-month').addEventListener('click',()=>{month++;if(month>11){month=0;year++;}render();});doc.getElementById('today').addEventListener('click',()=>{year=today.year;month=today.month;render();});filter.addEventListener('change',render);render();return render;
}
export function renderUpcoming(events,doc=document){
 const teaser=doc.querySelector('.calendar-teaser');if(!teaser)return;
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const today=['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');const next=events.filter(e=>e.date>=today).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')))[0];if(!next)return;
 teaser.querySelector('h3').textContent=next.title;teaser.querySelector(':scope > p').textContent=`${next.date.slice(8,10)}/${next.date.slice(5,7)}/${next.date.slice(0,4)}${next.time?' · '+next.time:''}${next.location?' · '+next.location:''}`;
 const link=teaser.querySelector('.arrow-link');setIconText(link,'Ver evento no calendário →');link.href='calendario.html';link.removeAttribute('target');
 applyHeadingTypography(teaser);
}
