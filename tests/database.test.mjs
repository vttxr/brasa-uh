import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// These are real migration/RLS tests in local PostgreSQL WASM, never remote SQL.
// Only Supabase's surrounding auth/storage schemas are minimal test doubles.
// No JWT verification, Auth HTTP API, Storage file bytes/MIME/size enforcement,
// PostgREST behavior, CDN/public-file serving or concurrent transactions are emulated.
const root = new URL('../', import.meta.url);
const contentTables = ['site_content', 'leadership_members', 'events', 'partners', 'site_settings'];
const identities = {
  admin: 'fe220001-0000-4000-8000-000000000001',
  ordinary: 'fe220001-0000-4000-8000-000000000002',
  editor: 'fe220001-0000-4000-8000-000000000003',
};

const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public to anon, authenticated;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable set search_path = '' as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create schema storage;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text not null references storage.buckets(id),
    name text not null,
    metadata jsonb not null default '{}',
    unique (bucket_id, name)
  );
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, update, delete on storage.objects to anon, authenticated;
`;

function fixture(table, label, published = false) {
  const id = randomUUID();
  switch (table) {
    case 'site_content': return { id, page: '__local_test__', section: label, field: 'value', value: label, published };
    case 'leadership_members': return { id, full_name: label, role: 'Teste local', published };
    case 'events': return { id, title: label, event_date: '2030-06-15', published };
    case 'partners': return { id, name: label, published };
    case 'site_settings': return { key: `test-${label}`, value: label, published };
    default: throw new Error(`Unexpected table: ${table}`);
  }
}

function keyOf(table) { return table === 'site_settings' ? 'key' : 'id'; }

async function insertRecord(db, table, record) {
  const fields = Object.keys(record);
  const sql = `insert into public.${table} (${fields.join(',')}) values (${fields.map((_, i) => `$${i + 1}`).join(',')}) returning *`;
  return (await db.query(sql, Object.values(record))).rows[0];
}

async function asRole(db, identity, action) {
  const role = identity === 'anon' ? 'anon' : 'authenticated';
  await db.exec('begin');
  try {
    await db.exec(`set local role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [identities[identity] ?? '']);
    const result = await action();
    await db.exec('commit');
    return result;
  } catch (error) {
    await db.exec('rollback');
    throw error;
  }
}

async function denied(action, message) {
  await assert.rejects(action, error => error.code === '42501', message);
}

async function rowByKey(db, table, key) {
  return (await db.query(`select * from public.${table} where ${keyOf(table)} = $1`, [key])).rows[0];
}

