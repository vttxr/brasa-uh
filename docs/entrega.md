# Entrega local — CMS BRASA UH

A implementação acrescenta um CMS ao site existente, mantendo HTML, CSS e JavaScript puro. O painel `/admin/` oferece login em português, visão geral, edição de páginas com prévia, gerenciamento de diretoria/eventos/parcerias, imagens e configurações. O site público carrega os registros publicados e mantém a versão estática original como fallback quando a API está indisponível.

**Nenhuma ação remota foi executada:** não houve SQL no Supabase real, criação de usuário real, upload real, push para GitHub, deploy no Netlify ou troca de domínio. Esta pasta é uma cópia de trabalho sem `.git`; os arquivos devem ser revisados e aplicados ao clone correto antes de uma publicação explicitamente aprovada.

## Arquivos criados

| Grupo | Arquivos | Finalidade |
| --- | --- | --- |
| Painel | `admin/index.html`, `admin/admin.css`, `admin/admin.js` | Entrada estática, aparência responsiva, autenticação e navegação do painel. |
| Módulos do painel | `admin/ui.js`, `admin/content.js`, `admin/records.js`, `admin/media.js` | Componentes, editores/prévia, CRUD/reordenação e biblioteca de imagens. |
| Integração pública | `cms/config.js`, `cms/client.js`, `cms/public.js`, `cms/render.js`, `cms/safety.js` | Configuração publicável, clientes separados, leitura, renderização e validação de valores/URLs. |
| Catálogos iniciais | `cms/content-catalog.json`, `cms/settings-catalog.json` | Mapeamento dos 203 campos editoriais e das 10 configurações encontradas no site. |
| Cliente distribuído | `cms/vendor/supabase.js`, `cms/vendor/SUPABASE-LICENSE` | Supabase JavaScript v2.118.0 local, com licença; não exige CDN em tempo de execução. |
| Migrações | `supabase/migrations/20261022000100_cms_schema.sql`, `supabase/migrations/20261022000200_site_images.sql` | Banco/RLS/RPC e Storage, preparados para aplicação manual. |
| Conteúdo inicial | `supabase/seed.sql` | Textos, links, imagens e nove officers reais; sem eventos/parceiros fictícios. |
| Testes de banco opcionais | `supabase/tests/cms_rls.sql`, `supabase/tests/README.md` | Suíte pgTAP opcional e checklist específico de banco/Storage. |
| Testes automatizados locais | `tests/public.test.mjs`, `tests/database.test.mjs` | Validação JS/DOM e SQL/RLS em PGlite local. |
| Testes de navegador | `tests/browser/site.spec.mjs`, `tests/browser/admin.spec.mjs`, `tests/browser/mock.mjs`, `playwright.config.mjs` | Interações públicas/admin em navegador, com respostas Supabase simuladas. |
| Ferramentas | `tools/serve.mjs`, `tools/check.mjs`, `tools/build-static.mjs`, `tools/build-vendor.mjs`, `tools/bootstrap-content.mjs` | Servidor local, conferências, cópia dos arquivos publicáveis, empacotamento do SDK e extração inicial já realizada. |
| Configuração de desenvolvimento | `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.gitignore` | Scripts, dependências fixadas e exclusão de arquivos locais/segredos. |
| Hosting | `netlify.toml`, `_headers` | Build estático para `dist/` e regras locais de cache/cabeçalhos para futura publicação no Netlify. |
| Documentação | `README-SUPABASE.md`, `docs/auditoria-inicial.md`, `docs/testes-manuais.md`, `docs/verificacao-local.md`, `docs/entrega.md` | Instalação, auditoria, procedimentos de teste, resultados e este inventário. |

Capturas e rastros produzidos por testes ficam em `test-results/` e são ignorados pelo Git. O resultado de `npm run build` fica em `dist/`, também ignorado; é a pasta preparada para publicação. Documentação, SQL, testes e dependências de desenvolvimento não são copiados para `dist/`.

## Arquivos modificados e preservados

