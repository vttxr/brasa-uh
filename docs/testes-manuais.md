# Roteiro de testes manuais — BRASA UH CMS

Este é um checklist para execução posterior, não um relatório de aprovação. Os itens abaixo não foram marcados como executados. Testes no projeto remoto exigem autorização para configurar o Supabase e criar dados de teste; não os execute automaticamente. Faça primeiro a revisão local e use um ambiente de teste quando disponível.

Registre data, URL/versão testada, navegador, perfil de acesso, resultado, evidência e UUIDs dos registros temporários. Use títulos claramente identificados como **TESTE CMS — remover**. Remova apenas os registros temporários criados para o teste, depois de verificar as referências de imagens.

## Preparação

- [ ] Ler `README-SUPABASE.md` e `docs/auditoria-inicial.md`.
- [ ] Conferir os scripts locais `npm run check` e `npm test`; guardar sua saída separadamente.
- [ ] Confirmar aprovação antes de aplicar SQL, criar contas, enviar arquivos ou publicar.
- [ ] Aplicar `20261022000100_cms_schema.sql`; criar/configurar `site-images` manualmente no Dashboard; aplicar `20261022000200_site_images.sql`; por último, executar `supabase/seed.sql`, na ordem do README. A migração 00200 não cria nem altera buckets.
- [ ] Criar três contextos de navegador separados: visitante sem login; conta Auth comum sem linha em `admin_users`; conta Auth autorizada.
- [ ] Desativar signup público, manter e-mail/senha e conferir URL Configuration.
- [ ] Confirmar seis tabelas com RLS e funções internas no schema `private`, que não deve estar exposto na Data API.
- [ ] Confirmar bucket `site-images` público, limite de 5.242.880 bytes e MIME types JPEG/PNG/WebP.
- [ ] Anotar os nomes/ordem dos nove officers originais e conferir que seed não criou eventos/parceiros nem preencheu contatos desconhecidos.

## Site público e preservação visual

- [ ] Abrir as seis páginas em desktop (1440 px), tablet (768 px) e celular (390 e 320 px); conferir logos, cores, fontes, fotografia e espaçamentos originais.
- [ ] Clicar em todos os links do menu, rodapé e CTAs. Nenhum arquivo interno ou imagem deve retornar 404.
- [ ] Abrir o menu móvel, navegar, voltar, fechá-lo com Escape e conferir foco/`aria-expanded`.
- [ ] Navegar por teclado usando Tab e o link “Ir para o conteúdo”; verificar foco visível e ausência de bloqueios.
- [ ] Conferir as abas de Parcerias com mouse, setas, Home/End e o link `parcerias.html#global`.
- [ ] Conferir calendário vazio, mês anterior/próximo, passagem de dezembro para janeiro, botão Hoje e filtros Cultura/Social/Carreira/Comunidade.
- [ ] Confirmar que o dia atual usa `America/Chicago` mesmo com outro fuso no dispositivo.
- [ ] Verificar rolagem horizontal apenas no calendário quando necessário; nenhuma página deve ter textos/controles cortados.
- [ ] Ativar redução de movimento no sistema e conferir navegação sem transições desnecessárias.
- [ ] Recarregar com a rede do Supabase bloqueada no DevTools: texto original, nove officers, menu e calendário devem continuar funcionando pelo fallback.
- [ ] Repetir com JavaScript desativado: conferir conteúdo estático e links dos CTAs/rodapé. O menu móvel, as abas e o calendário dinâmico dependem de JavaScript, como na versão original.
- [ ] Inspecionar o console e Network durante toda a navegação; registrar erros inesperados. Falha de API simulada deve ser tratada, não apagar a página.

## Autenticação e autorização na interface

