-- Testes pgTAP OPCIONAIS, exclusivamente em uma instância Supabase LOCAL.
-- Não foram executados na implementação. Não executar no projeto de produção.
-- Requer as migrações 00100/00200 aplicadas localmente; não requer o seed.
-- Exemplo após configurar o CLI LOCAL: supabase test db supabase/tests/cms_rls.sql
-- Fixtures e extensão ficam em transação encerrada por ROLLBACK.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(c.relrowsecurity, c.relname || ': RLS habilitado')
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in (
  'admin_users', 'site_content', 'leadership_members', 'events', 'partners', 'site_settings'
);

select ok(
  not has_table_privilege('anon', 'public.' || table_name, 'INSERT')
  and not has_table_privilege('anon', 'public.' || table_name, 'UPDATE')
  and not has_table_privilege('anon', 'public.' || table_name, 'DELETE'),
  table_name || ': anon não tem grants de escrita'
) from unnest(array['admin_users', 'site_content', 'leadership_members', 'events', 'partners', 'site_settings']) t(table_name);

select ok(
  not has_table_privilege('authenticated', 'public.admin_users', 'INSERT')
  and not has_table_privilege('authenticated', 'public.admin_users', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.admin_users', 'DELETE'),
  'authenticated não pode gerenciar permissões, mesmo sendo administrador'
);
select ok(
  (select prosecdef and pg_get_userbyid(proowner) = 'postgres'
    and array_to_string(proconfig, ',') like '%search_path=""%'
   from pg_proc where oid = 'private.is_admin()'::regprocedure),
  'is_admin é SECURITY DEFINER, pertence a postgres e fixa search_path vazio'
);
select ok(
  (select public and file_size_limit = 5242880
    and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
   from storage.buckets where id = 'site-images'),
  'bucket público com limite de 5 MiB e tipos permitidos'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'storage'
    and tablename = 'objects' and policyname like 'site_images_%_guard'
    and permissive = 'RESTRICTIVE'),
  8, 'restrições de Storage cobrem anon/authenticated e as quatro operações'
);

select is(private.site_image_object_name(
  'https://example.supabase.co/storage/v1/object/public/site-images/tests/portrait%2D1.png?download=1#image'
), 'tests/portrait-1.png', 'URLs públicas e percent encoding são normalizados');
select is(private.site_image_object_name(
  'https://example.supabase.co/storage/v1/render/image/public/site-images/tests/portrait.png?width=300'
), 'tests/portrait.png', 'URLs transformadas também protegem o objeto original');
select is(private.site_image_object_name(
  'https://example.supabase.co/storage/v1/object/sign/site-images/tests/portrait.png?token=fixture'
), 'tests/portrait.png', 'URLs assinadas são reconhecidas');
select is(private.site_image_object_name('site-images/tests/portrait.png'),
  'tests/portrait.png', 'caminho com prefixo do bucket é reconhecido');
select is(private.site_image_object_name('javascript:alert(1)'), null::text,
  'URLs de outros protocolos não são caminhos de objetos');

insert into auth.users (id, email) values
  ('fe220001-0000-4000-8000-000000000001', 'admin-cms-test@example.invalid'),
  ('fe220001-0000-4000-8000-000000000002', 'ordinary-cms-test@example.invalid'),
  ('fe220001-0000-4000-8000-000000000003', 'editor-cms-test@example.invalid');
insert into public.admin_users (user_id, role) values
  ('fe220001-0000-4000-8000-000000000001', 'admin'),
  ('fe220001-0000-4000-8000-000000000003', 'editor');

insert into public.site_content (id, page, section, field, kind, value, published) values
  ('fe221001-0000-4000-8000-000000000001', '__brasa_rls_test__', 'fixture', 'public', 'text', 'Público', true),
  ('fe221001-0000-4000-8000-000000000002', '__brasa_rls_test__', 'fixture', 'draft', 'image', 'https://example.supabase.co/storage/v1/object/public/site-images/tests/content%2Ddraft.png', false);
insert into public.leadership_members (id, full_name, role, photo_url, published) values
  ('fe221001-0000-4000-8000-000000000001', 'Fixture público', 'Teste local', '', true),
  ('fe221001-0000-4000-8000-000000000002', 'Fixture rascunho', 'Teste local', 'https://example.supabase.co/storage/v1/object/public/site-images/tests/member-draft.png', false);
insert into public.events (id, title, event_date, image_url, published) values
  ('fe221001-0000-4000-8000-000000000001', 'Fixture público', '2030-01-01', '', true),
  ('fe221001-0000-4000-8000-000000000002', 'Fixture rascunho', '2030-01-02', 'https://example.supabase.co/storage/v1/object/public/site-images/tests/event-draft.png', false);
