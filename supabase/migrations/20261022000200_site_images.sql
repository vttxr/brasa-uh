-- BRASA UH: Storage. EXECUTAR SOMENTE APÓS APROVAÇÃO e após a migração 00100.
-- Políticas não substituem o Storage API: não inserir/remover objetos via SQL.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-images', 'site-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Extrai e decodifica o caminho de URLs públicas, assinadas ou de transformação.
-- Também reconhece caminhos diretos. '+' permanece '+', como em caminhos de URL.
create function private.site_image_object_name(reference text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  object_name text := pg_catalog.btrim(coalesce(reference, ''));
  matched text[];
  decoded bytea := ''::bytea;
  cursor_pos integer := 1;
  current_char text;
begin
  if object_name = '' then return null; end if;
  object_name := pg_catalog.split_part(pg_catalog.split_part(object_name, '?', 1), '#', 1);
  matched := pg_catalog.regexp_match(
    object_name,
    '^(?:https?://[^/]+)?/storage/v1/(?:object|render/image)/(?:public|sign|authenticated)/site-images/(.+)$',
    'i'
  );
  if matched is not null then
    object_name := matched[1];
  elsif object_name like 'site-images/%' then
    object_name := pg_catalog.substr(object_name, 13);
  elsif object_name ~ '^[a-zA-Z][a-zA-Z0-9+.-]*:' or object_name like '/%' then
    return null;
  end if;

  while cursor_pos <= pg_catalog.length(object_name) loop
    current_char := pg_catalog.substr(object_name, cursor_pos, 1);
    if current_char = '%' and pg_catalog.substr(object_name, cursor_pos + 1, 2) ~ '^[0-9a-fA-F]{2}$' then
      decoded := decoded || pg_catalog.decode(pg_catalog.substr(object_name, cursor_pos + 1, 2), 'hex');
      cursor_pos := cursor_pos + 3;
    else
      decoded := decoded || pg_catalog.convert_to(current_char, 'UTF8');
      cursor_pos := cursor_pos + 1;
    end if;
  end loop;
  return pg_catalog.convert_from(decoded, 'UTF8');
exception when character_not_in_repertoire or untranslatable_character then
  return object_name;
end;
$$;
revoke all on function private.site_image_object_name(text) from public, anon, authenticated;

-- SECURITY DEFINER enxerga todas as referências, inclusive rascunhos, sem
-- recursão das políticas de conteúdo. Retorna somente um booleano para admins.
create function private.is_site_image_referenced(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then return true; end if;
  return exists (
    select 1 from (
      select value as reference from public.site_content
      union all select value from public.site_settings
      union all select photo_url from public.leadership_members
      union all select linkedin_url from public.leadership_members
      union all select image_url from public.events
      union all select registration_url from public.events
      union all select logo_url from public.partners
      union all select website_url from public.partners
    ) references_to_images
    where private.site_image_object_name(reference) = object_name
  );
end;
$$;
alter function private.is_site_image_referenced(text) owner to postgres;
revoke all on function private.is_site_image_referenced(text) from public, anon, authenticated;
grant execute on function private.is_site_image_referenced(text) to authenticated;

-- Bucket público permite obter arquivos por URL. A listagem e os metadados
-- ficam restritos aos administradores. Não há política pública de SELECT.
create policy site_images_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'site-images' and (select private.is_admin()));

create policy site_images_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'site-images' and (select private.is_admin())
    and char_length(name) <= 512
    and name ~* '^([a-z0-9][a-z0-9._-]*/)*[a-z0-9][a-z0-9._-]*\.(jpe?g|png|webp)$'
  );

-- Atualização também não pode sobrescrever ou mover uma imagem referenciada.
-- Substituições no CMS devem fazer upload com novo nome e salvar a nova URL.
create policy site_images_admin_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'site-images' and (select private.is_admin())
    and not private.is_site_image_referenced(name)
  )
  with check (
    bucket_id = 'site-images' and (select private.is_admin())
    and char_length(name) <= 512
    and name ~* '^([a-z0-9][a-z0-9._-]*/)*[a-z0-9][a-z0-9._-]*\.(jpe?g|png|webp)$'
  );

create policy site_images_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'site-images' and (select private.is_admin())
    and not private.is_site_image_referenced(name)
  );

-- Políticas RESTRICTIVE protegem este bucket mesmo se existir uma política
-- permissiva antiga de outro recurso. Outros buckets não são alterados.
create policy site_images_anon_select_guard on storage.objects
  as restrictive for select to anon using (bucket_id <> 'site-images');
create policy site_images_anon_insert_guard on storage.objects
  as restrictive for insert to anon with check (bucket_id <> 'site-images');
create policy site_images_anon_update_guard on storage.objects
  as restrictive for update to anon
  using (bucket_id <> 'site-images') with check (bucket_id <> 'site-images');
create policy site_images_anon_delete_guard on storage.objects
  as restrictive for delete to anon using (bucket_id <> 'site-images');

create policy site_images_authenticated_select_guard on storage.objects
  as restrictive for select to authenticated
  using (bucket_id <> 'site-images' or (select private.is_admin()));
create policy site_images_authenticated_insert_guard on storage.objects
  as restrictive for insert to authenticated
  with check (
    bucket_id <> 'site-images' or (
      (select private.is_admin()) and char_length(name) <= 512
      and name ~* '^([a-z0-9][a-z0-9._-]*/)*[a-z0-9][a-z0-9._-]*\.(jpe?g|png|webp)$'
    )
  );
create policy site_images_authenticated_update_guard on storage.objects
  as restrictive for update to authenticated
  using (
    bucket_id <> 'site-images' or (
      (select private.is_admin()) and not private.is_site_image_referenced(name)
    )
  )
  with check (
    bucket_id <> 'site-images' or (
      (select private.is_admin()) and char_length(name) <= 512
      and name ~* '^([a-z0-9][a-z0-9._-]*/)*[a-z0-9][a-z0-9._-]*\.(jpe?g|png|webp)$'
    )
  );
create policy site_images_authenticated_delete_guard on storage.objects
  as restrictive for delete to authenticated
  using (
    bucket_id <> 'site-images' or (
      (select private.is_admin()) and not private.is_site_image_referenced(name)
    )
  );

commit;
