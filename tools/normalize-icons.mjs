// Materialize icons in the source HTML, including the no-JavaScript fallback.
import fs from 'node:fs';
import {parse} from 'parse5';
import {iconMarkup,symbolPattern} from '../cms/icons.js';
const pages=['index','quem-somos','diretoria','calendario','parcerias','faca-parte'].map(p=>p+'.html');
for(const file of [...pages,'admin/index.html']) {
 let html=fs.readFileSync(file,'utf8');
 const ast=parse(html,{sourceCodeLocationInfo:true}),edits=[];
 function walk(node) {
  if(['svg','script','style','title','textarea','input','select','option'].includes(node.tagName))return;
  if(node.nodeName==='#text'&&node.sourceCodeLocation) {
   const {startOffset:start,endOffset:end}=node.sourceCodeLocation;
   const text=html.slice(start,end),next=text.replace(symbolPattern,iconMarkup);
   if(text!==next)edits.push({start,end,next});
  }
  for(const child of node.childNodes||[])walk(child);
 }
 walk(ast);
 for(const {start,end,next} of edits.sort((a,b)=>b.start-a.start))html=html.slice(0,start)+next+html.slice(end);
 fs.writeFileSync(file,html);
}
