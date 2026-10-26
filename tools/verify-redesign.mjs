// Local visual review only. CMS calls are intercepted; no published records are changed.
import {chromium,webkit} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {mockCMS} from '../tests/browser/mock.mjs';

const engine=process.argv.includes('--webkit')?'webkit':'edge';
const browser=engine==='webkit'?await webkit.launch():await chromium.launch({channel:'msedge'});
const output=`test-results/redesign-review-${engine}`;
await mkdir(output,{recursive:true});
const context=await browser.newContext();
await mockCMS(context);
const page=await context.newPage();
const report=[];
try{
 for(const name of ['index','quem-somos','diretoria','calendario','parcerias','faca-parte']){
  await page.goto(`http://127.0.0.1:4173/${name}.html`,{waitUntil:'networkidle'});
  await page.evaluate(()=>document.fonts.ready);
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:width===390?844:1000});
   for(const image of await page.locator('img:visible').all()){
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(img=>img.decode().catch(()=>{}));
   }
   await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
   // Full-page captures can paint fixed elements outside the viewport. The skip
   // link is intentionally offscreen until focused; keep that state in the image.
   await page.screenshot({path:`${output}/${name}-${width}.png`,fullPage:true,style:'.skip:not(:focus) { visibility: hidden; }'});
   const result=await page.evaluate(()=>{
    const rgba=value=>{
     const parts=value.match(/[\d.]+/g)?.map(Number);
     if(!parts||parts.length<3)return null;
     if(value.startsWith('color(srgb '))return [...parts.slice(0,3).map(v=>v*255),parts[3]??1];
     return /^rgba?\(/.test(value)?[...parts.slice(0,3),parts[3]??1]:null;
    };
    const over=(front,back)=>[...front.slice(0,3).map((v,i)=>v*front[3]+back[i]*(1-front[3])),1];
    const luminance=color=>color.slice(0,3).map(v=>{const n=v/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
    const contrast=[];
    for(const el of document.querySelectorAll('body *')){
     if(el.closest('svg,[aria-hidden="true"],[hidden]')||!el.getClientRects().length)continue;
     const text=[...el.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).map(node=>node.textContent).join('').trim();
     if(!text)continue;
     const css=getComputedStyle(el);
     if(css.visibility!=='visible')continue;
     let bg=[255,255,255,1],unknown=false;
     const chain=[];
     for(let node=el;node;node=node.parentElement)chain.unshift(node);
     for(const node of chain){
      const style=getComputedStyle(node);
      // A screenshot is needed to judge text on imagery/gradients or translucent containers.
      if(style.backgroundImage!=='none'||Number(style.opacity)<1){unknown=true;break;}
      const color=rgba(style.backgroundColor);
      if(color)bg=over(color,bg);
     }
     if(unknown)continue;
     const color=rgba(css.color);
     if(!color)continue;
     const fg=over(color,bg),l1=luminance(fg),l2=luminance(bg),ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
     const large=parseFloat(css.fontSize)>=24||(parseFloat(css.fontSize)>=18.66&&Number(css.fontWeight)>=700),minimum=large?3:4.5;
     if(ratio<minimum-.01)contrast.push({text:text.slice(0,90),element:el.tagName.toLowerCase()+(el.className?'.'+String(el.className).trim().replace(/\s+/g,'.'):''),foreground:css.color,background:bg.slice(0,3).map(Math.round),font:css.fontSize,weight:css.fontWeight,ratio:Number(ratio.toFixed(2)),minimum});
    }
    return {overflow:document.documentElement.scrollWidth>innerWidth+1,brokenImages:[...document.images].filter(img=>!img.hidden&&(!img.complete||!img.naturalWidth)).map(img=>img.getAttribute('src')),missingAlt:[...document.images].filter(img=>!img.hasAttribute('alt')).map(img=>img.getAttribute('src')),contrast};
   });
   report.push({page:name,width,...result});
  }
 }
 await writeFile(`${output}/report.json`,JSON.stringify(report,null,2)+'\n');
 const issues=report.filter(row=>row.overflow||row.brokenImages.length||row.missingAlt.length||row.contrast.length);
 console.log(JSON.stringify({engine,output,checks:report.length,issues},null,2));
}finally{
 await browser.close();
}
