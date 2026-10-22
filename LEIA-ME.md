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
Identidade atualizada com verde profundo, amarelo, azul em detalhes e vermelho Cougar nos CTAs. Logos reais da BRASA UH (ZIP fornecido pelo usuário) e da UH substituem a marca provisória. Os JPEGs originais foram preservados: o CSS enquadra apenas a margem branca, sem alterar cores ou desenho. A home combina texto e fotografia em áreas separadas; as seis páginas compartilham essa direção visual.
- Referência: https://gobrasa.org/
- Portal BRASA: https://portalbrasa.gobrasa.org/
- BRASA ID: descrição oficial do BRASApp em https://apps.apple.com/br/app/brasapp/id6747324396
- Get Involved: https://getinvolved.uh.edu/
- Instagram fornecido: https://www.instagram.com/brasa.uh/
- Foto do campus: University of Houston, https://www.uh.edu/_images/_homepage/banner.jpg — imagem institucional do campus, não uma foto de membros da BRASA UH.
- Logo da BRASA UH: WhatsApp Unknown 2026-10-21 at 19.43.29.zip, versão colorida com fundo branco. Versão monocromática original também preservada em assets.
- Logo UH: https://www.uh.edu/brand/_img/uh_red.png — versão oficial correspondente ao símbolo enviado.
- Tipografia: Bricolage Grotesque e Instrument Sans, carregadas pelo Google Fonts, com fontes locais de fallback.

## Verificação
Passaram as verificações de sintaxe JavaScript, arquivos e links internos, IDs, mudança de ano no calendário, filtros, botão Hoje, navegação de abas por teclado e estado do menu móvel. Interações verificadas em um DOM simulado; a inspeção visual em navegador não foi possível porque não havia navegador conectado.

## Publicação
Esta versão ainda não foi publicada. A revisão automática de permissões bloqueou o envio da credencial ao helper oficial do Sites. O ID existente foi preservado: appgprj_6acfbad0427c8191a141afe0df37c440. Não criar outro Site para retomar a publicação.