insert into public.partners (id, name, logo_url, published) values
  ('fe221001-0000-4000-8000-000000000001', 'Fixture público', '', true),
  ('fe221001-0000-4000-8000-000000000002', 'Fixture rascunho', 'https://example.supabase.co/storage/v1/object/public/site-images/tests/partner-draft.png', false);
insert into public.site_settings (key, value, kind, published) values
  ('__brasa_rls_test_public', 'Público', 'text', true),
  ('__brasa_rls_test_draft', 'https://example.supabase.co/storage/v1/object/public/site-images/tests/setting-draft.png', 'image', false);

set local role anon;
set local request.jwt.claim.sub = '';
select results_eq(
  format('select count(*)::integer from public.%I where id in (''fe221001-0000-4000-8000-000000000001'', ''fe221001-0000-4000-8000-000000000002'')', table_name),
  array[1], table_name || ': anon vê somente publicado'
) from unnest(array['site_content', 'leadership_members', 'events', 'partners']) t(table_name);
select results_eq(
  $$select count(*)::integer from public.site_settings where key in ('__brasa_rls_test_public', '__brasa_rls_test_draft')$$,
  array[1], 'site_settings: anon vê somente publicado'
);
select throws_ok($$select * from public.admin_users$$, '42501', null,
  'anon não lê dados administrativos');
select throws_ok($$insert into public.partners (name) values ('Negado')$$, '42501', null,
  'anon não insere conteúdo');
select throws_ok($$update public.partners set name = 'Negado'$$, '42501', null,
  'anon não atualiza conteúdo');
select throws_ok($$delete from public.partners$$, '42501', null,
  'anon não remove conteúdo');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'fe220001-0000-4000-8000-000000000002';
select is(private.is_admin(), false, 'usuário comum não é administrador');
select is_empty($$select * from public.admin_users$$, 'usuário comum não lê permissões alheias');
select results_eq(
  format('select count(*)::integer from public.%I where id in (''fe221001-0000-4000-8000-000000000001'', ''fe221001-0000-4000-8000-000000000002'')', table_name),
  array[1], table_name || ': usuário comum não lê rascunhos'
) from unnest(array['site_content', 'leadership_members', 'events', 'partners']) t(table_name);
select results_eq(
  $$select count(*)::integer from public.site_settings where key in ('__brasa_rls_test_public', '__brasa_rls_test_draft')$$,
  array[1], 'site_settings: usuário comum não lê rascunhos'
);
select throws_ok(query, '42501', null, label) from (values
  ($$insert into public.site_content (page, section, field) values ('__brasa_rls_test__', 'fixture', 'denied')$$, 'site_content: usuário comum não insere'),
  ($$insert into public.leadership_members (full_name, role) values ('Negado', 'Negado')$$, 'leadership_members: usuário comum não insere'),
  ($$insert into public.events (title, event_date) values ('Negado', '2030-01-01')$$, 'events: usuário comum não insere'),
  ($$insert into public.partners (name) values ('Negado')$$, 'partners: usuário comum não insere'),
  ($$insert into public.site_settings (key) values ('__brasa_rls_test_denied')$$, 'site_settings: usuário comum não insere'),
  ($$insert into public.admin_users (user_id, role) values ('fe220001-0000-4000-8000-000000000002', 'admin')$$, 'usuário comum não se promove a admin')
) cases(query, label);
select is_empty(
  format('update public.%I set published = false where id = ''fe221001-0000-4000-8000-000000000001'' returning id', table_name),
  table_name || ': usuário comum não atualiza publicado'
) from unnest(array['site_content', 'leadership_members', 'events', 'partners']) t(table_name);
select is_empty(
  format('delete from public.%I where id = ''fe221001-0000-4000-8000-000000000001'' returning id', table_name),
  table_name || ': usuário comum não remove publicado'
) from unnest(array['site_content', 'leadership_members', 'events', 'partners']) t(table_name);
select is_empty($$update public.site_settings set value = 'Negado' where key = '__brasa_rls_test_public' returning key$$,
  'site_settings: usuário comum não atualiza');
select is_empty($$delete from public.site_settings where key = '__brasa_rls_test_public' returning key$$,
  'site_settings: usuário comum não remove');
select is(private.is_site_image_referenced('tests/not-present.png'), true,
  'helper de referências nega operação sem revelar presença de rascunhos ao usuário comum');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'fe220001-0000-4000-8000-000000000001';
select is(private.is_admin(), true, 'admin explicitamente autorizado');
select results_eq($$select user_id from public.admin_users$$,
  array['fe220001-0000-4000-8000-000000000001'::uuid], 'admin lê somente a própria autorização');
