# Revisão do Storage — 22/10/2026

Alterações feitas no clone local `brasa-uh/brasa-uh`, correspondente ao arquivo aberto no IDE. Nenhuma migração, seed, SQL de teste, criação de bucket, upload remoto, commit, push ou deploy foi executado nesta revisão. Os testes de navegador interceptaram todas as chamadas Supabase.

## Problemas encontrados e correções

1. **Configuração de bucket pelo SQL:** a migração 00200 continha `INSERT INTO storage.buckets ... ON CONFLICT DO UPDATE`, misturando configuração do serviço e políticas. O bloco inteiro foi removido. A criação passa a ser manual pelo Dashboard, conforme o [modelo de administração do schema Storage](https://supabase.com/docs/guides/storage/schema/design).
2. **Decodificação divergente no painel:** `decodeURIComponent` desistia do caminho inteiro quando havia uma sequência inválida junto de uma válida. Exemplo: `photo%2D%ZZ.png` permanecia assim no JavaScript, enquanto a lógica SQL existente produz `photo-%ZZ.png`. O parser do painel agora preserva `%` inválido, decodifica os escapes válidos uma vez e mantém o caminho original em caso de UTF-8 inválido ou NUL. Os testes reproduziram a falha antes da correção e passaram depois. Isso evita divergência na verificação prévia; as políticas do banco continuam sendo a proteção final.
3. **Mensagem incorreta na exclusão sem resultado:** quando Storage retornava `[]`, a mensagem específica era substituída pelo aviso genérico de imagem em uso, porque continha as palavras “em uso”. O formatador agora prioriza mensagens explícitas da aplicação. A interface mantém o arquivo na lista e informa que a exclusão não foi confirmada, sem afirmar que encontrou uma referência.

## Arquivos alterados

| Arquivo | Alteração |
| --- | --- |
| `supabase/migrations/20261022000200_site_images.sql` | Removido o upsert do bucket; adicionados comentários com os pré-requisitos manuais. As duas funções e as 12 políticas permanecem idênticas à versão anterior. |
| `README-SUPABASE.md` | Ordem schema → Dashboard/bucket → políticas → seed; instruções de criação, MIME/tamanho, escopo dos outros buckets e detecção de referências. |
| `admin/media.js` | Alinhamento do tratamento de escapes percentuais malformados e NUL com a lógica SQL existente. |
| `admin/ui.js` | Preservação da mensagem específica de exclusão não confirmada. |
| `tests/storage-review.test.mjs` | Novos testes sem SQL: ausência de escrita em buckets, escopo das políticas, URLs/codificação, referências em rascunhos, URL pública pelo SDK e mensagem de exclusão. |
| `tests/browser/storage.spec.mjs` | Upload, substituição, renderização/URL pública sem sessão, proteção de rascunho com URL transformada, remoção liberada e retorno vazio do Storage, com APIs simuladas. |
| `tests/browser/mock.mjs` | Estado de arquivos e respostas de remoção simuladas, incluindo retorno vazio. |
| `tests/database.test.mjs` | Fixture do bucket previamente provisionado e casos adicionais de outros buckets/codificação, preparados para execução futura autorizada. Não executado nesta revisão. |
| `supabase/tests/README.md` | Setup manual e distinção entre os resultados históricos e os testes não executados agora. |
| `docs/testes-manuais.md`, `docs/entrega.md`, `docs/verificacao-local.md` | Roteiros sincronizados, limites da verificação e ligação para este relatório. |

## Ordem correta para uma instalação nova

1. Aplicar `20261022000100_cms_schema.sql` somente quando autorizado.
2. Dashboard → Storage → New bucket: ID `site-images`, **Public**, limite **5 MB / 5.242.880 bytes**, MIME **`image/jpeg`, `image/png`, `image/webp`**. Salvar as restrições na criação ou em Edit bucket. JPG/JPEG compartilham `image/jpeg`. Não reduzir o limite global do projeto, que afetaria outros buckets.
3. Aplicar `20261022000200_site_images.sql` (apenas funções/políticas), depois `supabase/seed.sql`.
4. Configurar Auth e autorizar o UID administrativo; então testar os fluxos reais. Um ambiente já configurado exige conferência do que foi aplicado, sem reexecutar migrações existentes ou recriar buckets.

## Revisão das políticas e referências

- As políticas permissivas exigem `bucket_id = 'site-images'`; as oito restritivas deixam passar os demais buckets por `bucket_id <> 'site-images'`. Para outros buckets, não são concedidos novos acessos nem acrescentadas restrições de nome, extensão ou administrador: continuam valendo as políticas próprias. Esta conclusão vem da revisão estática, não de execução em PostgreSQL nesta rodada.
- Admin/editor podem enviar nomes válidos. Substituição no painel usa UUID novo e `upsert:false`; o arquivo anterior permanece até exclusão manual permitida. UPDATE/DELETE de objeto referenciado são barrados pela condição `not private.is_site_image_referenced(name)`.
- A verificação inclui as cinco tabelas de conteúdo e os campos de links, sem filtro de publicação: rascunhos também protegem arquivos. Reconhece URLs originais, assinadas, autenticadas e transformadas; remove query/fragmento antes de decodificar; preserva `+` e evita dupla decodificação de `%25`.
- O parser é conservador quanto ao host: uma URL de outro projeto com o mesmo caminho de bucket/objeto pode bloquear uma exclusão. Mantido sem mudança, pois não concede acesso indevido. O editor de imagens continua aceitando assets locais ou URLs públicas originais do bucket próprio; reconhecer uma transformação para proteger a referência não altera essa regra.
- URLs públicas são servidas pelo mecanismo de bucket público, sem exigir SELECT anônimo em `storage.objects`; a listagem continua restrita. [Documentação oficial de buckets públicos](https://supabase.com/docs/guides/storage/buckets/fundamentals).
- A checagem de referências usa o estado visível à transação; não é bloqueio colaborativo entre edições concorrentes. Essa limitação já estava documentada e permanece.

## Verificação executada

- `node --test tests/storage-review.test.mjs tests/public.test.mjs`: **12/12 passaram**; nenhum SQL executado.
- `node node_modules/@playwright/test/cli.js test tests/browser/storage.spec.mjs`: **2/2 passaram**, Edge headless com Storage/Auth/Data API simulados. A resposta HTTP da URL de imagem também é simulada; não comprova disponibilidade no Supabase real.
- `node tools/check.mjs`: sintaxe de **26 scripts** e **137 referências HTML/CSS** válidas.
- Dependências copiadas no clone tinham links quebrados. `pnpm install --frozen-lockfile --ignore-scripts --force` reparou apenas `node_modules`, usando o lockfile existente e sem executar scripts de instalação.

**Não executados:** `npm test` / `tests/database.test.mjs` e pgTAP, porque executam migrações ou SQL; nenhuma operação no Supabase ou Netlify. Os casos de banco adicionados estão preparados, mas não são apresentados como aprovados. A validação real de upload, limites MIME/tamanho, autorização RLS, outros buckets e URLs/CDN deve seguir o [checklist manual](testes-manuais.md) em uma etapa autorizada.
