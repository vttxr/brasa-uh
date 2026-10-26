import {test,expect} from '@playwright/test';
import {mockCMS} from './mock.mjs';

const viewports=[{width:320,height:844},{width:390,height:844},{width:768,height:1024},{width:1440,height:1000}];
const pages=['index','quem-somos','diretoria','calendario','parcerias','faca-parte'];

async function checkPortraits(page,expectedMembers){
 const cards=page.locator('#officers .officer');
 await expect(cards).toHaveCount(expectedMembers.length);
 const sizes=[];
 for(let i=0;i<expectedMembers.length;i++){
  const card=cards.nth(i),member=expectedMembers[i];
  await expect(card.locator('h3')).toHaveText(member.full_name);
  await expect(card.locator(':scope > p').first()).toHaveText(member.role);
  const portrait=card.locator(':scope > img, :scope > .officer-placeholder');
  await portrait.scrollIntoViewIfNeeded();
  const shape=await portrait.evaluate(el=>{
   const css=getComputedStyle(el),rect=el.getBoundingClientRect();
   return {width:rect.width,height:rect.height,radius:css.borderRadius,aspect:css.aspectRatio,fit:css.objectFit,position:css.objectPosition,photo:el.tagName==='IMG'};
  });
  expect(shape.width).toBeGreaterThan(80);
  expect(Math.abs(shape.width-shape.height)).toBeLessThan(1);
  expect(shape.radius).toBe('50%');
  expect(shape.aspect).toMatch(/^1\s*\/\s*1$/);
  sizes.push(shape.width);
  if(shape.photo){
   expect(shape.fit).toBe('cover');
   expect(shape.position).toBe('50% 50%');
   await expect(portrait).toHaveAttribute('alt','Foto oficial de '+member.full_name);
   await expect.poll(()=>portrait.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  }
 }
 expect(Math.max(...sizes)-Math.min(...sizes)).toBeLessThan(1);
}

test('diretoria: fotos do CMS e placeholders são circulares sem alterar nomes e cargos',async({page,context},testInfo)=>{
 const {db}=await mockCMS(context);
 // Only the intercepted test response changes: official records and original images stay untouched.
 db.leadership_members.forEach((member,index)=>{member.photo_url=index%2===0?'assets/uh-logo.png':'';});
 await page.goto('/diretoria.html',{waitUntil:'networkidle'});
 await expect(page.locator('#officers img')).toHaveCount(5);
 for(const viewport of viewports){
  await page.setViewportSize(viewport);
  await checkPortraits(page,db.leadership_members);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.locator('.board-section').screenshot({path:testInfo.outputPath(`diretoria-mixed-${viewport.width}.png`),style:'.skip:not(:focus) { visibility: hidden; }'});
 }
});

test('diretoria: versão local permanece circular quando o CMS está indisponível',async({page,context})=>{
 const {db}=await mockCMS(context,{offline:true});
 await page.goto('/diretoria.html',{waitUntil:'networkidle'});
 for(const viewport of viewports){
  await page.setViewportSize(viewport);
  await checkPortraits(page,db.leadership_members);
 }
});

test('título contendo BRASA mantém Lato no carregamento e após edição do CMS',async({page,context})=>{
 const {db}=await mockCMS(context);
 const headingRow=db.site_content.find(c=>c.page==='index'&&c.section==='section-01'&&c.field==='text-002');
 headingRow.value='BRASA UH';
 await page.goto('/index.html',{waitUntil:'networkidle'});
 const heading=page.locator('.hero-copy h1');
 await expect(heading).toContainText('BRASA UH');
 const expectLato=async()=>{
  await expect(heading).toHaveClass(/brand-heading/);
  const fonts=await heading.evaluate(el=>[el,...el.querySelectorAll('*')].map(node=>getComputedStyle(node).fontFamily));
  expect(fonts.every(font=>/^['"]?Lato['"]?(?:,|$)/.test(font))).toBe(true);
 };
 await expectLato();
 // The same applyContent entry point serves the dashboard preview and public CMS updates.
 await page.evaluate(async row=>{
  const {applyContent}=await import('/cms/public.js');
  const catalog=await fetch('/cms/content-catalog.json').then(response=>response.json());
  applyContent([{...row,value:'Nossa comunidade'}],catalog);
 },headingRow);
 await expect(heading).not.toHaveClass(/brand-heading/);
 await page.evaluate(async row=>{
  const {applyContent}=await import('/cms/public.js');
  const catalog=await fetch('/cms/content-catalog.json').then(response=>response.json());
  applyContent([{...row,value:'A BRASA conecta'}],catalog);
 },headingRow);
 await expectLato();
});

test('identidade pública: paleta oficial, Lato, logos carregados e responsividade',async({page,context},testInfo)=>{
 test.setTimeout(90000);
 await mockCMS(context);
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 for(const name of pages){
  await page.goto(`/${name}.html`,{waitUntil:'networkidle'});
  const identity=await page.evaluate(async()=>{
   await document.fonts.ready;
   const root=getComputedStyle(document.documentElement);
   return {font:getComputedStyle(document.body).fontFamily,colors:Object.fromEntries(['blue','green','yellow','red'].map(name=>[name,root.getPropertyValue('--'+name).trim().toLowerCase()])),lato:[...document.fonts].some(font=>font.family.replace(/['"]/g,'')==='Lato'&&font.status==='loaded')};
  });
  expect(identity.colors).toEqual({blue:'#065fd8',green:'#03571a',yellow:'#ffcc02',red:'#c8102e'});
  expect(identity.font).toMatch(/^['"]?Lato['"]?(?:,|$)/);
  expect(identity.lato,'Lato must load locally even with external requests blocked').toBe(true);
  const brandHeadingFonts=await page.locator('h1,h2,h3,h4,h5,h6').evaluateAll(headings=>headings.filter(el=>/\bbrasa\b/i.test(el.textContent)).flatMap(el=>[el,...el.querySelectorAll('*')].map(node=>({text:el.textContent.trim(),font:getComputedStyle(node).fontFamily}))));
  expect(brandHeadingFonts.filter(({font})=>!/^['"]?Lato['"]?(?:,|$)/.test(font))).toEqual([]);
  for(const viewport of viewports){
   await page.setViewportSize(viewport);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name} at ${viewport.width}px`).toBe(true);
   if(name==='index'&&viewport.width===320){
    const lines=await page.locator('[data-cms-text="index.section-01.text-003"]').evaluate(el=>{
     const range=document.createRange();range.selectNodeContents(el);
     return [...new Set([...range.getClientRects()].map(rect=>Math.round(rect.y)))].length;
    });
    expect(lines,'The hero word BRASILEIRAS must not leave an isolated letter at 320px').toBe(1);
   }
   for(const img of await page.locator('img:visible').all()){
    await img.scrollIntoViewIfNeeded();
    await expect(img).toHaveAttribute('alt');
    await expect.poll(()=>img.evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
   }
   await page.screenshot({path:testInfo.outputPath(`${name}-${viewport.width}.png`),fullPage:true,style:'.skip:not(:focus) { visibility: hidden; }'});
  }
 }
 expect(errors).toEqual([]);
});
