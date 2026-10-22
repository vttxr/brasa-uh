// Fixed SVG drawings, shared by the static pages and CMS-rendered content.
// The original character stays in <title> for text exports; the SVG is decorative.
const paths = {
 '↗':'M5 19 19 5M5 5h14v14',
 '→':'M3 12h18m-7-7 7 7-7 7',
 '←':'M21 12H3m7-7-7 7 7 7',
 '↑':'M12 21V3m-7 7 7-7 7 7',
 '↓':'M12 3v18m-7-7 7 7 7-7',
 '↪':'M3 5v5a4 4 0 0 0 4 4h14m-6-6 6 6-6 6',
 '×':'m5 5 14 14M5 19 19 5',
 '✳':'M12 2v20M2 12h20M5 5l14 14M5 19 19 5',
 '☰':'M3 6h18M3 12h18M3 18h18',
 '✓':'m4 12 5 5L20 6',
 '＋':'M12 4v16M4 12h16',
 '◫':'M3 3h18v18H3ZM10 3v18',
 '⌂':'m2 11 10-8 10 8M5 9v12h14V9M10 21v-7h4v7',
 '◎':'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
 '♧':'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-3a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v3',
 '▦':'M3 5h18v16H3ZM3 10h18M8 3v4M16 3v4M8 14h1m6 0h1m-8 3h1m6 0h1',
 '▧':'M3 3h18v18H3Zm0 14 6-6 4 4 3-3 5 5M8 7h.01',
 '⚙':'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'
};
export const symbolPattern = new RegExp(`[${Object.keys(paths).join('')}][\\uFE0E\\uFE0F]?`, 'gu');
const ns='http://www.w3.org/2000/svg';
export function iconMarkup(symbol) {
 const glyph=Array.from(symbol)[0];
 return `<svg class="site-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" xmlns="${ns}"><title>${glyph}</title><path d="${paths[glyph]}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function icon(symbol,doc) {
 const glyph=Array.from(symbol)[0],svg=doc.createElementNS(ns,'svg');
 for(const [key,value] of Object.entries({class:'site-icon',viewBox:'0 0 24 24','aria-hidden':'true',focusable:'false',fill:'none'}))svg.setAttribute(key,value);
 const title=doc.createElementNS(ns,'title');title.textContent=glyph;
 const path=doc.createElementNS(ns,'path');
 for(const [key,value] of Object.entries({d:paths[glyph],stroke:'currentColor','stroke-width':'2','stroke-linecap':'round','stroke-linejoin':'round'}))path.setAttribute(key,value);
 svg.append(title,path);return svg;
}
export function decorateIcons(root) {
 if(!root)return;
 // Never change editable text, SVGs, scripts, or native select options.
 if(root.nodeType===1&&root.matches('svg,script,style,title,textarea,input,select,option,[contenteditable]'))return;
 const doc=root.ownerDocument||root;
 for(const node of [...root.childNodes]) {
  if(node.nodeType!==3){decorateIcons(node);continue;}
  const text=node.nodeValue,matches=[...text.matchAll(symbolPattern)];
  if(!matches.length)continue;
  const fragment=doc.createDocumentFragment();let start=0;
  for(const match of matches) {
   fragment.append(doc.createTextNode(text.slice(start,match.index)),icon(match[0],doc));
   start=match.index+match[0].length;
  }
  fragment.append(doc.createTextNode(text.slice(start)));node.replaceWith(fragment);
 }
}
export function setIconText(node,text) {
 node.textContent=String(text);decorateIcons(node);
}