select results_eq(
  format('select count(*)::integer from public.%I where id in (''fe221001-0000-4000-8000-000000000001'', ''fe221001-0000-4000-8000-000000000002'')', table_name),
  array[2], table_name || ': admin lê rascunhos e os registros sobreviveram às remoções negadas'
) from unnest(array['site_content', 'leadership_members', 'events', 'partners']) t(table_name);
select results_eq(
  format('select published from public.%I where id = ''fe221001-0000-4000-8000-000000000001''', table_name),
  array[true], table_name || ': atualização negada não alterou publicado'
) from unnest(array['site_content', 'leadership_members', 'events', 'partners']) t(table_name);
select results_eq($$select value from public.site_settings where key = '__brasa_rls_test_public'$$,
  array['Público'], 'configuração permaneceu intacta após operações negadas');
select results_eq($$select count(*)::integer from public.site_settings where key in ('__brasa_rls_test_public', '__brasa_rls_test_draft')$$,
  array[2], 'admin lê configurações em rascunho');
select throws_ok($$update public.admin_users set role = 'admin'$$, '42501', null,
  'admin não altera permissões pelo cliente');
select throws_ok($$delete from public.admin_users$$, '42501', null,
  'admin não remove permissões pelo cliente');
select throws_ok($$insert into public.admin_users (user_id) values ('fe220001-0000-4000-8000-000000000002')$$, '42501', null,
  'admin não concede acesso pelo cliente');

select is(private.is_site_image_referenced(object_name), true,
  object_name || ': rascunho protege a imagem') from unnest(array[
    'tests/content-draft.png', 'tests/member-draft.png', 'tests/event-draft.png',
    'tests/partner-draft.png', 'tests/setting-draft.png'
  ]) t(object_name);
select is(private.is_site_image_referenced('tests/not-present.png'), false,
  'imagem sem referências pode ser removida pelo admin');

select results_eq(query, array['fe221001-0000-4000-8000-000000000003'::uuid], label)
from (values
  ($$insert into public.site_content (id, page, section, field, created_at) values ('fe221001-0000-4000-8000-000000000003', '__brasa_rls_test__', 'fixture', 'new', '2001-01-01T00:00:00Z') returning id$$, 'admin cria site_content'),
  ($$insert into public.leadership_members (id, full_name, role) values ('fe221001-0000-4000-8000-000000000003', 'Fixture novo', 'Teste') returning id$$, 'admin cria leadership_members'),
  ($$insert into public.events (id, title, event_date) values ('fe221001-0000-4000-8000-000000000003', 'Fixture novo', '2030-01-03') returning id$$, 'admin cria events'),
  ($$insert into public.partners (id, name) values ('fe221001-0000-4000-8000-000000000003', 'Fixture novo') returning id$$, 'admin cria partners')
) cases(query, label);
select results_eq($$insert into public.site_settings (key, value) values ('__brasa_rls_test_new', 'Novo') returning key$$,
  array['__brasa_rls_test_new'], 'admin cria configuração');
select results_eq(
  format('update public.%I set published = true where id = ''fe221001-0000-4000-8000-000000000003'' returning published', table_name),
  array[true], table_name || ': admin publica conteúdo'
) from unnest(array['site_content', 'leadership_members', 'events', 'partners']) t(table_name);
select results_eq($$update public.site_content set created_at = '1900-01-01', updated_at = '1900-01-01'
  where id = 'fe221001-0000-4000-8000-000000000003'
  returning created_at = '2001-01-01T00:00:00Z'::timestamptz and updated_at > '2020-01-01'::timestamptz$$,
  array[true], 'trigger preserva created_at e define updated_at no servidor');
select results_eq($$update public.site_settings set value = 'Alterado' where key = '__brasa_rls_test_new' returning value$$,
  array['Alterado'], 'admin atualiza configuração');
select results_eq(
  format('delete from public.%I where id = ''fe221001-0000-4000-8000-000000000003'' returning id', table_name),
  array['fe221001-0000-4000-8000-000000000003'::uuid], table_name || ': admin remove conteúdo'
) from unnest(array['site_content', 'leadership_members', 'events', 'partners']) t(table_name);
select results_eq($$delete from public.site_settings where key = '__brasa_rls_test_new' returning key$$,
  array['__brasa_rls_test_new'], 'admin remove configuração');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'fe220001-0000-4000-8000-000000000003';
select is(private.is_admin(), true, 'editor explicitamente autorizado a gerenciar conteúdo');
select results_eq($$insert into public.partners (id, name) values ('fe221001-0000-4000-8000-000000000003', 'Fixture editor') returning id$$,
  array['fe221001-0000-4000-8000-000000000003'::uuid], 'editor pode criar');
select results_eq($$update public.partners set published = true where id = 'fe221001-0000-4000-8000-000000000003' returning published$$,
  array[true], 'editor pode publicar');
select results_eq($$delete from public.partners where id = 'fe221001-0000-4000-8000-000000000003' returning id$$,
  array['fe221001-0000-4000-8000-000000000003'::uuid], 'editor pode remover');

reset role;
select * from finish();
rollback;