| Arquivo | Mudança |
| --- | --- |
| `index.html` | Marcadores de campos/configurações e carregamento do script como módulo. |
| `quem-somos.html` | Marcadores de campos/configurações e carregamento do script como módulo. |
| `diretoria.html` | Marcadores de conteúdo e integração; os nove cartões estáticos originais continuam como fallback. |
| `calendario.html` | Marcadores de conteúdo e integração; controles e estrutura do calendário preservados. |
| `parcerias.html` | Marcadores de conteúdo e integração; abas locais/globais preservadas. |
| `faca-parte.html` | Marcadores de campos/configurações e carregamento do script como módulo. |
| `script.js` | Mantém menu, abas e calendário e passa a integrar leitura e renderização segura do CMS. |
| `style.css` | Correção pontual da regra preexistente `a: focus-visible` para `a:focus-visible`; identidade visual preservada. |

`data.js` e as imagens existentes em `assets/` foram preservados. `LEIA-ME.md` permanece como documento histórico da versão estática; o guia atual é `README-SUPABASE.md`. Não foram inventados contatos, parceiros, eventos, fotos ou perfis dos officers que ainda não foram fornecidos.

## Banco, autorização e imagens

As migrações definem `site_content`, `leadership_members`, `events`, `partners`, `site_settings` e `admin_users`, com RLS. Visitantes leem conteúdo publicado; usuários Auth comuns não editam; somente UUIDs explicitamente cadastrados em `admin_users` podem gerenciar conteúdo. Admin e editor possuem o mesmo CRUD nesta versão. Nenhum cliente do painel pode se conceder permissões.

A primeira migração inclui `reorder_cms_records`: atualiza somente a ordem de membros/parceiros atomicamente, sem sobrescrever outros campos editados em outra aba. Isso não substitui um sistema geral de histórico ou bloqueio de edição simultânea.

O bucket `site-images` é público, aceita JPEG/PNG/WebP até 5 MB e restringe mutações aos usuários autorizados. Uploads usam novos nomes; não há exclusão automática de arquivos ao trocar imagens ou excluir registros. A exclusão/sobrescrita de uma imagem referenciada, inclusive por rascunho, é restringida pela interface e pelas políticas do Storage.

## Sequência para ativar depois da aprovação

1. Abra o projeto correto no Supabase Dashboard e revise os arquivos SQL.
2. No SQL Editor, aplique `20261022000100_cms_schema.sql`, depois `20261022000200_site_images.sql` e por último `supabase/seed.sql`.
3. Desative cadastro público no Auth, configure as URLs e crie manualmente a primeira conta de e-mail/senha.
4. Copie o UID do usuário em Authentication → Users e autorize aquele UUID em `admin_users` pelo SQL Editor privilegiado, conforme o exemplo no [guia](../README-SUPABASE.md).
5. Confira o bucket, limite, formatos e políticas. Abra o painel local com `npm run serve` em `http://localhost:4173/admin/`.
6. Teste edição de texto, publicação, imagem e permissões usando o [checklist manual](testes-manuais.md). Mudanças publicadas devem aparecer ao recarregar o site, sem deploy de conteúdo.
7. Aplique os arquivos ao clone correto, rode `npm run build` e confira `dist/`. O `netlify.toml` define `node tools/build-static.mjs` como build e `dist` como pasta publicada. Depois de revisão e autorização para publicar, faça commit/push pelo fluxo GitHub/Netlify existente. O destino do painel será `https://brasauh-test.netlify.app/admin/`.

O seed usa `ON CONFLICT DO NOTHING`: não sobrescreve edições existentes, mas deve ser uma etapa de inicialização, não de deploy. Reexecutá-lo pode recriar conteúdo inicial que foi excluído de propósito.

## Validação e limites

Passaram 51 testes de JavaScript/DOM/SQL local e 10 cenários distintos de navegador com API simulada. A revisão visual foi concluída, e o build estático foi executado duas vezes. O [relatório local](verificacao-local.md) registra os comandos, reexecuções, inspeções e a separação entre banco local, navegador simulado e integração remota. Auth real, JWT/PostgREST, serviço Storage, bucket remoto, cache do Netlify e deploy ainda exigem configuração e testes autorizados.

Imagens no bucket público são acessíveis por URL mesmo associadas a rascunhos; esse armazenamento não serve para material confidencial. O fallback estático é a cópia inicial historicamente pública, não um backup atualizado do CMS. Remover dados definitivamente dessa cópia requer alterar os arquivos e publicar uma versão revisada.