- [ ] Abrir `/admin/` sem sessão e confirmar que apenas o login aparece.
- [ ] Tentar senha incorreta: mensagem clara, sem revelar a senha nem mostrar dados administrativos.
- [ ] Entrar com conta Auth comum: acesso negado, sem editor e sem promoção automática.
- [ ] Entrar com administrador autorizado e conferir Visão Geral com totais reais e conteúdo recentemente alterado.
- [ ] Recarregar: sessão é restaurada e autorização é revalidada.
- [ ] Abrir uma página pública no mesmo navegador do administrador: ela deve mostrar somente dados publicados, sem aproveitar sua sessão para revelar drafts.
- [ ] Testar botão Sair e recarga; o painel volta à tela de login.
- [ ] Revogar manualmente apenas uma conta de teste em `admin_users`: mesmo que a tela antiga esteja aberta, novas gravações devem ser negadas pelo banco.
- [ ] Conferir que não há signup, senha hardcoded ou controle de autopromoção no frontend.
- [ ] Testar a conta com papel `editor`: nesta versão ela tem o mesmo CRUD de conteúdo que `admin`, mas nenhuma das duas altera permissões administrativas.

## Edição de páginas e configurações

- [ ] Alterar um título e um parágrafo de Home sem salvar, abrir a prévia e conferir o texto novo na página real da prévia.
- [ ] Voltar sem salvar e confirmar que visitantes ainda veem o valor anterior.
- [ ] Salvar e publicar; atualizar a página pública e confirmar o valor novo sem deploy.
- [ ] Repetir em Quem Somos, Faça Parte e nos campos compartilhados de cabeçalho/rodapé.
- [ ] Alterar texto de botão e destino; conferir a preservação do layout e clique correto.
- [ ] Testar acentos, aspas, quebras de linha e texto longo no celular.
- [ ] Inserir literalmente `<img src=x onerror=alert(1)>` em um campo de texto de teste: deve aparecer como texto, nunca executar HTML ou JavaScript. Remover depois do teste.
- [ ] Tentar `javascript:alert(1)`, `data:text/html,...`, URL com credenciais e `//dominio` em campos de link/imagem: a interface deve rejeitar ou deixar de renderizar o destino inseguro.
- [ ] Testar links HTTPS válidos, referências locais permitidas e um e-mail válido; conferir que destinos externos não ganham acesso à janela original.
- [ ] Salvar um campo como rascunho e consultar a API como visitante: o valor do rascunho não deve aparecer. O HTML estático inicial pode continuar visível como fallback — ele não representa acesso ao draft remoto.
- [ ] Atualizar Instagram, LinkedIn, e-mail, WhatsApp e Get Involved apenas com valores de teste aprovados; conferir todos os lugares correspondentes e restaurar dados reais.
- [ ] Confirmar comportamento de configuração vazia/despublicada; canais ainda não fornecidos não devem se transformar em links fictícios.

## Diretoria

- [ ] Conferir os nove nomes, cargos e ordem inicial antes de criar dados de teste.
- [ ] Criar officer temporário em rascunho; ele aparece no painel, mas não na API/página pública.
- [ ] Editar nome, cargo, biografia, LinkedIn e foto; validar campos obrigatórios e URL inválida.
- [ ] Publicar e recarregar Diretoria; conferir texto, foto, descrição acessível e link.
- [ ] Mover o registro acima/abaixo e conferir persistência da ordem após recarga.
- [ ] Despublicar e confirmar remoção da lista pública após resposta bem-sucedida da API.
- [ ] Excluir o registro temporário: solicitar confirmação; cancelar deve preservá-lo, confirmar deve removê-lo.
- [ ] Conferir que nenhuma exclusão de officer apagou automaticamente a imagem compartilhada.

## Eventos

- [ ] Criar evento temporário no mês corrente com data, horários, categoria, local, descrição, imagem e inscrição.
- [ ] Não publicar inicialmente: registro visível no painel e ausente para visitantes.
- [ ] Publicar e conferir grade e lista do calendário; clicar no dia deve levar ao item correto.
- [ ] Conferir ordenação por data/horário e filtros de categoria.
- [ ] Editar para outro mês e conferir que desaparece do mês anterior e surge no novo.
- [ ] Testar evento sem horário, sem URL e sem imagem; os campos são opcionais e não devem gerar links vazios.
- [ ] Testar horário final sem início: deve ser rejeitado. Fim anterior ao início representa término no dia seguinte e precisa ficar compreensível.
- [ ] Testar data em transição de mês/ano; não deslocar um dia por conversão UTC.
- [ ] Despublicar e excluir o evento de teste, verificando o estado vazio do calendário.
- [ ] Conferir a chamada da agenda na Home: um próximo evento publicado preenche o destaque com título/data/horário/local e link ao calendário. Sem próximos eventos, o texto editorial de base é preservado.

