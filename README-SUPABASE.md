# BRASA UH — guia do CMS e Supabase

O site continua em HTML, CSS e JavaScript puro. O painel em `/admin/` permite atualizar os conteúdos sem editar arquivos a cada alteração. O Supabase guarda os dados e as imagens; o Netlify continua servindo os arquivos estáticos.

**Esta entrega é uma implementação local.** Criar scripts não cria tabelas no projeto remoto. As migrações, a configuração do Auth, a criação do primeiro administrador, os testes no Supabase real e a publicação dependem de execução manual autorizada. Nenhuma dessas ações deve fazer parte de um deploy automático.

Leia também o [resumo da entrega e inventário de arquivos](docs/entrega.md), [a auditoria do código original](docs/auditoria-inicial.md) e [o roteiro de testes manuais](docs/testes-manuais.md). O `LEIA-ME.md` anterior descreve a versão estática histórica; para o CMS, siga este guia.

## O que cada serviço faz

| Serviço | Papel neste site |
| --- | --- |
| PostgreSQL | Armazena os textos, officers, eventos, parcerias e configurações públicas. |
| Supabase Auth | Confirma o e-mail/senha e mantém a sessão de quem entra no painel. |
| `admin_users` e RLS | Decidem no banco quem pode editar. Ter uma conta Auth, por si só, não dá acesso administrativo. |
| Supabase Storage | Guarda as imagens enviadas pelo painel, no bucket `site-images`. |
| Netlify | Entrega os HTML, CSS, JavaScript e imagens locais. Não precisa executar um servidor Node em produção. |

