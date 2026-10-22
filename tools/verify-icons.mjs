import {chromium,webkit,devices} from '@playwright/test';
import assert from 'node:assert/strict';
const baseURL=process.argv[2]||'http://localhost:3000';
const pages=['index','quem-somos','diretoria','calendario','parcerias','faca-parte'];
for(const name of ['desktop','iphone']) {
 const browser=await (name==='iphone'?webkit:chromium).launch(name==='iphone'?{}:{channel:'msedge'});
 try {
  const context=await browser.newContext(name==='iphone'?devices['iPhone 13']:{viewport:{width:1440,height:1000}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',r=>{if(r.url().startsWith(baseURL)&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  for(const route of pages) {
   await page.goto(`${baseURL}/${route}.html`,{waitUntil:'networkidle'});
   const result=await page.evaluate(()=>{
    const raw=[];
    function walk(node) {
     if(node.nodeType===1&&node.matches('svg,script,style,title,textarea,input,select,option,[contenteditable]'))return;
     if(node.nodeType===3&&/[↗→←↑↓↪×✳☰✓＋◫⌂◎♧▦▧⚙]/u.test(node.nodeValue))raw.push(node.nodeValue.trim());
     for(const child of node.childNodes)walk(child);
    }
    walk(document.body);
    return {raw,icons:document.querySelectorAll('svg.site-icon').length,overflow:document.documentElement.scrollWidth>innerWidth+1};
   });
   assert.deepEqual(result.raw,[],`${name}/${route}: native symbols remain`);
   assert.ok(result.icons>0);
   assert.equal(result.overflow,false,`${name}/${route}: overflow`);
   if(route==='index')await page.locator('.actions').screenshot({path:`test-results/icons-${name}.png`});
   if(route==='calendario') {
    await page.getByRole('button',{name:'Próximo mês'}).click();
    await page.getByRole('button',{name:'Mês anterior'}).click();
   }
  }
  assert.deepEqual(errors,[]);
  console.log(`${name}: ${pages.length} pages, no native icon glyphs, no JavaScript/HTTP errors or overflow.`);
 } finally { await browser.close(); }
}
