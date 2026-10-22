import {test,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {mockCMS,login} from './mock.mjs';

test('eventos e parceiros: formulários, imagens, publicação e exclusão',async({page,context})=>{
 const {db,requests}=await mockCMS(context);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await login(page);await expect(page.locator('.metric-card')).toHaveCount(3);
 await page.locator('[data-route="events"]').click();await page.getByRole('button',{name:/Adicionar evento/}).click();
 let dialog=page.getByRole('dialog');await dialog.getByLabel('Título do evento').fill('Evento de teste');await dialog.getByLabel('Data *',{exact:true}).fill('2027-02-15');
 await dialog.getByLabel('Horário de início').fill('23:00');await dialog.getByLabel('Horário de encerramento').fill('01:00');await dialog.getByLabel('Local',{exact:true}).fill('Campus');await dialog.getByLabel('Publicar no site').check();
 await dialog.locator('input[type=file]').setInputFiles(fileURLToPath(new URL('../../assets/uh-logo.png',import.meta.url)));
 await expect(dialog.locator('.upload-message')).toContainText('Imagem enviada');await dialog.getByRole('button',{name:'Criar evento',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(db.events).toHaveLength(1);expect(db.events[0].published).toBe(true);expect(db.events[0].end_time).toBe('01:00');expect(db.events[0].image_url).toContain('/site-images/');expect(requests.filter(r=>r.path.startsWith('/storage/v1/object/site-images/'))).toHaveLength(1);
 await page.locator('.record-row').getByRole('button',{name:'Despublicar',exact:true}).click();await expect(page.locator('.record-row')).toContainText('Rascunho');await page.locator('.record-row').getByRole('button',{name:'Excluir',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Excluir',exact:true}).click();await expect(page.locator('.record-row')).toHaveCount(0);expect(db.events).toHaveLength(0);
 await page.locator('[data-route="partners"]').click();await page.getByRole('button',{name:/Adicionar parceiro/}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Nome da organização').fill('Parceiro de teste');await dialog.getByLabel('Benefícios da parceria').fill('Benefício local de teste');await dialog.getByLabel('Site da organização').fill('https://example.com');await dialog.getByLabel('Publicar no site').check();await dialog.getByRole('button',{name:'Criar parceiro',exact:true}).click();await expect(dialog).toHaveCount(0);
 await page.goto('/parcerias.html');await expect(page.locator('#local-partners')).toContainText('Parceiro de teste');await expect(page.locator('#local-partners')).toContainText('Benefício local de teste');expect(errors).toEqual([]);
});

test('configurações e saída durante confirmação recuperam a navegação',async({page,context})=>{
 const {db}=await mockCMS(context);await login(page);await expect(page.locator('.metric-card')).toHaveCount(3);await page.locator('[data-route="settings"]').click();await page.getByLabel('E-mail público').fill('contato@example.test');await page.getByRole('button',{name:'Salvar alterações',exact:true}).click();await expect(page.getByText('Alterações salvas com sucesso.',{exact:true})).toBeVisible();expect(db.site_settings.find(s=>s.key==='email').value).toBe('contato@example.test');
 await page.getByLabel('E-mail público').fill('rascunho@example.test');await page.locator('[data-route="about"]').click();await expect(page.getByRole('dialog')).toBeVisible();
 await page.evaluate(async()=>{const {getAdminClient}=await import('/cms/client.js');await (await getAdminClient()).auth.signOut({scope:'local'});});
 await expect(page.locator('#login-view')).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);await page.locator('#login-email').fill('admin@example.test');await page.locator('#login-password').fill('local-mock-password');await page.locator('#login-submit').click();await expect(page.locator('#app-shell')).toBeVisible();await page.locator('[data-route="overview"]').click();await expect(page.locator('.metric-card')).toHaveCount(3);
});

test('painel responsivo e revisão visual em desktop, tablet e celular',async({page,context})=>{
 await mockCMS(context);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/admin/');await expect(page.locator('#login-view')).toBeVisible();await page.screenshot({path:'test-results/admin-login-desktop.png',fullPage:true});await login(page);await expect(page.locator('.metric-card')).toHaveCount(3);await expect(page.locator('.metric-card strong').first()).toHaveText('9');await page.screenshot({path:'test-results/admin-overview-desktop.png',fullPage:true});
 for(const width of [768,390]){
  await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();await page.screenshot({path:`test-results/admin-overview-${width}.png`,fullPage:true});
  await page.locator('#sidebar-toggle').click();await page.locator('[data-route="leadership"]').click();await expect(page.locator('.record-row')).toHaveCount(9);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  await page.getByRole('button',{name:/Adicionar integrante/}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('.record-preview')).not.toContainText('null');await page.screenshot({path:`test-results/admin-editor-${width}.png`,fullPage:true});expect(await page.getByRole('dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1)).toBeTruthy();await page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.locator('#sidebar-toggle').click();await page.locator('[data-route="overview"]').click();await expect(page.locator('.metric-card')).toHaveCount(3);
 }
 expect(errors).toEqual([]);
});