## Parcerias

- [ ] Criar parceiro temporário com nome, logo, descrição, benefício, condições e website.
- [ ] Salvar em rascunho, publicar, editar e reordenar; conferir cada estado na aba local.
- [ ] Excluir com confirmação; conferir estado vazio quando não houver parceiros publicados.
- [ ] Confirmar que os textos/links BRASA Global e BRASA ID permanecem acessíveis na outra aba.
- [ ] Conferir que o conteúdo e os logos de teste não afetam parceiros reais.

## Imagens e Storage

- [ ] Conferir no Dashboard que o limite de 5 MB e os MIME types foram configurados apenas em `site-images`; não reduzir o limite global do projeto.
- [ ] Enviar um JPEG, um PNG e um WebP válidos, todos abaixo de 5 MB.
- [ ] Conferir prévia, indicação “enviando”, mensagem de conclusão e URL utilizável; não esperar percentual de progresso numérico.
- [ ] Reutilizar a imagem em dois registros e salvar ambos. A biblioteca deve permitir reaproveitamento sem upload duplicado.
- [ ] Substituir a foto de um registro: um novo nome/UUID é criado e a imagem antiga continua funcionando para o outro registro.
- [ ] Tentar excluir a imagem ainda referenciada: bloqueio no painel e no serviço, inclusive se a única referência estiver em rascunho.
- [ ] Repetir com URL transformada `/render/image/public/site-images/...`, URL assinada e caminho percent-encoded (`%2D`, `%2F`, UTF-8); parâmetros de consulta não devem esconder a referência. Esses formatos são testes de detecção, não uma ampliação dos formatos aceitos pelo editor de imagem.
- [ ] Remover todas as referências de uma imagem de teste; excluir explicitamente e confirmar somente esse arquivo.
- [ ] Cancelar confirmação de exclusão e verificar que nada foi apagado.
- [ ] Tentar GIF, SVG, PDF, arquivo vazio, MIME/extensão incompatíveis, conteúdo renomeado para JPG e arquivo acima de 5 MB: devem ser rejeitados.
- [ ] Repetir tipo/tamanho proibidos diretamente pela API de Storage com uma conta de teste autorizada, sem passar pela validação do navegador: o serviço deve bloquear.
- [ ] Tentar upload, overwrite, move e delete sem login e com conta Auth comum: devem ser bloqueados.
- [ ] Conferir que visitante não consegue listar o bucket/metadados, mas consegue abrir uma URL pública válida de imagem.
- [ ] Confirmar conscientemente a limitação do bucket público: a URL de uma imagem ligada a rascunho também abre. Não usar esse bucket para material confidencial.
- [ ] Simular perda de conexão durante upload/salvamento: erro compreensível, possibilidade de tentar novamente e ausência de mensagem falsa de sucesso.
- [ ] Se Storage retornar zero objetos removidos, a imagem deve continuar na lista e a exclusão deve ser informada como não confirmada.
- [ ] Comparar SELECT/listagem, upload, atualização e exclusão em outro bucket antes/depois das políticas, com visitante, usuário comum e admin, respeitando as permissões próprias desse bucket. Não conceder acesso novo para testar. Conferir também que um bucket sem política permissiva continua inacessível e que seus limites/MIME/publicação não mudaram.

## Verificação direta de RLS, sem confiar na tela

Esta etapa deve ser feita pelo responsável técnico, com dados temporários e autorização para o ambiente. Não teste somente pelo SQL Editor como `postgres`: esse papel privilegiado não representa um visitante nem comprova as políticas. Use chamadas reais à Data API com a chave publicável e, quando necessário, JWT de uma conta de teste.

A base REST é `https://bhrgcnoohoptugbggubl.supabase.co/rest/v1/`. Na requisição anônima, envie `apikey` com a chave publicável, sem inventar um Bearer token com essa chave. Em uma requisição autenticada, envie também `Authorization: Bearer <access_token da própria conta de teste>`. Não cole JWTs, senhas ou chaves secretas em prints, commits, tickets ou arquivos de teste públicos.

