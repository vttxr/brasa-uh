# Verificação de banco e Storage

Os arquivos SQL foram preparados localmente. Nenhuma migração ou teste foi executado no projeto Supabase remoto. `cms_rls.sql` é uma suíte pgTAP opcional para uma instância **local e descartável** do Supabase; suas fixtures ficam em uma transação encerrada com `ROLLBACK`. Não execute essa suíte em produção.

## Histórico dos testes locais anteriores à revisão do Storage

`node --test tests/database.test.mjs` passou **44 testes** em PostgreSQL embarcado via PGlite 0.5.11. Esse teste executa as duas migrações reais e o seed real em memória. Verifica publicação/rascunhos, CRUD autorizado de admin/editor, tentativas de escrita não autorizadas, ausência de autopromoção, timestamps, proteção de imagens referenciadas e execução repetida do seed sem sobrescrever edições. Também cobre a RPC `reorder_cms_records`: ordenação de integrantes/parceiros sem alterar nomes ou publicação, rejeição de IDs nulos/duplicados, rejeição de acesso não autorizado e rollback se um registro tiver sido excluído.

Os schemas `auth` e `storage` são modelos mínimos de teste; a execução de SQL, `SET ROLE` e RLS é real. O teste não verifica JWTs, APIs HTTP de autenticação, PostgREST, arquivos binários, bloqueio de MIME/tamanho pelo serviço Storage, CDN ou concorrência entre transações. Inserções em `storage.objects` ocorrem **somente nessa emulação local em memória**; não repita esse procedimento em uma instância Supabase real. A suíte pgTAP abaixo continua opcional e não foi executada.

Na revisão posterior, a migração 00200 deixou de criar/alterar o bucket. A fixture PGlite agora representa um bucket previamente criado pelo Dashboard, e foram preparados casos adicionais de isolamento dos outros buckets e codificação de URLs. **A suíte de banco atualizada não foi executada nesta revisão**, pois a instrução foi não executar migrações, inclusive localmente. O resultado histórico de 44 testes não valida os novos casos. Foram executados somente os testes sem SQL descritos em [revisao-storage.md](../../docs/revisao-storage.md).

## Execução local opcional

1. Instale/configure o Supabase CLI e um runtime de contêineres conforme a documentação oficial.
2. Inicie uma instância **local**, sem vincular/push para o projeto remoto. Aplique `20261022000100_cms_schema.sql`, crie `site-images` pelo Dashboard/Studio local (público, 5 MB, JPEG/PNG/WebP) e só então aplique `20261022000200_site_images.sql`. Esse roteiro é opcional e não foi executado nesta revisão.
3. Execute `supabase test db supabase/tests/cms_rls.sql` e examine o resultado TAP. Não considere a suíte aprovada apenas por ter sido criada.

A suíte verifica RLS/grants, leituras públicas, isolamento de rascunhos, tentativa de autopromoção, permissões próprias, CRUD autorizado, timestamps e identificação de referências de imagens nas cinco tabelas de conteúdo. A suíte não faz upload real nem simula o backend de arquivos do Storage.

## Checklist de integração após autorização

Use contas separadas: visitante anônimo, usuário autenticado **ausente** de `admin_users`, e administrador explicitamente cadastrado. Teste também um editor. Use registros e arquivos claramente identificados como teste, sem modificar dados reais.

- [ ] As seis tabelas de conteúdo/autorização possuem RLS; somente `public` (e os schemas padrão necessários) está exposto pela API. **Não expor `private`.**
- [ ] O visitante lê somente registros `published=true` das cinco tabelas de conteúdo e não consegue inserir, atualizar ou excluir por REST direto.
- [ ] O usuário autenticado comum também não lê rascunhos nem altera conteúdo. Nenhum usuário pode criar/alterar/excluir linhas em `admin_users` pela API; admins só leem a própria linha.
- [ ] Admin/editor leem rascunhos e conseguem criar, editar, reordenar, publicar, despublicar e excluir conteúdo. Confirme o registro retornado após cada escrita; resposta sem erro com zero linhas não comprova sucesso.
- [ ] Uma tentativa negada de UPDATE/DELETE não alterou o registro alvo. Leia novamente com uma conta autorizada para conferir.
- [ ] `updated_at` muda no servidor e `created_at` permanece estável após uma edição.
- [ ] O site público continua usando o cliente anônimo, mesmo com outra aba administrativa autenticada; um rascunho não aparece no site público.
- [ ] Imagem JPEG/PNG/WebP de até **5 MiB (5.242.880 bytes)** sobe pelo Storage API com nome novo/UUID. Verifique a imagem por sua URL pública.
- [ ] Arquivo maior, SVG, GIF, PDF e tipo MIME incompatível são rejeitados pelo Storage, inclusive via requisição direta sem passar pelo formulário. Não confie apenas na validação do navegador.
- [ ] Anônimo e usuário comum não conseguem listar, enviar, sobrescrever, mover ou excluir arquivos em `site-images`.
- [ ] Admin consegue listar imagens. A URL pública continua acessível sem autenticação; bucket público significa que **uploads ainda não publicados também são acessíveis a quem souber a URL**. Não envie imagens privadas/confidenciais.
- [ ] Publique a mesma imagem em dois registros. A tentativa de removê-la ou sobrescrevê-la pelo Storage API não deve removê-la. Confirme existência no Storage, pois a API pode responder sem erro ao excluir zero linhas.
- [ ] Repita a proteção com **somente um rascunho** referenciando a imagem em cada tabela: `site_content.value`, `site_settings.value`, `leadership_members.photo_url`, `events.image_url`, `partners.logo_url`.
- [ ] Repita usando URL com caminho percent-encoded (`%2D` para `-`) e parâmetros de consulta; a referência deve continuar protegida.
- [ ] Faça substituição enviando um **novo arquivo** e salvando a nova URL. A imagem antiga só poderá ser removida depois que não existir referência a ela em nenhum registro, inclusive rascunhos.
- [ ] Admin consegue remover uma imagem sem referências. Faça todas as operações de objetos pelo Storage API; nunca altere/exclua `storage.objects` diretamente por SQL.
- [ ] Se mais de um admin editar/remover ao mesmo tempo, revise referências após conflitos: a checagem RLS avalia as referências visíveis na transação e não é um sistema de bloqueio de edição compartilhada.

## Fontes oficiais consultadas

- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Funções e SECURITY DEFINER](https://supabase.com/docs/guides/database/functions)
- [Storage e controle de acesso](https://supabase.com/docs/guides/storage/security/access-control)
- [Buckets públicos e privados](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Limites de arquivos](https://supabase.com/docs/guides/storage/uploads/file-limits)
- [Schema do Storage](https://supabase.com/docs/guides/storage/schema/design)