A chave publicável identifica a aplicação. A identidade e a permissão de quem edita vêm da sessão Auth e das regras de banco. A chave publicável pode constar no frontend; senha de banco, chave secreta e `service_role` não podem. [Referência oficial sobre chaves](https://supabase.com/docs/guides/getting-started/api-keys).

## 1. Preparar o projeto Supabase

Abra o projeto `bhrgcnoohoptugbggubl` no Supabase Dashboard. Confira o projeto antes de qualquer ação. O projeto informado para esta implementação é:

```text
Project URL: https://bhrgcnoohoptugbggubl.supabase.co
Publishable Key: sb_publishable_p1Zbdqmfi136wivuksRT8A_0La9G0cd
```

Esses dois valores estão em `cms/config.js`. O cliente reutilizável está em `cms/client.js` e usa o Supabase JavaScript v2.118.0 empacotado em `cms/vendor/supabase.js`, sem CDN durante o uso do site. O cliente público não restaura a sessão do painel; ele continua lendo como visitante, mesmo no navegador de um administrador. Não acrescente senhas ou credenciais privilegiadas à configuração, aos HTML ou a variáveis que serão incorporadas ao JavaScript publicado.

Antes de aplicar mudanças no projeto real, revise os scripts e confirme que os nomes de tabela estão disponíveis. Se o projeto já contiver tabelas homônimas, pare para comparar os esquemas; não apague dados nem rode um reset para resolver o conflito.

## 2. Ordem de configuração: SQL e criação manual do bucket

As migrações devem ser aplicadas integralmente, uma única vez por projeto. Elas criam a estrutura; o seed copia o conteúdo já existente. São etapas distintas. No **SQL Editor**, abra **New query**, cole o conteúdo completo do arquivo, confira a ordem e execute com a conta de proprietário do projeto. Aguarde o sucesso antes de passar ao próximo. Não cole fragmentos isolados das políticas.

1. `supabase/migrations/20261022000100_cms_schema.sql`: tabelas, constraints, índices, timestamps, funções de autorização, RLS e RPC de reordenação.
2. **No Dashboard → Storage**, crie manualmente o bucket público `site-images`, com limite de 5 MB e tipos `image/jpeg`, `image/png`, `image/webp`, conforme a seção 5 abaixo. Não envie arquivos antes de concluir as políticas.
3. `supabase/migrations/20261022000200_site_images.sql`: somente funções de proteção de referências e políticas RLS. Não cria nem altera registros de `storage.buckets`.
4. `supabase/seed.sql`: textos, imagens locais, links e os nove officers extraídos do site.

Não execute SQL pelo navegador do site. Ele deve ser executado pelo responsável no Dashboard, depois de revisão e autorização. O fluxo de publicação de arquivos não executa migrações.

As seis tabelas são:

| Tabela | Conteúdo |
| --- | --- |
| `site_content` | Campos editoriais por página, seção e campo, tipo do valor e publicação. |
| `leadership_members` | Nome, cargo, biografia, foto, redes, ordem e publicação dos officers. |
| `events` | Título, descrição, data, horários, categoria, local, imagem, inscrição e publicação. |
| `partners` | Organização, logo, descrição, benefício, condições, URL, ordem e publicação. |
| `site_settings` | E-mail, canais, links gerais e textos compartilhados do site. |
| `admin_users` | UUID de usuários Auth explicitamente autorizados e seu papel. |

O seed não inventa eventos, parceiros, contatos ou fotos. Preserva a ordem dos nove nomes reais, os textos encontrados e os caminhos de `assets/`. O uso de `ON CONFLICT DO NOTHING` evita duplicar chaves existentes e sobrescrever edições feitas no painel. **O seed é de inicialização:** não o execute em todo deploy. Se um conteúdo inicial tiver sido removido deliberadamente, executar o seed de novo pode inseri-lo novamente, porque a chave deixou de existir.

O catálogo inicial contém 203 campos editoriais e 10 configurações públicas. `tools/bootstrap-content.mjs` foi usado uma vez para extrair esse conteúdo e gerar o seed; ele não deve ser executado em deploys ou novamente sobre os HTML já marcados sem revisão técnica. O conteúdo do banco não é reimportado automaticamente dos arquivos.

A primeira migração também cria `public.reorder_cms_records(entity, ordered_ids)`. Essa RPC permite ordenar apenas `leadership_members` e `partners`, com autorização admin/editor e regras RLS. Ela atualiza somente a ordem, de forma atômica: uma mudança de posição não reenvia nomes, cargos ou publicação que outra pessoa pode ter editado. IDs inválidos, duplicados ou removidos cancelam a operação inteira. Isso protege a reordenação; não constitui versionamento colaborativo de todos os formulários.

Guarde um registro das migrações aplicadas. As mudanças seguintes devem ser novos arquivos SQL revisados, não edições silenciosas das migrações já executadas.

## 3. Configurar Authentication

No Dashboard, abra **Authentication** e a área **Sign In / Providers**. Mantenha e-mail/senha habilitado. Desative **Allow new users to sign up** e não habilite login anônimo para o painel. Desabilitar novos cadastros permite que contas existentes continuem entrando. A localização exata dos controles pode mudar; a [documentação de configuração do Auth](https://supabase.com/docs/guides/auth/general-configuration) identifica esses controles.

Em **Authentication → URL Configuration**, use:

```text
Site URL
https://brasauh-test.netlify.app

Redirect URLs
https://brasauh-test.netlify.app/admin/
http://localhost:4173/admin/
http://127.0.0.1:4173/admin/
```

O login com e-mail/senha acontece na própria página. Essas URLs definem destinos permitidos para fluxos de e-mail/autenticação; não concedem permissões de banco. Se testar um Deploy Preview, adicione apenas a URL exata aprovada daquele preview. [Referência de Site URL e Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

O painel não oferece cadastro público de administradores. Ele também não é um fluxo de convite, confirmação de e-mail ou recuperação de senha por link. Para a primeira conta, use criação manual com senha e e-mail confirmado no Dashboard. Não altere globalmente a verificação de e-mail apenas para contornar um erro de login.

## 4. Criar o primeiro administrador

São necessários **dois passos**: criar a identidade no Auth e autorizar o UUID no banco.

1. Em **Authentication → Users**, escolha **Add user / Create new user**. Crie a conta da pessoa responsável com seu e-mail real e senha forte. Confirme o e-mail nessa criação manual, quando a opção estiver disponível. Não utilize um cadastro público do site.
2. Abra os detalhes dessa conta e copie **User UID / ID**. É um UUID semelhante a `12345678-1234-1234-1234-123456789abc`, não o e-mail nem a chave publicável. A [página Users do Dashboard](https://supabase.com/docs/guides/auth/managing-user-data) é onde se consultam essas identidades.
3. No SQL Editor, como proprietário, substitua o texto entre aspas abaixo pelo UUID real e execute somente depois de conferir a identidade:

```sql
insert into public.admin_users (user_id, role)
values ('COLE-AQUI-O-UUID-REAL-DO-AUTH'::uuid, 'admin')
on conflict (user_id) do nothing;
```

4. Confira no Table Editor se a linha foi criada com o UUID correto. Entre em `/admin/` com o e-mail e a senha dessa mesma conta.

O texto `COLE-AQUI...` é deliberadamente inválido: impede uma execução acidental com um usuário de exemplo. Este SQL não pertence ao seed, ao frontend ou ao deploy. Os papéis `admin` e `editor` têm as mesmas permissões de edição de conteúdo nesta versão. Nenhum deles pode gerenciar `admin_users` pelo frontend. Cada conta autenticada só pode consultar a própria linha nessa tabela. O painel não pode conceder papéis a si próprio. A inclusão e a revogação de administradores ficam sob responsabilidade do proprietário, por processo privilegiado manual.

Para autorizar outra pessoa, repita a criação no Auth e a autorização do UUID. Para revogar, remova somente a linha daquele UUID em `admin_users`, depois de confirmar quem será afetado. Não exclua todos os usuários administrativos. Ao usar uma conta compartilhada em equipamento alheio, clique em **Sair** ao terminar.

## 5. Criar o bucket manualmente pelo Dashboard

Faça esta etapa **depois da migração de schema (00100) e antes da migração de políticas (00200)**:

1. No projeto correto, abra **Storage → Buckets → New bucket**.
2. Informe o nome/ID exato `site-images` e habilite **Public bucket**.
3. Nas opções de criação ou em **Edit bucket** depois de criar, habilite a restrição de tamanho e informe **5 MB** (5.242.880 bytes, ou 5 MiB). Confira o limite salvo; se a tela aceitar bytes, use `5242880`.
4. Habilite a restrição de tipos MIME e informe **`image/jpeg`, `image/png`, `image/webp`**. JPG e JPEG usam o mesmo MIME `image/jpeg`; não use `image/*` ou `image/jpg`.
5. Salve e confira as opções abaixo. O limite global do Storage precisa permitir pelo menos esse tamanho; **não reduza o limite global a 5 MB**, pois isso afetaria outros buckets.
6. Volte ao SQL Editor e aplique a migração **00200** completa. Ela adiciona as funções/políticas; não há necessidade de criar uma política permissiva extra no Dashboard. Depois, execute o seed inicial e configure a conta autorizada antes de testar uploads.

Se `site-images` já existir, confira/ajuste apenas esse bucket no Dashboard, sem recriá-lo ou excluir seus objetos. Não execute de novo migrações que já foram aplicadas. Remover o bloco de criação de bucket deste arquivo local não desfaz configurações antigas de um ambiente que já o executou.

| Opção | Valor esperado |
| --- | --- |
| Nome/ID | `site-images` |
| Public bucket | Habilitado |
| Limite por arquivo | 5 MB (5.242.880 bytes) |
| MIME types | `image/jpeg`, `image/png`, `image/webp` |
| Upload, atualização e exclusão | Somente usuários explicitamente autorizados pelas políticas |

O Dashboard configura o bucket, o tamanho e os formatos; a migração 00200 configura somente as funções e políticas. As tabelas internas do Storage devem ser tratadas como somente leitura fora do serviço: não use `INSERT`, `UPDATE` ou `DELETE` direto em `storage.buckets`/`storage.objects`. Não basta criar um bucket público e liberar escrita para “todos os autenticados”. Limite e formatos são verificações do serviço, além da validação no navegador. [Schema do Storage](https://supabase.com/docs/guides/storage/schema/design), [criação e restrições de buckets](https://supabase.com/docs/guides/storage/buckets/creating-buckets) e [políticas de Storage](https://supabase.com/docs/guides/storage/security/access-control).

As políticas permissivas desta migração exigem `bucket_id = 'site-images'`. As restritivas deixam passar `bucket_id <> 'site-images'`, sem conceder novos acessos: os demais buckets continuam sujeitos às próprias políticas. A leitura por URL pública usa a configuração pública do bucket; não depende de liberar listagem anônima de `storage.objects`.

A proteção de exclusão verifica referências em todas as tabelas, incluindo rascunhos e campos de links. Reconhece URLs `/object/public`, `/object/sign`, `/object/authenticated` e `/render/image/...`, remove query/fragmento e decodifica o caminho uma vez (`%2D`, `%2F`, UTF-8 etc.); `+` permanece literal. A detecção aceita qualquer host com esse caminho, de forma conservadora: uma URL de outro projeto com o mesmo objeto pode bloquear a exclusão. Isso não libera renderização de imagens externas: o CMS continua aceitando imagens locais ou a URL pública original do próprio bucket. URLs transformadas/assinadas são reconhecidas para proteção, mas não ampliam os formatos de imagem aceitos pelo editor. A verificação completa do serviço e o teste dos outros buckets estão no [checklist manual](docs/testes-manuais.md).

**As imagens são públicas.** Quem conhece a URL de uma imagem em `site-images` pode abri-la, inclusive quando ela está associada a um rascunho. Publicar/despublicar controla os registros e a exibição no site, não a confidencialidade do arquivo. Envie somente materiais destinados ao público; documentos internos exigem outro bucket privado e outro fluxo. [Modelo de buckets públicos](https://supabase.com/docs/guides/storage/buckets/fundamentals).

As imagens antigas em `assets/` continuam válidas. Campos de imagem aceitam esses arquivos locais ou URLs públicas do bucket `site-images` deste projeto, em JPG/PNG/WebP. Para usar uma imagem hospedada em outro serviço, envie o arquivo permitido pela biblioteca em vez de colar uma URL externa arbitrária. Fazer upload de outra imagem gera um caminho novo; salvar essa referência no conteúdo é uma etapa separada. Trocar ou excluir um registro não deve remover automaticamente o arquivo que outro registro ainda pode utilizar. Depois de uma substituição, a imagem anterior permanece disponível até uma remoção explícita permitida. O gerenciador verifica referências inclusive em rascunhos antes de confirmar a exclusão; as políticas do Storage também bloqueiam exclusão ou sobrescrita de arquivos ainda referenciados. Não exponha o schema `private` na Data API: ele contém as funções internas de autorização e verificação de referências. Essa proteção verifica as referências visíveis à transação; o painel não implementa bloqueio colaborativo de edição, e alterações simultâneas devem ser coordenadas.

## 6. Abrir e usar o painel

Na raiz deste site, rode `npm run serve` (Node instalado) para servir os arquivos localmente. A porta padrão é 4173. Abra:

```text
Site local: http://localhost:4173/
Painel local: http://localhost:4173/admin/
Painel após a publicação aprovada: https://brasauh-test.netlify.app/admin/
```

Não abra o CMS por duplo clique em `admin/index.html`: módulos JavaScript e requisições precisam de uma origem HTTP/HTTPS. Node é uma ferramenta de desenvolvimento local, não um servidor obrigatório em produção. Como alternativa, se Python já estiver disponível, execute na raiz do site:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

A pasta servida precisa conter `index.html`, `admin/`, `cms/` e `assets/`. Para apenas navegar no site e abrir o painel, não é necessário instalar dependências nem reconstruir a biblioteca já incluída. Se usar `127.0.0.1`, mantenha esse endereço durante o teste; a sessão do navegador pertence à origem utilizada.

Entre com a conta autorizada. A sessão é restaurada ao recarregar; ter uma sessão válida sem a linha correspondente em `admin_users` resulta em acesso não autorizado. Login não cria automaticamente permissão administrativa.

### Rotina de edição

- **Página Inicial, Quem Somos e Faça Parte:** escolha a seção e revise texto e links. A prévia abre a página real com os valores ainda não salvos; confira antes de salvar. A publicação é definida por campo. O editor aceita texto, não JavaScript ou HTML executável.
- **Diretoria:** mantenha nome/cargo, biografia opcional, foto e LinkedIn corretos; defina a ordem e o estado publicado. A descrição acessível da foto é gerada a partir do nome.
- **Calendário:** preencha a data e os horários locais de Houston, categoria e local; adicione imagem e URL de inscrição quando existirem. Confira o mês e o filtro na página pública. Quando existe um próximo evento publicado, a chamada da agenda na Home mostra seu título, data, horário e local; sem próximos eventos, permanece o conteúdo editorial de base.
- **Parcerias:** preencha somente parcerias confirmadas, incluindo benefícios, condições e URL. Revise a ordem e a publicação.
- **Gerenciar Imagens:** envie JPG/JPEG, PNG ou WebP até 5 MB; veja a prévia e utilize a URL no conteúdo correspondente. O envio tem estado de progresso indeterminado e mensagem de conclusão/erro, sem porcentagem estimada. Imagens já enviadas podem ser reutilizadas pela biblioteca.
- **Configurações:** atualize e-mail, LinkedIn, Instagram, WhatsApp, Get Involved, Portal BRASA, BRASA Global, UH e textos do rodapé. O editor compartilhado de cabeçalho/rodapé reúne os outros campos repetidos. Campos de canais ainda não fornecidos continuam vazios.

Depois de salvar conteúdo publicado, abra a página pública em outra aba e atualize. Essas alterações de conteúdo não exigem Git commit nem um novo deploy. A edição da estrutura, estilos ou código ainda exige publicação de arquivos.

Antes de sair de um formulário, conclua o salvamento. Uma imagem enviada sem salvar o registro continua armazenada, mas não se torna automaticamente a imagem publicada daquele registro.

## 7. Segurança e disponibilidade

As tabelas expostas usam RLS. Visitantes e usuários autenticados comuns leem somente conteúdo público/publicado; a autorização explícita permite gerenciar conteúdo. A lista privada de administradores não é um diretório público e não pode ser alterada pelo frontend. As políticas do banco e do Storage continuam valendo para chamadas REST fora do painel.

A interface valida links e imagens e usa DOM seguro para texto remoto. O conteúdo editável não é um mecanismo para inserir scripts. No calendário, datas e horários seguem a convenção `America/Chicago` já existente no site.

O HTML e `data.js` continuam sendo uma cópia pública inicial de fallback. Em caso de indisponibilidade da API, o site pode mostrar esse conteúdo original, não a última edição feita no painel. Remover ou despublicar no banco não apaga a cópia histórica que já existe nos arquivos distribuídos. Para remover informação do próprio fallback, é necessária uma alteração de código revisada e um novo deploy. Nunca coloque segredos em conteúdo que já foi publicado ou nesse fallback.

## 8. Testar antes da publicação

Siga o [roteiro de testes manuais](docs/testes-manuais.md), incluindo os três perfis: visitante, usuário Auth comum e usuário autorizado. Existe também uma [suíte pgTAP opcional para banco local descartável](supabase/tests/README.md); ela não deve rodar em produção e não substitui testes reais de upload. Testes locais/simulados não comprovam a configuração de Auth, RLS ou Storage do projeto real.

Os comandos locais são `npm run check` (sintaxe/arquivos) e `npm test` (testes automatizados). Instale as dependências de desenvolvimento antes de executá-los, com `pnpm install --frozen-lockfile --ignore-scripts` usando o lockfile do projeto. Essa instalação foi verificada com pnpm 11.25; `pnpm-workspace.yaml` registra a configuração de build de dependências. A biblioteca do navegador já está incluída; `npm run build:vendor` só é necessário ao atualizar deliberadamente a versão do Supabase JS. Os testes de navegador são executados com `npm run test:browser`. Playwright é uma dependência apenas de desenvolvimento e usa Microsoft Edge instalado (`msedge`) por padrão. Se preferir o Chromium instalado pelo Playwright, use `npx playwright install chromium` e, no PowerShell, defina `$env:PLAYWRIGHT_CHANNEL = 'chromium'` antes de executar a suíte. O navegador roda sem janela, e as APIs Supabase são interceptadas pelas fixtures; não há envio ao projeto real durante essa suíte.

O [registro de verificação local](docs/verificacao-local.md) separa resultados executados de pendências de integração. A suíte local de banco usa PGlite (PostgreSQL WASM), com estruturas mínimas de Auth/Storage simuladas; ela não envia requisições ao Supabase real. Ausência de migrações ou de conta autorizada não deve ser “corrigida” desligando RLS. Sem esses preparativos, o público deve manter seu fallback e o painel deve informar a indisponibilidade/ausência de acesso.

## 9. Publicar com GitHub e Netlify — somente após aprovação

1. Revise o diff e os testes. Confira que não há senhas, tokens de sessão, chaves secretas ou arquivos `.env` no commit.
2. Após autorização para configurar o projeto real, execute o SQL e configure Auth/Storage conforme este guia. Faça os testes remotos com dados temporários identificáveis.
3. Esta pasta local não contém `.git`. Aplique os arquivos novos/alterados listados no inventário ao clone correto do repositório GitHub já ligado ao Netlify, confira o diff e rode os testes. Somente após autorização para publicar, faça commit/push nesse clone. Preserve o domínio `brasauh-test.netlify.app` e as configurações existentes da integração.
4. Use o `netlify.toml` incluído: o build command é `node tools/build-static.mjs` e o diretório de publicação é `dist`. O script copia somente os arquivos públicos (seis HTML, `data.js`, `script.js`, `style.css`, `_headers`, `assets/`, `admin/` e `cms/`). SQL, documentação, testes e `node_modules/` ficam fora do resultado. O site continua estático; Node roda apenas na preparação dos arquivos. Não configure uma rota SPA que devolva `index.html` para arquivos JS inexistentes.
5. Abra o deploy de revisão e teste `/admin/`, páginas, imagens e console. Só promova a versão validada conforme o fluxo do projeto.

Para conferir o pacote publicável localmente, rode `npm run build` e inspecione `dist/`; esse comando usa somente recursos nativos do Node e não precisa regenerar o SDK já incluído. Não execute migrações ou seed como build command. Não é necessário um plano pago ou converter o site em framework para este fluxo. O arquivo `_headers` foi preparado localmente: páginas/código exigem revalidação de cache, `/admin/*` usa `no-store` e `noindex`, e `/assets/*` tem cache de uma hora. Também define `nosniff`, política de referrer e proteção de enquadramento do painel na mesma origem. Essas configurações só entram em vigor no Netlify depois da publicação aprovada; não foram aplicadas remotamente.

Após uma mudança no código, use recarga completa para conferir a versão nova. Imagens enviadas com nomes novos evitam reutilizar a mesma URL antiga em cache; não substitua arbitrariamente arquivos compartilhados no Storage. Para reverter problemas de frontend, pode-se restaurar um deploy anterior aprovado; isso não desfaz dados alterados no Supabase. Planeje correções de banco separadamente, sem reset de tabelas.

## Problemas comuns

| Sintoma | O que verificar |
| --- | --- |
| “Invalid login credentials” | E-mail/senha, projeto correto e conta criada no Auth. A chave publicável não é uma senha. |
| E-mail não confirmado | Detalhes do usuário no Dashboard; confirme a conta pelo processo manual autorizado. |
| Login funciona, acesso administrativo negado | UUID exato em `admin_users`, papel permitido, migração e políticas. Uma conta Auth comum não deve entrar. |
| Tabela não encontrada / API 404 | Aplicação da migração de schema no projeto correto e disponibilidade da API. |
| Erro de RLS / permission denied | Sessão autorizada e políticas completas. Não abra a tabela para escrita pública. |
| Bucket não encontrado / upload negado | Migração de Storage, bucket `site-images`, conta autorizada, tipo e tamanho do arquivo. |
| Imagem não aparece após upload | A referência foi salva no registro? A imagem foi publicada? O caminho/URL é válido? |
| Conteúdo antigo no site | Publicação do registro, salvamento, projeto configurado e erros de rede. Se a API falhar, o fallback antigo é esperado. |
| Tela por `file://` ou módulos bloqueados | Abra por servidor HTTP local e confira que os scripts são servidos como JavaScript. |
| `/admin/` retorna 404 no Netlify | Build concluído, publicação de `dist/`, presença de `dist/admin/index.html` e redirects antigos. |
| Ícone, logo ou fonte indisponível | Caminhos de `assets/`, resposta de rede e bloqueio do Google Fonts. As fontes têm fallback local. |
| Conteúdo de teste ficou visível | Revise a publicação e remova apenas os registros de teste criados por você; nunca resete tabelas. |

## O que ainda depende de configuração manual

Executar as migrações e o seed; criar/autorizar os administradores; configurar URLs e provedores Auth; conferir o bucket e suas políticas; realizar os testes reais de acesso, edição e upload; revisar e publicar os arquivos. Fotos e links oficiais dos officers, contatos, eventos e parceiros continuam dependendo das informações reais da organização.






