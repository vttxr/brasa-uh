import {test,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {mockCMS,login} from './mock.mjs';
const photo=fileURLToPath(new URL('../../assets/uh-logo.png',import.meta.url));

test('upload, replacement, public URL and draft-protected deletion with mocked Storage',async({page,context})=>{
 const {db,requests,files}=await mockCMS(context);
 await login(page);await expect(page.locator('.metric-card')).toHaveCount(3);
 await page.locator('[data-route="leadership"]').click();
 const first=page.locator('.record-row').first();await first.getByRole('button',{name:'Editar',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.locator('input[type=file]').setInputFiles(photo);await expect(dialog.locator('.upload-message')).toContainText('Imagem enviada');
 await dialog.getByRole('button',{name:'Salvar alterações',exact:true}).click();await expect(dialog).toHaveCount(0);
 const oldURL=db.leadership_members[0].photo_url;expect(files).toHaveLength(1);
 await first.getByRole('button',{name:'Editar',exact:true}).click();await dialog.locator('input[type=file]').setInputFiles(photo);await expect(dialog.locator('.upload-message')).toContainText('Imagem enviada');
 await dialog.getByRole('button',{name:'Salvar alterações',exact:true}).click();await expect(dialog).toHaveCount(0);
 const newURL=db.leadership_members[0].photo_url;expect(newURL).not.toEqual(oldURL);expect(files).toHaveLength(2);
 const deletes=()=>requests.filter(r=>r.path==='/storage/v1/object/site-images'&&r.method==='DELETE');expect(deletes()).toHaveLength(0);

 // Image can be rendered publicly even after the admin session has ended.
 const publicPage=await context.newPage();await publicPage.goto('/diretoria.html');
 await expect(publicPage.locator('.officer img').first()).toHaveAttribute('src',newURL);
 await publicPage.evaluate(async()=>{const {getAdminClient}=await import('/cms/client.js');await (await getAdminClient()).auth.signOut({scope:'local'});});
 const response=await publicPage.goto(newURL);expect(response.status()).toBe(200);expect(response.headers()['content-type']).toContain('image/png');
 expect(requests.at(-1).authorization).toBeUndefined();await publicPage.close();

 await login(page);await expect(page.locator('#app-shell')).toBeVisible();
 // A transformed/encoded reference in a draft protects the replaced file too.
 const oldName=oldURL.split('/').pop();
 db.site_content.push({id:'draft-image-reference',page:'index',section:'review',field:'link',kind:'url',published:false,value:oldURL.replace('/object/public/','/render/image/public/').replace(oldName,oldName.replaceAll('-','%2D'))+'?width=200'});
 await page.locator('[data-route="images"]').click();await expect(page.locator('.media-card')).toHaveCount(2);
 const oldCard=page.locator('.media-card').filter({hasText:oldName});await oldCard.getByRole('button',{name:'Excluir',exact:true}).click();await expect(dialog).toContainText('Esta imagem está em uso.');await dialog.getByRole('button',{name:'Entendi',exact:true}).click();expect(deletes()).toHaveLength(0);
 db.site_content=db.site_content.filter(row=>row.id!=='draft-image-reference');
 await oldCard.getByRole('button',{name:'Excluir',exact:true}).click();await dialog.getByRole('button',{name:'Excluir imagem',exact:true}).click();await expect(oldCard).toHaveCount(0);expect(files).toHaveLength(1);expect(deletes()).toHaveLength(1);
});

test('zero-row Storage deletion is not reported as success',async({page,context})=>{
 const {files}=await mockCMS(context,{storageDeleteEmpty:true});
 files.push({id:'orphan-id',name:'orphan.png',metadata:{size:512},created_at:'2026-10-22T12:00:00Z'});
 await login(page);await expect(page.locator('.metric-card')).toHaveCount(3);await page.locator('[data-route="images"]').click();
 const card=page.locator('.media-card');await expect(card).toHaveCount(1);await card.getByRole('button',{name:'Excluir',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Excluir imagem',exact:true}).click();
 await expect(page.locator('#notifications')).toContainText('A exclusão não foi confirmada');await expect(card).toHaveCount(1);expect(files).toHaveLength(1);
});
