import {test,expect} from '@playwright/test';
import {mockCMS} from './mock.mjs';

test('network logo keeps its versioned URL after legacy CMS content loads',async({page,context})=>{
 const {db}=await mockCMS(context);
 db.site_content.find(c=>c.page==='index'&&c.section==='section-04'&&c.field==='image-001').value='assets/brasa-uh-outline.png';
 await page.goto('/index.html',{waitUntil:'networkidle'});
 const logo=page.locator('.network-crest img');
 await expect(logo).toHaveAttribute('src',/brasa-uh-outline\.png\?v=7e105ed66b07$/);
 await expect.poll(()=>logo.evaluate(i=>i.naturalWidth)).toBeGreaterThan(0);
});

test('network logo recovers from failed downloads without a retry loop',async({page,context})=>{
 await mockCMS(context);
 await context.route('**/assets/brasa-uh-outline.png*',r=>r.abort());
 await page.goto('/index.html',{waitUntil:'networkidle'});
 const logo=page.locator('.network-crest img');
 await expect(logo).toHaveAttribute('src',/assets\/brasa-uh-color\.png$/);
 await expect.poll(()=>logo.evaluate(i=>i.naturalWidth)).toBeGreaterThan(0);
 let requests=0;
 await context.route('**/assets/brasa-uh-color.png',r=>{requests++;return r.abort();});
 await page.reload({waitUntil:'networkidle'});
 await expect(logo).toHaveAttribute('src',/assets\/brasa-uh-color\.png$/);
 expect(requests).toBeGreaterThan(0);
 expect(requests).toBeLessThan(8);
});
