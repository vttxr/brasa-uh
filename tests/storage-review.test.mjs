import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {storageObjectName, imageReferences} from '../admin/media.js';
import {safeImage} from '../cms/safety.js';
import {config} from '../cms/config.js';
import {createClient} from '../cms/vendor/supabase.js';
import {errorText,userError} from '../admin/ui.js';

// Static SQL review and executable JS tests only. No migration or SQL is executed.
test('Storage migration has no bucket writes and keeps all policies scoped to site-images', async () => {
  const sql = (await readFile(new URL('../supabase/migrations/20261022000200_site_images.sql', import.meta.url), 'utf8')).replace(/--[^\n]*/g, '');
  assert.doesNotMatch(sql, /\b(?:insert\s+into|update|delete\s+from|merge\s+into)\s+storage\.buckets\b/i);
  const policies = sql.match(/create policy[\s\S]*?;/gi);
  assert.equal(policies.length, 12);
  for (const policy of policies) {
    if (/as restrictive/i.test(policy)) {
      // This is a source invariant, not a PostgreSQL RLS execution test.
      assert.match(policy, /bucket_id <> 'site-images'/);
      if (/with check/i.test(policy)) assert.match(policy.split(/with check/i)[1], /bucket_id <> 'site-images'/);
    } else {
      assert.match(policy, /bucket_id = 'site-images'/);
      assert.match(policy, /private\.is_admin\(\)/);
    }
  }
  assert.equal((sql.match(/create function /g) || []).length, 2);
});

test('image reference parser handles encoded, transformed, signed and malformed paths', () => {
  const cases = [
    ['https://project.supabase.co/storage/v1/object/public/site-images/folder/photo%2D1.png?download=1#hero', 'folder/photo-1.png'],
    ['https://project.supabase.co/storage/v1/render/image/public/site-images/folder%2Ffoto%20a%C3%A7%C3%A3o.png?width=300', 'folder/foto ação.png'],
    ['https://project.supabase.co/storage/v1/render/image/sign/site-images/a%252Db.png?token=example', 'a%2Db.png'],
    ['/storage/v1/object/authenticated/site-images/a%23b%3Fc.png', 'a#b?c.png'],
    ['site-images/photo+1.png', 'photo+1.png'],
    ['photo%2B1.png', 'photo+1.png'],
    ['photo%2D%ZZ.png', 'photo-%ZZ.png'],
    ['photo%00.png', 'photo%00.png'],
    ['photo%C3%28.png', 'photo%C3%28.png'],
    ['https://project.supabase.co/storage/v1/object/public/other-bucket/photo.png', ''],
    ['https://example.com/photo.png', ''],
    ['', ''],
  ];
  for (const [value, expected] of cases) assert.equal(storageObjectName(value), expected, value);
});

test('reference scan includes drafts and URL fields without restricting to image kind', async () => {
  const url = config.url + '/storage/v1/object/public/site-images/photo-1.png';
  const transformed = config.url + '/storage/v1/render/image/public/site-images/photo%2D1.png?width=300';
  const rows = {
    site_content:[{page:'index',section:'hero',field:'cta',kind:'url',value:transformed,published:false}],
    site_settings:[{key:'link',kind:'url',value:url,published:false}],
    leadership_members:[{full_name:'Fixture',photo_url:'',linkedin_url:transformed,published:false}],
    events:[{title:'Fixture',image_url:'',registration_url:url,published:false}],
    partners:[{name:'Fixture',logo_url:'',website_url:transformed,published:false}],
  };
  const client = {from(table) {return {select(){return this;},order(){return this;},async range(){return {data:rows[table],error:null};}};}};
  const references = await imageReferences(client,url);
  assert.equal(references.length,5);
  assert.equal((await imageReferences(client,url.replace('photo-1','unused'))).length,0);
});

test('SDK public image URL needs no session and is accepted by the public renderer', () => {
  const client = createClient(config.url,config.publishableKey,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:()=>{throw new Error('No network is allowed in this test.');}},
  });
  const {data} = client.storage.from('site-images').getPublicUrl('folder/photo-1.png');
  assert.equal(data.publicUrl,config.url+'/storage/v1/object/public/site-images/folder/photo-1.png');
  assert.equal(safeImage(data.publicUrl),data.publicUrl);
});

test('unconfirmed deletion keeps its specific message instead of claiming a known reference', () => {
  const message='A exclusão não foi confirmada. O arquivo pode estar em uso ou seu acesso pode ter mudado.';
  assert.equal(errorText(userError(message)),message);
});