test('CMS database: real local migrations, RLS, Storage policies and non-destructive seed', async t => {
  const db = new PGlite();
  try {
    await db.exec(bootstrap);
    for (const migration of ['20261022000100_cms_schema.sql', '20261022000200_site_images.sql']) {
      await db.exec(await readFile(new URL(`supabase/migrations/${migration}`, root), 'utf8'));
    }
    for (const [identity, id] of Object.entries(identities)) {
      await db.query('insert into auth.users(id,email) values ($1,$2)', [id, `${identity}@example.invalid`]);
    }
    await db.query('insert into public.admin_users(user_id,role) values ($1,$2),($3,$4)',
      [identities.admin, 'admin', identities.editor, 'editor']);

    await t.test('all exposed CMS tables have RLS; membership helper has a fixed search path', async () => {
      const tables = (await db.query(`select relname, relrowsecurity from pg_class
        where relnamespace = 'public'::regnamespace and relname = any($1::text[])`,
      [[...contentTables, 'admin_users']])).rows;
      assert.equal(tables.length, 6);
      assert.ok(tables.every(row => row.relrowsecurity));
      const { rows: [helper] } = await db.query(`select prosecdef, proconfig, pg_get_userbyid(proowner) as owner
        from pg_proc where oid = 'private.is_admin()'::regprocedure`);
      assert.equal(helper.prosecdef, true);
      assert.equal(helper.owner, 'postgres');
      assert.ok(helper.proconfig.includes('search_path=""'));
    });

    await t.test('seed runs twice without duplicates or overwriting administrator edits', async () => {
      const seed = await readFile(new URL('supabase/seed.sql', root), 'utf8');
      await db.exec(seed);
      const counts = async () => Object.fromEntries(await Promise.all(contentTables.map(async table =>
        [table, (await db.query(`select count(*)::integer as count from public.${table}`)).rows[0].count])));
      const firstCounts = await counts();
      assert.ok(firstCounts.site_content > 0);
      assert.equal(firstCounts.leadership_members, 9);
      const content = (await db.query('select id from public.site_content order by id limit 1')).rows[0];
      const member = (await db.query('select id from public.leadership_members order by display_order limit 1')).rows[0];
      await asRole(db, 'admin', async () => {
        await db.query('update public.site_content set value=$1 where id=$2', ['Edição mantida', content.id]);
        await db.query('update public.leadership_members set biography=$1 where id=$2', ['Biografia mantida', member.id]);
        await db.query("update public.site_settings set value=$1 where key='email'", ['test@example.invalid']);
      });
      await db.exec(seed);
      assert.deepEqual(await counts(), firstCounts);
      assert.equal((await rowByKey(db, 'site_content', content.id)).value, 'Edição mantida');
      assert.equal((await rowByKey(db, 'leadership_members', member.id)).biography, 'Biografia mantida');
      assert.equal((await rowByKey(db, 'site_settings', 'email')).value, 'test@example.invalid');
    });

    const fixtures = {};
    for (const table of contentTables) {
      fixtures[table] = {
        published: await insertRecord(db, table, fixture(table, `${table}-public`, true)),
        draft: await insertRecord(db, table, fixture(table, `${table}-draft`, false)),
      };
    }

    for (const identity of ['anon', 'ordinary']) {
      for (const table of contentTables) {
        await t.test(`${identity}: ${table} shows only published fixtures and rejects inserts`, async () => {
          const { published, draft } = fixtures[table];
          const key = keyOf(table);
          const rows = await asRole(db, identity, async () => (await db.query(
            `select ${key} from public.${table} where ${key} in ($1,$2)`, [published[key], draft[key]])).rows);
          assert.deepEqual(rows, [{ [key]: published[key] }]);
          await denied(() => asRole(db, identity, () => insertRecord(db, table,
            fixture(table, `${identity}-${table}-denied`))), 'unprivileged INSERT must be rejected');
        });
      }
    }

    for (const table of contentTables) {
      await t.test(`${table}: unauthorized UPDATE/DELETE do not change rows`, async () => {
        const key = keyOf(table);
        const id = fixtures[table].published[key];
        await denied(() => asRole(db, 'anon', () => db.query(
          `update public.${table} set published=false where ${key}=$1 returning ${key}`, [id])));
        await denied(() => asRole(db, 'anon', () => db.query(
          `delete from public.${table} where ${key}=$1 returning ${key}`, [id])));
        const updated = await asRole(db, 'ordinary', () => db.query(
          `update public.${table} set published=false where ${key}=$1 returning ${key}`, [id]));
        const deleted = await asRole(db, 'ordinary', () => db.query(
          `delete from public.${table} where ${key}=$1 returning ${key}`, [id]));
        assert.deepEqual(updated.rows, [], 'RLS-filtered UPDATE silently matches zero rows');
        assert.deepEqual(deleted.rows, [], 'RLS-filtered DELETE silently matches zero rows');
        assert.equal((await rowByKey(db, table, id)).published, true, 'target remains intact');
      });
    }

    await t.test('only own membership is readable and no client can self-promote or edit authorization', async () => {
      await denied(() => asRole(db, 'anon', () => db.query('select * from public.admin_users')));
      for (const identity of ['ordinary', 'admin', 'editor']) {
        const rows = await asRole(db, identity, () => db.query('select user_id from public.admin_users'));
        assert.deepEqual(rows.rows, identity === 'ordinary' ? [] : [{ user_id: identities[identity] }]);
        await denied(() => asRole(db, identity, () => db.query(
          "insert into public.admin_users(user_id,role) values ($1,'admin')", [identities.ordinary])));
        await denied(() => asRole(db, identity, () => db.query("update public.admin_users set role='admin'")));
        await denied(() => asRole(db, identity, () => db.query('delete from public.admin_users')));
      }
      assert.equal((await db.query('select count(*)::integer as count from public.admin_users')).rows[0].count, 2);
    });

    for (const identity of ['admin', 'editor']) {
      for (const table of contentTables) {
        await t.test(`${identity}: ${table} supports real draft read/create/update/delete`, async () => {
          const key = keyOf(table);
          const result = await asRole(db, identity, async () => {
            const existingDraft = await rowByKey(db, table, fixtures[table].draft[key]);
            assert.equal(existingDraft.published, false);
            const created = await insertRecord(db, table, fixture(table, `${identity}-${table}-crud`));
            assert.equal(created.published, false);
            const update = table === 'leadership_members' || table === 'partners'
              ? 'published=true,display_order=7' : 'published=true';
            const { rows: [changed] } = await db.query(
              `update public.${table} set ${update} where ${key}=$1 returning *`, [created[key]]);
            assert.equal(changed.published, true);
            if ('display_order' in changed) assert.equal(changed.display_order, 7);
            assert.deepEqual((await db.query(`delete from public.${table} where ${key}=$1 returning ${key}`,
              [created[key]])).rows, [{ [key]: created[key] }]);
            return created[key];
          });
          assert.equal(await rowByKey(db, table, result), undefined);
        });
      }
    }

    await t.test('database owns modification timestamps and preserves creation timestamps', async () => {
      const initial = await insertRecord(db, 'site_content', {
        ...fixture('site_content', 'timestamps'), created_at: '2001-01-01T00:00:00Z',
      });
      const { rows: [updated] } = await asRole(db, 'admin', () => db.query(`
        update public.site_content set created_at='1900-01-01',updated_at='1900-01-01'
        where id=$1 returning created_at,updated_at`, [initial.id]));
      assert.equal(new Date(updated.created_at).toISOString(), '2001-01-01T00:00:00.000Z');
      assert.ok(new Date(updated.updated_at).getTime() > Date.parse('2020-01-01'));
    });

    for (const identity of ['admin', 'editor']) {
      for (const table of ['leadership_members', 'partners']) {
        await t.test(`${identity}: ${table} reorder RPC preserves names/publication`, async () => {
          const first = await insertRecord(db, table, { ...fixture(table, `${identity}-${table}-order-a`, true), display_order: 101 });
          const second = await insertRecord(db, table, { ...fixture(table, `${identity}-${table}-order-b`, false), display_order: 202 });
          const titleField = table === 'leadership_members' ? 'full_name' : 'name';
          // Simulate a newer edit by another admin after the list was first loaded.
          await asRole(db, 'admin', () => db.query(`update public.${table} set ${titleField}=$1 where id=$2`,
            ['Nome editado por outro administrador', first.id]));
          const before = (await db.query(`select id,${titleField},published from public.${table} where id in ($1,$2) order by id`,
            [first.id, second.id])).rows;
          const result = await asRole(db, identity, () => db.query(
            'select public.reorder_cms_records($1,$2::uuid[]) as affected', [table, [second.id, first.id]]));
          assert.equal(result.rows[0].affected, 2);
          assert.deepEqual((await db.query(`select id,display_order from public.${table} where id in ($1,$2) order by display_order`,
            [first.id, second.id])).rows, [{ id: second.id, display_order: 10 }, { id: first.id, display_order: 20 }]);
          assert.deepEqual((await db.query(`select id,${titleField},published from public.${table} where id in ($1,$2) order by id`,
            [first.id, second.id])).rows, before, 'reordering must not overwrite a newer name or published state');
        });
      }
    }

    await t.test('reorder RPC rejects unauthorized callers and invalid tables/IDs', async () => {
      const member = fixtures.leadership_members.published;
      for (const identity of ['anon', 'ordinary']) {
        await denied(() => asRole(db, identity, () => db.query(
          'select public.reorder_cms_records($1,$2::uuid[])', ['leadership_members', [member.id]])));
      }
      for (const [entity, ids] of [
        ['events', [member.id]],
        ['leadership_members; delete from public.admin_users', [member.id]],
        [null, [member.id]],
        ['leadership_members', null],
        ['leadership_members', [member.id, null]],
        ['leadership_members', [member.id, member.id]],
      ]) {
        await assert.rejects(() => asRole(db, 'admin', () => db.query(
          'select public.reorder_cms_records($1,$2::uuid[])', [entity, ids])),
        error => error.code === '22023', 'invalid reorder input must fail before changing records');
      }
      const { rows: [fn] } = await db.query(`select prosecdef from pg_proc
        where oid='public.reorder_cms_records(text,uuid[])'::regprocedure`);
      assert.equal(fn.prosecdef, false, 'RPC must keep invoker grants and RLS');
      assert.equal((await rowByKey(db, 'leadership_members', member.id)).display_order, member.display_order);
    });

    await t.test('reorder RPC rolls back all order changes when any requested ID is missing', async () => {
      for (const table of ['leadership_members', 'partners']) {
        const row = await insertRecord(db, table, { ...fixture(table, `${table}-order-rollback`, true), display_order: 777 });
        const before = await rowByKey(db, table, row.id);
        await assert.rejects(() => asRole(db, 'admin', () => db.query(
          'select public.reorder_cms_records($1,$2::uuid[])', [table, [row.id, randomUUID()]])),
        error => error.code === '22023');
        assert.deepEqual(await rowByKey(db, table, row.id), before,
          'failed reorder must roll back display_order and trigger timestamps together');
      }
    });

    await t.test('bucket is public with configured 5 MiB JPEG/PNG/WebP restrictions', async () => {
      const { rows: [bucket] } = await db.query("select * from storage.buckets where id='site-images'");
      assert.equal(bucket.public, true);
      assert.equal(Number(bucket.file_size_limit), 5242880);
      assert.deepEqual(bucket.allowed_mime_types, ['image/jpeg', 'image/png', 'image/webp']);
      // The actual Storage service validates bytes/Content-Type/size, not PostgreSQL.
    });

    await t.test('restrictive storage policies survive an unrelated legacy allow-all policy', async () => {
      await db.exec(`create policy test_legacy_allow_all on storage.objects for all
        to anon,authenticated using (true) with check (true)`);
      const name = `tests/${randomUUID()}.png`;
      const inserted = await asRole(db, 'admin', () => db.query(
        "insert into storage.objects(bucket_id,name) values ('site-images',$1) returning id", [name]));
      assert.equal(inserted.rows.length, 1);
      for (const identity of ['anon', 'ordinary']) {
        assert.deepEqual((await asRole(db, identity, () => db.query(
          "select * from storage.objects where bucket_id='site-images'"))).rows, []);
        await denied(() => asRole(db, identity, () => db.query(
          "insert into storage.objects(bucket_id,name) values ('site-images',$1)", [`tests/${randomUUID()}.png`])));
        assert.deepEqual((await asRole(db, identity, () => db.query(
          'update storage.objects set metadata=$1 where name=$2 returning id', [{ test: true }, name]))).rows, []);
        assert.deepEqual((await asRole(db, identity, () => db.query(
          'delete from storage.objects where name=$1 returning id', [name]))).rows, []);
      }
      assert.equal((await db.query('select count(*)::integer as count from storage.objects where name=$1', [name])).rows[0].count, 1);
      await denied(() => asRole(db, 'admin', () => db.query(
        "insert into storage.objects(bucket_id,name) values ('site-images','tests/blocked.svg')")));
      const removed = await asRole(db, 'editor', () => db.query(
        'delete from storage.objects where name=$1 returning id', [name]));
      assert.equal(removed.rows.length, 1, 'editor can remove an unreferenced object');
    });

    for (const table of contentTables) {
      await t.test(`${table}: even a draft protects its referenced image against deletion and overwrite`, async () => {
        const name = `tests/${table}-${randomUUID()}.png`;
        const url = `https://example.supabase.co/storage/v1/object/public/site-images/${name.replaceAll('-', '%2D')}?download=1#image`;
        const record = fixture(table, `${table}-protected-image`);
        const referenceField = ({ site_content: 'value', leadership_members: 'photo_url', events: 'image_url', partners: 'logo_url', site_settings: 'value' })[table];
        record[referenceField] = url;
        if (table === 'site_content' || table === 'site_settings') record.kind = 'image';
        await asRole(db, 'admin', async () => {
          await db.query("insert into storage.objects(bucket_id,name) values ('site-images',$1)", [name]);
          await insertRecord(db, table, record);
          assert.equal((await db.query('select private.is_site_image_referenced($1) as referenced', [name])).rows[0].referenced, true);
          assert.deepEqual((await db.query('delete from storage.objects where name=$1 returning id', [name])).rows, []);
          assert.deepEqual((await db.query("update storage.objects set metadata='{}' where name=$1 returning id", [name])).rows, []);
          assert.equal((await db.query('select name from storage.objects where name=$1', [name])).rows[0].name, name);
          await db.query(`delete from public.${table} where ${keyOf(table)}=$1`, [record[keyOf(table)]]);
          assert.equal((await db.query('select private.is_site_image_referenced($1) as referenced', [name])).rows[0].referenced, false);
          assert.equal((await db.query('delete from storage.objects where name=$1 returning id', [name])).rows.length, 1);
        });
      });
    }

    await t.test('reference matcher supports transformed, signed and bucket-prefixed image URLs', async () => {
      for (const reference of [
        'https://example.supabase.co/storage/v1/render/image/public/site-images/tests/photo.png?width=300',
        'https://example.supabase.co/storage/v1/object/sign/site-images/tests/photo.png?token=example',
        'site-images/tests/photo.png',
      ]) {
        assert.equal((await db.query('select private.site_image_object_name($1) as name', [reference])).rows[0].name, 'tests/photo.png');
      }
      assert.equal((await asRole(db, 'ordinary', () => db.query(
        "select private.is_site_image_referenced('unknown.png') as referenced"))).rows[0].referenced, true,
      'unprivileged caller cannot use helper to enumerate draft references');
    });
  } finally {
    await db.close();
  }
});
