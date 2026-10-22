# Auditoria inicial — BRASA UH

Registro da leitura do código antes da integração com Supabase, em 22/10/2026. Este documento descreve o estado encontrado no disco, não uma inspeção do site em produção nem o resultado de testes de navegador.

## Arquivos efetivamente encontrados

A raiz continha `index.html`, `quem-somos.html`, `diretoria.html`, `calendario.html`, `parcerias.html`, `faca-parte.html`, `style.css`, `script.js`, `data.js`, `LEIA-ME.md` e `assets/`. Não havia `/admin/`, arquivos SQL, biblioteca Supabase, manifesto de dependências ou configuração de build nessa pasta. O `LEIA-ME.md` registra trabalhos e verificações de uma versão anterior; suas afirmações não foram usadas como evidência de testes desta implementação.

## Estrutura e conteúdo

As seis páginas são HTML5 em português (`lang="pt-BR"`), com título, descrição, viewport, favicon e acesso direto ao conteúdo. Cabeçalho, menu, barra superior e rodapé são repetidos nos HTML. Cada página carrega `style.css`, depois `data.js` e `script.js` com `defer`.

| Página | Estrutura preservada |
| --- | --- |
| Home | Hero com fotografia do campus e logos; pilares; texto editorial da agenda; rede global; convite para participar. |
| Quem Somos | Apresentação, missão, três pilares, convite para conhecer a diretoria e faixa Faça Parte. |
| Diretoria | Introdução e nove cartões de officers já presentes no HTML; iniciais enquanto não existem fotos. |
| Calendário | Navegação por mês, botão Hoje, grade, lista mensal e filtro por categoria. |
| Parcerias | Abas locais/BRASA Global, estado vazio local, explicação do BRASA ID, links ao Portal e BRASApp. |
| Faça Parte | Três passos com Instagram, Get Involved e calendário; link à diretoria. |

Os textos institucionais, títulos, botões, URLs, imagens da home e elementos do rodapé estavam nos HTML. O único objeto global de dados era `window.BRASA_DATA`, declarado em `data.js`. Ele continha contatos, officers, eventos e parceiros. Não havia textos vindos de API, sessões de usuário ou persistência remota.

A home dizia “Novas datas em breve” em HTML, independentemente do array de eventos. Editar eventos no estado inicial não alterava esse texto editorial automaticamente.

## Dados confirmados no código

A ordem abaixo é a mesma de `data.js` e dos cartões estáticos de `diretoria.html`:

1. Pedro Souza — Presidente
2. Thiago Granato — Vice-Presidente
3. Guilherme Morette — Finance Director
4. Alicia Calhau — Marketing Director
5. Guilherme Barbosa — Outreach
6. Pedro Martines — Coordenador de Parcerias
7. Vitor Sousa — Coordenador de Parcerias
8. Melissa Fuly — Coordenador de Eventos
9. Beatriz Bandeira — Coordenador de Eventos

Todos os campos `photo` e `linkedin` dos officers estavam vazios. Os contatos institucionais `email` e `linkedin` também estavam vazios. Os arrays `events` e `partners` não tinham registros. Esses vazios devem continuar vazios no seed; não há eventos, parceiros, fotos ou contatos adicionais para inferir.

## Conteúdo gerado e interações

- `script.js` substituía os placeholders de e-mail e LinkedIn quando existiam valores.
- Os cartões de officers e parceiros eram montados a partir de `data.js`. A diretoria já tinha fallback HTML com os nove integrantes.
- O calendário calculava o mês atual em `America/Chicago`, gerava grade e lista, ordenava por data/horário e permitia mudar mês/ano ou voltar a Hoje. As categorias eram Cultura, Social, Carreira e Comunidade.
- As abas de parcerias usavam `role="tab"`, `aria-selected`, setas, Home e End; `#global` abria a aba global.
- O menu móvel alternava a classe `open` e `aria-expanded`, fechava após navegação e com Escape, retornando o foco ao botão nesse último caso.
- O código antigo usava strings escapadas e `innerHTML` para cartões e calendário. A integração deve adotar nós DOM/textContent para dados do CMS e validar URLs antes de atribuir atributos.

