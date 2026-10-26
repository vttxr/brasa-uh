# BRASA UH — site institucional

Abra index.html para navegar. São seis páginas: Home, Quem Somos, Diretoria, Calendário, Parcerias & Benefícios e Faça Parte. Mantenha os arquivos e a pasta assets juntos.

## Organização do projeto
- `index.html`, `quem-somos.html`, `diretoria.html`, `calendario.html`, `parcerias.html` e `faca-parte.html`: estrutura e conteúdo de cada página.
- `style.css`: identidade visual, componentes compartilhados e ajustes responsivos.
- `script.js`: menu móvel, contatos, cartões dinâmicos, abas e calendário.
- `data.js`: contatos, diretoria, eventos e parceiros; atualize aqui os dados oficiais.
- `assets/`: logos, imagens e ícone usados pelo site.

## Conteúdo oficial pendente
- Fotos oficiais e URLs do LinkedIn dos officers. Os nove nomes e cargos fornecidos já estão incluídos.
- E-mail e página do LinkedIn da BRASA UH.
- Link específico da associação no Get Involved (por enquanto, usamos o portal oficial da UH).
- Eventos confirmados: título, data, horário de Houston, local, categoria, descrição e link.
- Parceiros locais: nome, logo, benefício, condições e link.

Esses dados ficam centralizados em data.js. Os nove officers estão cadastrados. Os arrays de eventos e parceiros permanecem vazios até a confirmação dos dados. Ao preencher os officers e parceiros, o site gera os respectivos cartões automaticamente. O calendário lê os eventos desse arquivo e não sincroniza automaticamente com Instagram ou calendários externos. A home mantém um aviso editorial de novas datas; atualize esse aviso quando divulgar a agenda.

A diretoria exibe os nove nomes e cargos, com iniciais no lugar das fotos ainda não fornecidas. Os cartões também estão presentes no HTML para funcionar sem JavaScript. Links do LinkedIn serão exibidos quando forem preenchidos. Os campos LinkedIn e e-mail do rodapé aparecem como “em breve” até receberem dados. A seção Faça Parte encaminha ao Instagram e ao Get Involved; não há formulário de inscrição nem coleta de dados neste site.

## Identidade e fontes
Identidade revisada conforme o Manual de ID Visual BRASA (2025). A paleta e a escala tipográfica estão centralizadas em `assets/brand.css`, compartilhadas pelo site, painel e preview. Verde `#03571A`, azul `#065FD8` e amarelo `#FFCC02` identificam a BRASA; vermelho UH `#C8102E` permanece nos CTAs institucionais e elementos da universidade. Fundos brancos/cinza e seções de destaque verde/azul-escuro organizam a leitura.

As fotos e os placeholders da diretoria têm proporção 1:1, `border-radius: 50%` e tamanho consistente. As fotos usam `object-fit: cover` e centro por padrão; quatro retratos publicados têm ajuste individual de enquadramento no CSS, vinculado ao arquivo da foto. Nenhuma imagem original foi editada. Logos mantêm suas cores/proporções, sem rotação, filtro ou sombra. As setas continuam em SVG, independentes dos emojis do dispositivo.
- Referência: https://gobrasa.org/
- Portal BRASA: https://portalbrasa.gobrasa.org/
- BRASA ID: descrição oficial do BRASApp em https://apps.apple.com/br/app/brasapp/id6747324396
- Get Involved: https://getinvolved.uh.edu/
- Instagram fornecido: https://www.instagram.com/brasa.uh/
- Foto do campus: University of Houston, https://www.uh.edu/_images/_homepage/banner.jpg — imagem institucional do campus, não uma foto de membros da BRASA UH.
- Logo da BRASA UH: WhatsApp Unknown 2026-10-21 at 19.43.29.zip, versão colorida com fundo branco. Versão monocromática original também preservada em assets.
- Logo UH: https://www.uh.edu/brand/_img/uh_red.png — versão oficial correspondente ao símbolo enviado.
- Tipografia: Lato local nos pesos 300, 400, 700 e 900, sob SIL OFL 1.1. Hagrid está **pendente de arquivos com licença web**; os títulos de impacto usam fallback Lato declarado. Não há download de fontes de terceiros durante a navegação. Fontes, licença e regras do manual estão documentadas em `docs/brand-fonts.md`.
- Títulos com a palavra BRASA usam sempre Lato, inclusive depois de alterações pelo CMS/preview. A regra fica em `cms/typography.js`; textos e campos cadastrados permanecem intactos.

O painel em `admin/` segue a mesma identidade do site público em todas as telas: login, navegação, visão geral, editores, biblioteca de imagens, configurações e modais. `admin/admin.css` reutiliza as fontes, cores, escala de títulos e bordas de `assets/brand.css`, com corpo de 16px, controles legíveis e layouts responsivos. A marca branca existente é usada sobre os fundos escuros. O slogan do login usa a família de impacto com fallback Lato; os títulos institucionais continuam em Lato.

Na diretoria administrativa, fotos e iniciais são circulares na lista, na foto selecionada e na prévia de edição. O atributo visual `data-record-type` diferencia integrantes, eventos e parceiros, preservando os formatos apropriados dos outros cadastros. As alterações não modificam os registros, as imagens originais ou os fluxos de autenticação e salvamento.

## Verificação
Execute `npm test`, `npm run test:browser` e `npm run build`. Os testes de redesign em `tests/browser/redesign.spec.mjs` verificam fotos e placeholders circulares, nomes/cargos preservados, fallback quando o CMS falha, Lato após edição no preview, paleta e responsividade. `tools/verify-redesign.mjs` gera screenshots e uma auditoria de contraste de fundos sólidos em 320, 390, 768 e 1440 px; use `--webkit` para o motor utilizado pelo Safari. Fotos e fundos complexos exigem também revisão visual.

`tests/browser/admin-branding.spec.mjs` verifica a identidade compartilhada e a apresentação circular da diretoria no painel, sem alterar dados reais. Os testes funcionais existentes cobrem login, navegação, edição, prévia e salvamento com respostas locais simuladas.

## Publicação
Este redesign fica somente local para revisão. O clone Git está na subpasta `brasa-uh/`; `dist/` é a saída gerada pelo build. Não fazer commit, push, merge ou deploy automaticamente. A integração e as configurações de hospedagem existentes são preservadas.
