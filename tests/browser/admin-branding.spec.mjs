import {test,expect} from '@playwright/test';
import {mockCMS,login} from './mock.mjs';

const portraitViewports=[320,390,1440];

async function navigate(page,route){
 const toggle=page.locator('#sidebar-toggle');
 if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
 await page.locator(`#admin-nav [data-route="${route}"]`).click();
}

async function shapeOf(locator){
 await locator.scrollIntoViewIfNeeded();
 return locator.evaluate(async el=>{
  if(el instanceof HTMLImageElement)await el.decode();
  const style=getComputedStyle(el),rect=el.getBoundingClientRect();
  const radii=['borderTopLeftRadius','borderTopRightRadius','borderBottomLeftRadius','borderBottomRightRadius'].map(key=>{
   const value=style[key].split(' ')[0];
   return parseFloat(value)*(value.endsWith('%')?rect.width/100:1);
  });
  return {width:rect.width,height:rect.height,radii,fit:style.objectFit,photo:el instanceof HTMLImageElement,loaded:!(el instanceof HTMLImageElement)||el.complete&&el.naturalWidth>0};
 });
}

async function expectCircle(locator){
 const shape=await shapeOf(locator);
 expect(shape.width).toBeGreaterThan(30);
 expect(Math.abs(shape.width-shape.height)).toBeLessThan(1);
 expect(Math.min(...shape.radii)).toBeGreaterThanOrEqual(shape.width/2-.5);
 expect(shape.loaded).toBe(true);
 if(shape.photo)expect(shape.fit).toBe('cover');
 return shape;
}

async function expectRectangle(locator){
 const shape=await shapeOf(locator);
 expect(shape.loaded).toBe(true);
 expect(Math.max(...shape.radii)).toBeLessThan(Math.min(shape.width,shape.height)*.45);
}

test('admin usa Lato local e a mesma paleta BRASA e UH do site público',async({page,context})=>{
 await mockCMS(context);
 const readIdentity=()=>page.evaluate(async()=>{
  await document.fonts.ready;
  const root=getComputedStyle(document.documentElement);
  return {bodyFont:getComputedStyle(document.body).fontFamily,colors:Object.fromEntries(['blue','green','yellow','red'].map(name=>[name,root.getPropertyValue('--'+name).trim().toLowerCase()])),loadedLato:[...document.fonts].some(face=>face.family.replace(/['"]/g,'')==='Lato'&&face.status==='loaded')};
 });
 await page.goto('/index.html',{waitUntil:'networkidle'});
 const publicIdentity=await readIdentity();
 await page.goto('/admin/',{waitUntil:'networkidle'});
 await expect(page.locator('#login-view')).toBeVisible();
 const adminIdentity=await readIdentity();
 expect(adminIdentity.colors).toEqual(publicIdentity.colors);
 expect(adminIdentity.colors).toEqual({blue:'#065fd8',green:'#03571a',yellow:'#ffcc02',red:'#c8102e'});
 expect(adminIdentity.loadedLato).toBe(true);
 expect(adminIdentity.bodyFont).toMatch(/^['"]?Lato['"]?(?:,|$)/);
 for(const control of ['#login-email','#login-password','#login-submit','.login-card h2']){
  expect(await page.locator(control).evaluate(el=>getComputedStyle(el).fontFamily)).toMatch(/^['"]?Lato['"]?(?:,|$)/);
 }
 for(const img of await page.locator('#login-view .brand img').all())expect((await shapeOf(img)).loaded).toBe(true);
 await login(page);
 await expect(page.locator('#app-shell')).toBeVisible();
 expect(await page.locator('#admin-nav').evaluate(el=>getComputedStyle(el).fontFamily)).toMatch(/^['"]?Lato['"]?(?:,|$)/);
});

test('admin mantém fotos e iniciais circulares na diretoria e no editor responsivo',async({page,context},testInfo)=>{
 test.setTimeout(60000);
 const {db}=await mockCMS(context);
 // Assets belong only to the intercepted fixture; no CMS record is saved.
 db.leadership_members[0].photo_url='assets/uh-logo.png';
 db.leadership_members[1].photo_url='';
 const original=structuredClone(db.leadership_members);
 await login(page);
 await expect(page.locator('#app-shell')).toBeVisible();
 await navigate(page,'leadership');
 await expect(page.locator('.record-row')).toHaveCount(original.length);
 for(const width of portraitViewports){
  await page.setViewportSize({width,height:900});
  const imageRow=page.locator('.record-row').filter({hasText:original[0].full_name});
  const initialsRow=page.locator('.record-row').filter({hasText:original[1].full_name});
  const imageShape=await expectCircle(imageRow.locator('.record-thumbnail'));
  const placeholderShape=await expectCircle(initialsRow.locator('.record-initials'));
  expect(Math.abs(imageShape.width-placeholderShape.width)).toBeLessThan(1);
  for(const [index,row] of [imageRow,initialsRow].entries()){
   await expect(row.locator('.record-info h3')).toHaveText(original[index].full_name);
   await expect(row.locator('.record-info p')).toHaveText(original[index].role);
   await row.getByRole('button',{name:'Editar',exact:true}).click();
   const dialog=page.getByRole('dialog');
   await expect(dialog.getByLabel('Nome completo')).toHaveValue(original[index].full_name);
   await expect(dialog.getByLabel('Cargo *',{exact:true})).toHaveValue(original[index].role);
   await expectCircle(dialog.locator('.record-preview-image,.preview-placeholder'));
   if(index===0)await expectCircle(dialog.locator('.image-field .image-preview'));
   expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
   await dialog.screenshot({path:testInfo.outputPath(`leadership-${index===0?'photo':'initials'}-${width}.png`)});
   await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
   await expect(dialog).toHaveCount(0);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
 expect(db.leadership_members).toEqual(original);
});

test('admin preserva imagens de eventos e parceiros com cantos não circulares',async({page,context})=>{
 test.setTimeout(60000);
 const {db}=await mockCMS(context);
 db.events.push({id:'shape-event',title:'Evento visual de teste',event_date:'2027-02-15',category:'Cultura',location:'Campus',image_url:'assets/uh-campus.jpg',published:true});
 db.events.push({id:'shape-event-empty',title:'Evento sem imagem',event_date:'2027-02-16',category:'Cultura',image_url:'',published:false});
 db.partners.push({id:'shape-partner',name:'Parceiro visual de teste',logo_url:'assets/uh-logo.png',benefit:'Benefício de teste',display_order:0,published:true});
 db.partners.push({id:'shape-partner-empty',name:'Parceiro sem imagem',logo_url:'',display_order:1,published:false});
 const original=structuredClone({events:db.events,partners:db.partners});
 await login(page);
 await expect(page.locator('#app-shell')).toBeVisible();
 for(const route of ['events','partners']){
  await navigate(page,route);
  await expect(page.locator('.record-row')).toHaveCount(2);
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:900});
   for(const row of await page.locator('.record-row').all()){
    await expectRectangle(row.locator('.record-thumbnail,.record-initials'));
    await row.getByRole('button',{name:'Editar',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await expectRectangle(dialog.locator('.record-preview-image,.preview-placeholder'));
    for(const image of await dialog.locator('.image-field .image-preview:visible').all())await expectRectangle(image);
    expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
    await expect(dialog).toHaveCount(0);
   }
  }
 }
 expect({events:db.events,partners:db.partners}).toEqual(original);
});