## Imagens, cores e responsividade

`assets/` continha seis arquivos: `brasa-uh-color.jpeg`, `brasa-uh-white.jpeg`, `uh-campus.jpg`, `uh-logo.png`, `uh-interlocking.png` e `favicon.svg`. Os HTML utilizavam os caminhos relativos da versão colorida da BRASA UH, foto do campus e `uh-logo.png`. Os outros arquivos existentes também devem ser preservados. Não havia retratos de officers ou logos de parceiros.

O CSS usa verde `#063e2c`, amarelo `#f9d448`, azul `#1555a5` e vermelho Cougar `#c8102e`, fundo creme e tipografias Bricolage Grotesque/Instrument Sans via Google Fonts com fallback Arial. Os próprios JPEGs da BRASA UH são enquadrados pelo CSS; não é necessário redesenhar as marcas.

Há ajustes em 1150, 900, 760, 620 e 360 px e ampliação de espaçamento acima de 1600 px. O menu muda para móvel em 900 px. Grades se reduzem em telas menores e o calendário tem contêiner de rolagem horizontal. Há rolagem suave, transição de botões e suporte a `prefers-reduced-motion`; não foi encontrada biblioteca externa de animação. Foi identificado um erro preexistente na regra `a: focus-visible` (espaço indevido), que merece correção mínima de acessibilidade sem redesenho.

## Formulários, navegação e links

Não existia formulário de inscrição ou coleta de dados. Faça Parte enviava visitantes para serviços externos. Navegação interna usa os seis nomes de arquivos `.html`, links relativos e `aria-current` nas páginas principais; o CTA Faça Parte ainda não possuía `aria-current`.

Links públicos encontrados: Instagram `https://www.instagram.com/brasa.uh/`, Get Involved `https://getinvolved.uh.edu/`, Portal BRASA `https://portalbrasa.gobrasa.org/`, BRASA Global `https://gobrasa.org`, UH `https://www.uh.edu/` e BRASApp `https://apps.apple.com/br/app/brasapp/id6747324396`. Get Involved é o portal geral da UH, não um endereço específico da organização. Links externos do HTML usam `target="_blank"` e `rel="noopener noreferrer"`.

## Plano de implementação baseado na auditoria

1. Manter os seis HTML, CSS, assets e dados estáticos como base visual e fallback.
2. Mapear campos editoriais existentes para um catálogo de conteúdo (página/seção/campo), preservando a marcação de layout e os textos originais no seed.
3. Criar migrações revisáveis para seis tabelas, autorização por usuário Auth explícito, RLS e Storage; não executá-las no projeto remoto.
4. Criar o painel `/admin/` separado, com login, edição textual segura, CRUD de diretoria/eventos/parceiros, configurações e imagens.
5. Carregar apenas conteúdo publicado no site público; manter HTML/dados originais quando a API não estiver disponível.
6. Verificar caminhos, sintaxe, renderização e regras locais; separar os testes simulados dos testes de Auth, RLS e Storage que exigem configuração manual do Supabase.

Os campos de conteúdo, títulos, textos de botões, destinos, imagens e descrições acessíveis podem ser editáveis sem alterar a arquitetura. A estrutura HTML, classes de layout, código JavaScript, controles do calendário e regras de acesso devem permanecer fora da edição livre de administradores.

## Conferência de origem durante a implementação

O responsável pela integração comparou a cópia local com o repositório `vttxr/brasa-uh`, commit `6c2ab6ae4f9e1687b3eee02e478be8c0993d9141`. Os arquivos existentes correspondiam à origem; o favicon da raiz não estava nessa cópia local, que já tinha `assets/favicon.svg`. A implementação parte desses arquivos verificados, preservando a arquitetura e os assets descritos acima.