| Operação a testar diretamente | Visitante | Auth sem autorização | Admin/editor autorizado |
| --- | --- | --- | --- |
| SELECT de conteúdo `published=true` | Permitido | Permitido | Permitido |
| SELECT de conteúdo `published=false` | Sem linhas | Sem linhas | Permitido |
| INSERT em cada tabela de conteúdo | Negado | Negado | Permitido para dados válidos |
| UPDATE/DELETE de registro conhecido de teste | Sem alteração | Sem alteração | Permitido |
| SELECT de `admin_users` | Negado/sem acesso | Apenas a própria linha, se existir | Apenas a própria linha |
| INSERT/UPDATE/DELETE de `admin_users` | Negado | Negado | Negado |
| Upload/listagem no bucket | Negado | Negado | Permitido |
| Exclusão/sobrescrita de imagem em uso | Negado | Negado | Negado |

- [ ] Rodar SELECT com `published=eq.false` em `site_content`, `leadership_members`, `events`, `partners` e `site_settings` para cada perfil.
- [ ] Repetir POST/PATCH/DELETE nessas cinco tabelas contra registros temporários, inclusive UUID conhecido de um draft. Em PATCH/DELETE, uma resposta vazia com status de sucesso pode significar que nenhuma linha era autorizada: conferir o estado do registro com o administrador, não apenas o status HTTP.
- [ ] Tentar inserir o próprio UUID em `admin_users`, alterar role e remover outra linha por REST: todas as tentativas devem falhar para qualquer cliente do site.
- [ ] Consultar UUID de outro administrador: não deve ser revelado para a conta testada.
- [ ] Tentar acionar as funções do schema `private` por RPC pública: elas não devem estar expostas na Data API.
- [ ] Confirmar que as verificações de Storage continuam restritivas se houver outras políticas antigas no projeto; não deixar uma política ampla conceder acesso ao bucket.
- [ ] Revogar a conta temporária e confirmar que um JWT ainda válido não permite continuar gravando.
- [ ] Conferir que nenhuma chamada usa `service_role`, chave secreta ou senha de banco; essas credenciais invalidariam o teste de permissões de visitantes.

## Seed e operação

- [ ] Em ambiente de teste, executar o seed, alterar um texto pelo painel e executar o seed novamente: o texto editado deve permanecer e não deve haver duplicação das chaves existentes.
- [ ] Confirmar o limite desse teste: seed de inicialização pode reinserir conteúdo inicial que foi excluído, portanto não integra deploys rotineiros.
- [ ] Conferir atualização de `updated_at` nas gravações e preservação de `created_at`.
- [ ] Testar simultaneamente duas abas de edição e documentar o comportamento de salvamento; não presumir bloqueio colaborativo ou versionamento que não foi implementado.
- [ ] Simular indisponibilidade da API. Explicar aos administradores que o fallback é a versão estática inicial e pode conter informação historicamente pública despublicada depois.

## Netlify e aceite

- [ ] Somente após aprovação, revisar o diff e confirmar ausência de credenciais privadas.
- [ ] Publicar arquivos pelo fluxo GitHub/Netlify autorizado sem executar SQL no build.
- [ ] Executar `npm run build`, conferir `dist/` e confirmar que SQL, docs, testes e `node_modules/` ficaram fora do pacote. No Netlify, conferir publicação de `dist`, `/admin/`, MIME dos módulos, assets e ausência de redirects SPA que mascarem arquivos faltantes.
- [ ] Testar a URL de preview exata autorizada e, depois, `https://brasauh-test.netlify.app`.
- [ ] Editar um texto publicado e uma imagem pelo painel no ambiente aprovado; atualizar o site público e conferir que mudaram sem novo deploy.
- [ ] Concluir a limpeza apenas dos registros e arquivos de teste não referenciados.
- [ ] Guardar relatório com itens aprovados, falhas, limitações e pendências. Não declarar o Supabase real validado enquanto Auth, RLS e Storage não tiverem sido testados nele.



