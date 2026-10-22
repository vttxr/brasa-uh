import {test,expect} from '@playwright/test';
import {mockCMS,login} from './mock.mjs';
test('páginas públicas: conteúdo, navegação, menu móvel e ausência de erros JS',async({page,context})=>{
 const {requests}=await mockCMS(context);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const path of ['/','/quem-somos.html','/diretoria.html','/calendario.html','/parcerias.html','/faca-parte.html']){
  await page.goto(path);await expect(page.locator('main')).toBeVisible();await expect(page.locator('#nav a')).toHaveCount(6);
  await page.waitForLoadState('networkidle');expect(await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>!i.hidden&&(!i.complete||i.naturalWidth===0)).map(i=>i.src))).toEqual([]);
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  await page.locator('#menu-toggle').click();await expect(page.locator('#nav')).toHaveClass(/open/);await page.keyboard.press('Escape');await expect(page.locator('#menu-toggle')).toHaveAttribute('aria-expanded','false');
  await page.setViewportSize({width:1440,height:1000});
 }
 expect(errors).toEqual([]);expect(requests.filter(r=>r.path.includes('/rest/')).every(r=>r.search.includes('published=eq.true'))).toBeTruthy();
});
test('calendário, abas e dados editados do CMS',async({page,context})=>{
 const {db}=await mockCMS(context);const date=await page.evaluate(()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
 db.events.push({id:'event-1',title:'Encontro de teste local',event_date:date,start_time:'23:00:00',end_time:'01:00:00',category:'Cultura',location:'Campus',description:'Teste automatizado',published:true});
 await page.goto('/calendario.html');await expect(page.locator('.event-row')).toContainText('Encontro de teste local');await expect(page.locator('.event-row time')).toContainText('(dia seguinte)');const label=await page.locator('#month-label').textContent();
 await page.locator('#next-month').click();await expect(page.locator('.event-row')).toHaveCount(0);await page.locator('#today').click();await expect(page.locator('#month-label')).toHaveText(label);
 await page.selectOption('#category','Social');await expect(page.locator('.event-row')).toHaveCount(0);await page.selectOption('#category','Cultura');await expect(page.locator('.event-row')).toHaveCount(1);
 await page.goto('/parcerias.html#global');await expect(page.locator('#global-tab')).toHaveAttribute('aria-selected','true');await page.locator('#local-tab').click();await expect(page.locator('#local-tab')).toHaveAttribute('aria-selected','true');
 await page.goto('/');await expect(page.locator('.calendar-teaser h3')).toHaveText('Encontro de teste local');
});
test('falha de API conserva a diretoria original',async({page,context})=>{
 await mockCMS(context,{offline:true});await page.goto('/diretoria.html');await expect(page.locator('.officer')).toHaveCount(9);await page.waitForLoadState('networkidle');await expect(page.locator('.officer')).toHaveCount(9);await expect(page.locator('.officer').first()).toContainText('Pedro Souza');
});
test('login, restauração, autorização e sessão pública independente',async({page,context})=>{
 const {requests}=await mockCMS(context);await login(page);await expect(page.locator('#app-shell')).toBeVisible();await expect(page.locator('.metric-card')).toHaveCount(3);await page.reload();await expect(page.locator('#app-shell')).toBeVisible();
 await page.goto('/diretoria.html');await expect(page.locator('.officer')).toHaveCount(9);await page.waitForLoadState('networkidle');const publicRequest=requests.filter(r=>r.path.endsWith('/leadership_members')&&r.search.includes('published=eq.true')).at(-1);expect(publicRequest.authorization).not.toContain('mock-access-token');
 await page.goto('/admin/');await expect(page.locator('#app-shell')).toBeVisible();await page.locator('#logout').click();await expect(page.locator('#login-view')).toBeVisible();
});
test('usuário autenticado sem autorização não recebe painel',async({page,context})=>{
 await mockCMS(context,{authorized:false});await login(page);await expect(page.locator('#login-message')).toContainText('não está autorizada');await expect(page.locator('#app-shell')).toBeHidden();expect(await page.evaluate(()=>localStorage.getItem('brasa-uh-admin-auth'))).toBeNull();
});
test('editor: prévia segura, salvar apenas campos alterados e publicar no site',async({page,context})=>{
 const {db,requests}=await mockCMS(context);await login(page);await expect(page.locator('#app-shell')).toBeVisible();await page.locator('[data-route="home"]').click();
 await expect(page.locator('.content-field').first()).toBeVisible();
 const edit=page.locator('.content-field').filter({has:page.locator('label', {hasText:'Botão / link: Ir para o conteúdo'})}).first();await edit.locator('input:not([type=checkbox])').fill('Pular para o conteúdo');
 await page.getByRole('button',{name:/prévia/i}).first().click();await expect(page.frameLocator('.site-preview').locator('.skip')).toHaveText('Pular para o conteúdo');
 await page.getByRole('button',{name:'Salvar alterações',exact:true}).click();await expect(page.getByText('Alterações salvas com sucesso.',{exact:true})).toBeVisible();
 const saves=requests.filter(r=>r.path.endsWith('/site_content')&&r.method==='POST');expect(JSON.parse(saves.at(-1).body)).toHaveLength(1);expect(db.site_content.some(c=>c.value==='Pular para o conteúdo')).toBeTruthy();
 await page.goto('/');await expect(page.locator('.skip')).toHaveText('Pular para o conteúdo');
});
test('diretoria: criar rascunho, editar, publicar, ordenar e excluir com confirmação',async({page,context})=>{
 const {db}=await mockCMS(context);await login(page);await expect(page.locator('#app-shell')).toBeVisible();await page.locator('[data-route="leadership"]').click();await page.getByRole('button',{name:/Adicionar integrante/}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Nome completo').fill('Pessoa de teste');await dialog.getByLabel('Cargo *',{exact:true}).fill('Teste local');await dialog.getByRole('button',{name:'Criar integrante',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(db.leadership_members.find(r=>r.full_name==='Pessoa de teste')?.published).toBe(false);
 const row=page.locator('.record-row').filter({hasText:'Pessoa de teste'});await row.getByRole('button',{name:'Publicar',exact:true}).click();await expect(row).toContainText('Publicado');
 await row.getByRole('button',{name:'Editar',exact:true}).click();await dialog.getByLabel('Cargo *',{exact:true}).fill('Cargo atualizado');await dialog.getByRole('button',{name:'Salvar alterações',exact:true}).click();await expect(row).toContainText('Cargo atualizado');
 await row.getByRole('button',{name:/Mover.*cima|Subir/i}).click();await expect.poll(()=>db.leadership_members.find(r=>r.full_name==='Pessoa de teste').display_order).toBe(80);
 await row.getByRole('button',{name:'Excluir',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:/Excluir/}).click();await expect(row).toHaveCount(0);expect(db.leadership_members).toHaveLength(9);
});
