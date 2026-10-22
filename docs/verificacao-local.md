# Verificação local — BRASA UH CMS

Registro de verificações efetivamente executadas em 22/10/2026. Não houve migração, escrita, upload, push ou deploy no ambiente remoto. Os números abaixo distinguem execução local real de integrações simuladas. Não representam aprovação do projeto remoto.

## Preservação do site e verificação independente

Foram comparadas as seis páginas atuais com o snapshot anterior à integração em DOM local (LinkeDOM). Os marcadores e wrappers de conteúdo foram removidos apenas na cópia de teste para permitir a comparação estrutural.

| Verificação | Resultado observado |
| --- | --- |
| Texto inicial das seis páginas | Idêntico ao snapshot. |
| Estrutura do `body`, descontados os marcadores do CMS | Idêntica ao snapshot. |
| Destinos, `target` e `rel` dos links | Preservados. |
| `src`, `alt`, largura e altura das imagens | Preservados. |
| Aplicação dos campos/valores iniciais do catálogo e configurações | Textos dos blocos semânticos preservados nas seis páginas. |
| Destinos dos seletores do catálogo | Encontrados em todas as páginas correspondentes. |
| `data.js` | SHA-256 idêntico ao snapshot. |
| Cinco assets comuns ao snapshot | SHA-256 idênticos. |
| Payload HTML em campo textual | Apresentado como texto literal, sem criar elementos executáveis. |
| Limpeza de referência de imagem/link | Após a correção, valores publicados vazios removem `src`/`href`; imagem vazia fica oculta. Teste de regressão local repetido. |

A revisão de código confirmou catálogo local como limite dos seletores/atributos editáveis, URLs de imagens limitadas aos assets/bucket deste projeto e cliente público separado da sessão administrativa. Isso é inspeção local, não auditoria externa nem teste de configuração remota.

## Banco local

A suíte `tests/database.test.mjs` foi executada com PGlite 0.5.11: **44 testes passaram** no resultado informado pelo responsável pela suíte. Ela executa as migrações e o seed reais em PostgreSQL WASM local, usando estruturas mínimas simuladas para `auth.users`, `auth.uid()`, `storage.buckets` e `storage.objects`.

Foram exercitados constraints, RLS, permissões de visitante/usuário comum/admin/editor, isolamento de rascunhos, tentativa de autopromoção, timestamps, referências de imagens, seed reexecutado sem duplicatas ou sobrescrita de edições e a RPC de reordenação atômica. Os testes dessa RPC verificaram acesso permitido/negado, IDs inválidos/duplicados/ausentes, rollback e preservação dos outros campos. Esses resultados validam a lógica SQL no ambiente local simulado; não validam emissão de JWT, Supabase Auth HTTP, serviço Storage HTTP, leitura dos bytes enviados, limites de MIME/tamanho do serviço ou CDN.

O arquivo pgTAP opcional `supabase/tests/cms_rls.sql` foi preparado, mas **não foi executado**. Não confundir a existência desse arquivo com o resultado da suíte PGlite.

## Sintaxe, arquivos e testes JavaScript

A execução `node tools/check.mjs` conferiu **24 scripts e 137 referências locais de HTML/CSS** sem falhas no resultado informado. A instalação `pnpm install --frozen-lockfile --ignore-scripts` também foi concluída com pnpm 11.25.

A execução conjunta `node --test tests/public.test.mjs tests/database.test.mjs` passou **51/51 testes**: 44 de banco PGlite e 7 de JavaScript/DOM. A parte pública inclui preservação de conteúdo, navegação/calendário, renderização segura e tratamento de valores/URLs. O comando equivalente no `package.json` é `npm test`; `npm run check` executa o verificador de arquivos.

## Navegador com APIs simuladas

Os **10 cenários distintos** de `tests/browser/*.spec.mjs` passaram com Playwright e **Microsoft Edge 155.0.4283.62**, em modo headless. Após os últimos ajustes, os 3 testes do painel foram reexecutados e passaram; o teste de calendário também foi reexecutado e passou com `23:00–01:00 (dia seguinte)`. As chamadas Supabase foram interceptadas por mocks locais; não houve rede real para o projeto Supabase. Isso verifica o comportamento da interface com respostas controladas, sem validar o serviço remoto.

A suíte cobre:

- Seis páginas públicas em 1440 e 390 px, menu/Escape, abas e calendário com filtros/Hoje.
- Indisponibilidade da API e preservação dos nove officers do fallback.
- Login, restauração de sessão, saída e negação da conta não administrativa.
- Separação do cliente público, que não envia o token do painel.
- Prévia, alteração/salvamento de um campo e estados de publicação.
- CRUD e reordenação de membros; criação/publicação/despublicação/exclusão de eventos, upload simulado e horário que termina no dia seguinte. A edição de título foi exercitada nos membros, pelo módulo compartilhado de CRUD; não se declara uma edição direta de título de evento nesse cenário de navegador.
- Parceiros, configurações de e-mail, saída durante confirmação e layout administrativo em 1440, 768 e 390 px.

O responsável inspecionou capturas de login, visão geral e editor. Após corrigir o valor nulo na prévia e melhorar os rótulos dos campos, conferiu novamente as imagens: visão geral com nove membros, rótulos legíveis e editor móvel sem valores nulos. As capturas usam os dados simulados do teste, não conteúdo carregado do Supabase real.

`npm run test:browser` executa essa suíte. Playwright é dependência de desenvolvimento; o site publicado não precisa dele nem de um navegador/servidor Node no runtime.

## Pacote estático para publicação

`tools/build-static.mjs` foi executado **duas vezes**, incluindo a limpeza/recriação do próprio `dist/`, sem falhas. O verificador sobre o resultado conferiu **13 scripts e 137 referências locais**. O pacote inclui somente os arquivos públicos previstos; SQL, documentação, testes e dependências de desenvolvimento ficam fora dele.

O `netlify.toml` aponta o build para esse script e a publicação para `dist`. Essa configuração e `_headers` foram verificados localmente; não foi executado deploy para confirmar cabeçalhos/cache no serviço Netlify.

## Pendências que exigem ambiente configurado e autorização

Login real com as contas da organização; criação e revogação de usuários no projeto real; chamadas REST com JWTs reais; aplicação das migrações; validação do bucket e uploads reais; configuração de URLs Auth; publicação e verificação no Netlify. O [checklist manual](testes-manuais.md) contém os passos para essas etapas.

Nenhum resultado local deve ser apresentado como aprovação do Supabase ou do Netlify em produção.





