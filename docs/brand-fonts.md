# Fontes e referências da identidade BRASA UH

## Lato: instalada localmente

`assets/fonts/brand-fonts.css` registra a família `Lato`, estilo normal, nos pesos
300 (Light), 400 (Regular), 700 (Bold) e 900 (Black), com `font-display: swap`.
Cada peso possui arquivos WOFF2 Latin e Latin Extended. A divisão por
`unicode-range` mantém o português e os demais caracteres latinos sem carregar
subconjuntos desnecessários. Não há dependência de Google Fonts em tempo de
execução: as URLs no CSS são relativas aos arquivos locais.

Fontes obtidas em 23/10/2026 da distribuição oficial Google Fonts:

- [CSS oficial dos quatro pesos](https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&display=swap), arquivos servidos por `fonts.gstatic.com/s/lato/v25/`.
- [Metadados da família](https://raw.githubusercontent.com/google/fonts/main/ofl/lato/METADATA.pb).
- [SIL Open Font License 1.1](https://raw.githubusercontent.com/google/fonts/main/ofl/lato/OFL.txt), distribuída integralmente em `assets/fonts/OFL.txt`.

Os arquivos de fonte não foram modificados nem convertidos. A licença e o
aviso de autoria devem acompanhar sua distribuição. Todos os recursos de
fontes devem continuar incluídos no build estático.

## Hagrid: pendente de arquivos licenciados

Não foram encontrados arquivos Hagrid no projeto, na árvore de projetos local,
em Downloads nem entre os arquivos de fonte do ZIP `brasa-uh.zip` disponível
localmente. Nenhum arquivo de procedência ou licença desconhecida foi usado.

O site usa Lato como fallback explícito nos títulos de impacto. Isso mantém a
leitura e a consistência enquanto Hagrid não estiver disponível, mas não
equivale à aplicação da fonte secundária oficial.

Para concluir essa parte da identidade, fornecer Hagrid Regular (400) e Hagrid
Extrabold (800), preferencialmente WOFF2, com licença que permita hospedagem
web. Depois, registrar `@font-face` para `Hagrid` neste CSS e usar a família
apenas nos títulos de impacto que não contenham a palavra BRASA. Não registrar
Lato com o nome Hagrid nem usar arquivos extraídos do PDF como fonte web.

## Regras conferidas no manual de 2025

Fonte: `Manual de ID Visual BRASA (1).pdf`, fornecido em Downloads. A numeração
abaixo corresponde às páginas do arquivo PDF, contando a capa como página 1.
O texto foi extraído e as páginas relevantes foram renderizadas para conferência.

| Páginas | Regra |
| --- | --- |
| 5 | Paleta principal: azul `#065FD8`, verde `#03571A`, amarelo `#FFCC02`. Verde claro `#009F00` reservado a degradês. |
| 6 | Gradientes exclusivamente em fundos; iconografia sobre eles deve seguir as combinações de cor permitidas. |
| 9-12 | Sobre cinza claro `#F4F4F4`, texto `#252726`; sobre verde escuro, azul escuro ou verde folha, texto `#F4F4F4`. |
| 14-15 | Lato Light, Regular, Bold e Black; Hagrid Regular e Extrabold. Hagrid exclusivamente em títulos; qualquer título com BRASA deve usar Lato. |
| 16-17 | Display em Hagrid Extrabold, 48-96px e maiúsculas; H1 Lato Bold 32-48px; H2 Lato Regular 24-32px; H3/labels/botões 16-20px; corpo 14-16px/1.5; legendas 12-13px/1.4. |
| 18-20 | Display apenas em frases curtas, fora de parágrafos, sem tamanho muito pequeno nem baixo contraste. |
| 24-25 | Versões auxiliar e monocromática branca nos fundos escuros especificados; respeitar as versões disponíveis, sem recolorir o asset. |
| 30 | Brasão isolado segue as regras de cor das versões oficiais; versão outline apenas quando o brasão estiver sozinho. |
| 31 | Preservar área de proteção e legibilidade; logo completa on-line tem referência mínima de 140px; em aplicações menores, usar o ícone oficial isolado. |
| 32-33 | Não alterar cores, perspectiva, proporções, nem aplicar sombras/efeitos. Fundos claros usam a versão original; escuros, a auxiliar; fotografias exigem contraste. |
| 34 | Nos logos paralelos, escrita em `#252726` sobre claro ou `#F4F4F4` sobre escuro; brasão nas cores oficiais ou totalmente branco. |
| 37-38 | Iconografia geométrica derivada do brasão e da bandeira: círculos, losangos, arcos, triângulos e contornos simples. |

O vermelho institucional UH `#C8102E` e a preservação do escudo do capítulo
seguem a instrução do projeto. Os valores internos dos logotipos não devem ser
substituídos pelos tokens das superfícies: o próprio manual distingue cores de
paleta e cores de logo.
## Enquadramento individual da diretoria

As fotos originais foram preservadas. O CSS usa círculos com proporção 1:1,
`object-fit: cover` e `object-position: center`. A revisão das fotos publicadas
identificou quatro arquivos cujo rosto está próximo do topo. Somente estes recebem
`object-position: center top`, para não cortar cabelo e reduzir a margem inferior:

- `ce919b58-9bf4-46d6-8d43-6ea3e2e40ef5.png`
- `dda3de93-53e6-4afc-beb4-2a8b86ca249a.png`
- `7ca25182-be65-4f57-8e8a-6a7caba18d27.png`
- `d76edcae-d18b-4052-87e8-3677ec024e2e.png`

As regras acompanham a imagem, não nomes ou cargos: uma nova foto volta ao centro
por padrão. Nenhum cadastro, arquivo ou resolução de imagem foi alterado.
