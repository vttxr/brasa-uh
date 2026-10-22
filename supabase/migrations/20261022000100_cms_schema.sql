  -- BRASA UH: schema inicial. EXECUTAR SOMENTE APÓS APROVAÇÃO.
  -- Não é executado pelo site. Aplicar antes de 20261022000200_site_images.sql.
  -- Executar como postgres (SQL Editor / migrações locais), nunca pelo navegador.
  begin;

  create schema if not exists private;
  revoke all on schema private from public, anon, authenticated;
  grant usage on schema private to authenticated;

  create table public.admin_users (
    user_id uuid primary key references auth.users (id) on delete cascade,
    role text not null default 'editor' check (role in ('admin', 'editor')),
    created_at timestamptz not null default now()
  );

  create table public.site_content (
    id uuid primary key default gen_random_uuid(),
    page text not null check (length(btrim(page)) between 1 and 100),
    section text not null check (length(btrim(section)) between 1 and 150),
    field text not null check (length(btrim(field)) between 1 and 150),
    kind text not null default 'text' check (kind in ('text', 'url', 'image', 'alt')),
    value text not null default '',
    published boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (page, section, field)
  );

  create table public.leadership_members (
    id uuid primary key default gen_random_uuid(),
    full_name text not null check (length(btrim(full_name)) between 1 and 200),
    role text not null check (length(btrim(role)) between 1 and 200),
    biography text not null default '',
    photo_url text not null default '',
    linkedin_url text not null default '',
    display_order integer not null default 0 check (display_order >= 0),
    published boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create table public.events (
    id uuid primary key default gen_random_uuid(),
    title text not null check (length(btrim(title)) between 1 and 300),
    description text not null default '',
    event_date date not null,
    start_time time without time zone,
    end_time time without time zone,
    location text not null default '',
    registration_url text not null default '',
    image_url text not null default '',
    category text not null default 'Comunidade'
      check (category in ('Cultura', 'Social', 'Carreira', 'Comunidade')),
    published boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint events_end_requires_start check (end_time is null or start_time is not null)
  );
  comment on column public.events.event_date is 'Data local de Houston; não converter como meia-noite UTC.';
  comment on column public.events.start_time is 'Horário local America/Chicago. Fim anterior ao início representa término no dia seguinte.';

  create table public.partners (
    id uuid primary key default gen_random_uuid(),
    name text not null check (length(btrim(name)) between 1 and 200),
    logo_url text not null default '',
    description text not null default '',
    website_url text not null default '',
    benefit text not null default '',
    conditions text not null default '',
    display_order integer not null default 0 check (display_order >= 0),
    published boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create table public.site_settings (
    key text primary key check (length(btrim(key)) between 1 and 150),
    value text not null default '',
    kind text not null default 'text' check (kind in ('text', 'url', 'image', 'alt')),
    published boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  -- Esta função lê a tabela como postgres, sem reentrar em sua política de RLS.
  -- A identidade vem do JWT verificado pelo Supabase, nunca de parâmetros do cliente.
  -- Não adicionar o schema private à lista de schemas expostos na Data API.
  create function private.is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
  as $$
    select exists (
      select 1 from public.admin_users
      where user_id = (select auth.uid())
        and role in ('admin', 'editor')
    );
  $$;
  alter function private.is_admin() owner to postgres;
  revoke all on function private.is_admin() from public, anon, authenticated;
  grant execute on function private.is_admin() to authenticated;

  create function private.set_updated_at()
  returns trigger
  language plpgsql
  set search_path = ''
  as $$
  begin
    new.updated_at := pg_catalog.clock_timestamp();
    if tg_op = 'UPDATE' then
      new.created_at := old.created_at;
    end if;
    return new;
  end;
  $$;
  revoke all on function private.set_updated_at() from public, anon, authenticated;

  alter table public.admin_users enable row level security;
  revoke all on public.admin_users from public, anon, authenticated;
  grant select on public.admin_users to authenticated;
  create policy admin_users_read_own on public.admin_users
    for select to authenticated using (user_id = (select auth.uid()));
  -- Intencionalmente nenhuma política INSERT/UPDATE/DELETE. O cadastro de um
  -- administrador exige operação manual privilegiada, mesmo para role=admin.

  do $$
  declare
    target_table text;
  begin
    foreach target_table in array array[
      'site_content', 'leadership_members', 'events', 'partners', 'site_settings'
    ] loop
      execute format('alter table public.%I enable row level security', target_table);
      execute format('revoke all on public.%I from public, anon, authenticated', target_table);
      execute format('grant select on public.%I to anon', target_table);
      execute format('grant select, insert, update, delete on public.%I to authenticated', target_table);
      execute format(
        'create policy public_read_published on public.%I for select to anon, authenticated using (published = true)',
        target_table
      );
      execute format(
        'create policy admin_read_all on public.%I for select to authenticated using ((select private.is_admin()))',
        target_table
      );
      execute format(
        'create policy admin_insert on public.%I for insert to authenticated with check ((select private.is_admin()))',
        target_table
      );
      execute format(
        'create policy admin_update on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',
        target_table
      );
      execute format(
        'create policy admin_delete on public.%I for delete to authenticated using ((select private.is_admin()))',
        target_table
      );
      execute format(
        'create trigger set_updated_at before insert or update on public.%I for each row execute function private.set_updated_at()',
        target_table
      );
      execute format('create index %I on public.%I (updated_at desc)', target_table || '_updated_at_idx', target_table);
    end loop;
  end;
  $$;

  create index site_content_published_page_idx on public.site_content (page, section) where published;
  create index leadership_members_order_idx on public.leadership_members (published, display_order, full_name);
  create index events_date_idx on public.events (published, event_date, start_time);
  create index partners_order_idx on public.partners (published, display_order, name);

  -- Reordena atomicamente, sem reenviar nome, cargo, publicação ou outros campos.
  -- SECURITY INVOKER mantém os grants/RLS das tabelas; não há elevação de acesso.
  create function public.reorder_cms_records(entity text, ordered_ids uuid[])
  returns integer
  language plpgsql
  security invoker
  set search_path = ''
  as $$
  declare
    affected integer;
  begin
    if not private.is_admin() then
      raise exception 'Esta conta não pode reordenar conteúdo.' using errcode = '42501';
    end if;
    if entity is null or entity not in ('leadership_members', 'partners') then
      raise exception 'Tipo de conteúdo inválido para reordenação.' using errcode = '22023';
    end if;
    if ordered_ids is null or coalesce(pg_catalog.array_ndims(ordered_ids), 1) <> 1 then
      raise exception 'Informe uma lista unidimensional de IDs.' using errcode = '22023';
    end if;
    if pg_catalog.array_position(ordered_ids, null) is not null then
      raise exception 'A lista de IDs não pode conter valores nulos.' using errcode = '22023';
    end if;
    if (select count(distinct id) from pg_catalog.unnest(ordered_ids) as ids(id))
        <> pg_catalog.cardinality(ordered_ids) then
      raise exception 'A lista de IDs não pode conter duplicatas.' using errcode = '22023';
    end if;

    execute pg_catalog.format(
      'update public.%I as target set display_order = ordering.ordinality::integer * 10
      from pg_catalog.unnest($1::uuid[]) with ordinality as ordering(id, ordinality)
      where target.id = ordering.id', entity
    ) using ordered_ids;
    get diagnostics affected = row_count;
    if affected <> pg_catalog.cardinality(ordered_ids) then
      raise exception 'Um ou mais registros não existem. Atualize a lista antes de reordenar.'
        using errcode = '22023';
    end if;
    return affected;
  end;
  $$;
  revoke all on function public.reorder_cms_records(text, uuid[]) from public, anon, authenticated;
  grant execute on function public.reorder_cms_records(text, uuid[]) to authenticated;

  comment on table public.admin_users is
    'Autorização manual pelo SQL Editor. admin/editor gerenciam conteúdo; nenhum cliente gerencia permissões.';
  comment on table public.site_settings is
    'Somente configurações do site. Nunca armazenar senhas ou segredos, mesmo em rascunhos.';

  commit;
