# 🌳 Life Echoes - Versão 1.1

Esta é uma experiência interativa low-poly sobre a sobrevivência e o impacto humano na Mata Atlântica.

## 🛠️ Como Rodar Localmente
Devido às restrições de segurança do navegador (CORS) para módulos JavaScript, o jogo **não abrirá** diretamente com dois cliques no `index.html`.

1. **Utilize o VS Code**: Clique com o botão direito no `index.html` e selecione **Open with Live Server**.
2. **Ou via Terminal**: Execute `npx serve .` na pasta do jogo.

## 🚀 Como fazer o Deploy no GitHub Pages
(O jogo funcionará perfeitamente e sem erros após o deploy para o GitHub Pages).

1. **Crie um Repositório no GitHub**: [github.com/new](https://github.com/new).
2. **Suba os arquivos**:
   ```bash
   git init
   git add .
   git commit -m "Lançamento v1.1"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/life-echoes.git
   git push -u origin main
   ```
3. **Ative o Pages**: Em Settings > Pages, selecione a branch `main`.

## 🐒 Controles
- **W, A, S, D** ou **Setas**: Movimentação.
- **Espaço**: Pular.
- **Mouse**: Rotacionar câmera.

---
*Desenvolvido em C:\Users\26012378\Desktop\Life Echoes\Life Echoes 1.1*

## 🛠️ Notas de Manutenção (Shader de Vento)
> [!NOTE]
> O efeito dinâmico de vento nas árvores e flores foi implementado através de um **Vertex Shader** customizado via `onBeforeCompile` dentro de `game.js`. Isso distorce ativamente a geometria da malha durante a renderização para economizar performance e dispensar animações internas no arquivo `.glb`.  
> *Atenção Futura*: Todos os numerais da onda do vento (força constante `0.008`, frequência multiaxial de `0.05` e offset basal de `2.0`) foram calibrados à mão para a topologia atual e distância de câmera atual. Se o `modelMenu.glb` for reescalado, ou trocado radicalmente em conversas futuras, tais variáveis matriciais em `game.js` devem ser lidas e possivelmente ajustadas novamente.

## 📜 Log de Modificações (Patches)

### [Patch 1.50.0] - Março de 2026
- **Créditos Finais Cinematográficos**: Implementada a sequência de encerramento completa com rolagem vertical automática.
- **Design de Fontes Requisitado**: Utilização de `IMFellEnglish` para títulos de seção e `PlayfairDisplay` para nomes, garantindo uma estética de filme clássico.
- **Loop de Rejogo**: Sistema de reinício automático implementado para recarregar a experiência após a conclusão dos créditos (45s de exibição).
- **Agradecimentos e Mentorias**: Listagem detalhada de toda a equipe, modelos 3D externos, trilha sonora de Pixabay e mentores acadêmicos.

### [Patch 1.49.0] - Março de 2026
- **Sequência de Finalização (Capítulo 1)**: Implementado o desfecho da jornada do mico-leão-dourado.
- **Objetivo Final (Fruta Dourada)**: Adicionada uma fruta low-poly brilhante e rotativa ao final do percurso (93%). A coleta marca o cumprimento do objetivo narrativo de sobrevivência.
- **Efeito de Exaustão e Desfecho**: Após a coleta, o personagem sofre uma redução progressiva de velocidade (slowdown), simulando a saciedade e o cansaço ao fim da trilha.
- **Fade Out Cinematográfico**: Ao atingir o limite do mapa (98%), a tela escurece totalmente através de um fade suave, acompanhado do encerramento da trilha sonora e da mensagem final de "Continua...".

- **Tela de Manifesto e Clímax**: Após o desfecho, surge uma tela preta de conscientização com frases de impacto sobre a preservação da Amazônia, integrando o logo da SOS Amazônia e um botão de doação funcional.
- **Chamada para Ação (CTA)**: Adicionado um convite direto à preservação ambiental, permitindo que o jogador contribua com causas reais antes de seguir para os créditos finais.

### [Patch 1.48.0] - Março de 2026
- **Sequência de Transição Narrativa**: Implementada tela de "Survival" entre o menu e o gameplay. O fluxo agora inclui:
  1. Fade out suave do menu principal para o preto absoluto.
  2. Surgimento da mensagem de sobrevivência sobre fundo preto, utilizando a tipografia PlayfairDisplay para um visual limão e profissional.
  3. Sincronização de Perspectiva: O reposicionamento da câmera e do mapa ocorre em "background" enquanto a tela está totalmente opaca, eliminando glitches visuais.
  4. Transição orquestrada de áudio: A trilha de gameplay surge enquanto o texto prepara o jogador para o início da jornada.
  5. Revelação final através de um fade-out suave da tela preta para o mundo 3D pronto para o jogo.

### [Patch 1.47.0] - Março de 2026
- **IA de Perseguição "Visível" (Rubber-Banding)**: Implementada lógica de proximidade visual constante. O caçador agora "se prende" à borda da câmera se o jogador correr muito rápido, garantindo que a ameaça seja sempre visível e mantendo a tensão da corrida.
- **Spawn Dinâmico**: Corrigido o bug onde o caçador surgia no início do mapa (progress 0); agora ele aparece estrategicamente logo atrás do mico-leão ao cruzar o gatilho de 30% do percurso.
- **Raycasting Independente**: O caçador agora processa sua própria detecção de solo em tempo real, eliminando erros de altura e garantindo que ele siga o relevo do terreno de forma independente do jogador.

### [Patch 1.46.0] - Março de 2026
- **Correção Crítica de Performance**: Corrigido o bug recursivo de `requestAnimationFrame` que multiplicava a carga de renderização a cada frame, causando lentidão extrema após alguns segundos de jogo.
- **Refatoração de Loop**: Consolidação da função `animate()` e `loop()` em um único ciclo de execução otimizado com guards de estado.
- **Limpeza de Código**: Removida lógica de controle de movimento e raycasting duplicada em `updatePlaying`, reduzindo processamento redundante e inconsistências na velocidade.

### [Patch 1.45.0] - Março de 2026
- **Upgrade para Versão 2.0**: O projeto foi oficialmente elevado para o status de Versão 2.0 com a estabilização do ciclo de gameplay completo (Início -> Perseguição -> Confronto -> Fim).
- **Bilboarding e Espessura de Sprite**: Implementação de "Papelão 3D" (dois planos paralelos) para o mico-leão, garantindo visual consistente de todos os ângulos da câmera 2.5D sem distorções de escala.

### [Patch 1.44.0] - Março de 2026
- **Sistema de Inimigo (Caçador)**: Implementação do antagonista dinâmico. O caçador surge aos 30% do caminho e persegue o jogador. Possui IA de perseguição linear e sistema de sprites com ChromaKey e contorno preto agressivo para destaque visual.
- **Minigame de Confronto (Quick Time Event)**: Ao atingir 85% do progresso, um minigame de precisão é ativado. O jogador deve pressionar [E] no momento exato (zona de sucesso no dial) para repelir o caçador. Três acertos nocauteiam o inimigo, permitindo seguir o caminho livremente.
- **Narrativa e Feedback UI**: Adicionada barra de narrativa superior para mensagens de contexto e tutorial com efeitos de fade.
- **Aperfeiçoamento de Debug**: Tecla de atalho de debug alterada para `Q` para facilitar o mapeamento rápido de coordenadas no HUD verde.
- **Física de Solo (Lowest-Y Raycasting)**: Refinamento final na detecção de solo para garantir que tanto o player quanto o caçador ignorem copas de árvores e fiquem sempre no nível real do terreno.

### [Patch 1.43.0] - Março de 2026
- **Sequência de Introdução Cinematográfica**: Implementada uma intro de "filme" antes do menu principal. 
  1. A experiência começa em tela preta total para imersão.
  2. Três telas de créditos surgem sequencialmente com fade in/out suave: Global Game Jam Next 2026, Apoio FECAP e Estúdio apresenta.
  3. Transição orquestrada: O fundo 3D da floresta surge lentamente através de um fade de 3 segundos, sincronizado com o surgimento gradual da música tema.
  4. O título e botões do menu são os últimos a aparecer, garantindo que o jogador aprecie o cenário antes de interagir.

### [Patch 1.42.0] - Março de 2026
- **Realce Visual do Protagonista**: Adicionado um contorno preto grosso ao redor de todos os frames do mico-leão-dourado. O motor agora processa cada sprite em tempo real, gerando um "stroke" de 5 pixels que ajuda na identificação do personagem contra o cenário 3D, conferindo uma estética de desenho animado/HQ.

### [Patch 1.41.0] - Março de 2026
- **Sistema de Animação de Alta Fidelidade (Individual Sprites)**: O sistema de sprites foi migrado de um único sheet para carregamento individual da pasta `sprites/character/`. 
  1. **Walking**: Implementado loop customizado de 6 frames (`1-2-3-4-3-2`) para uma fluidez orgânica. 
  2. **Jump Dinâmico**: O sprite agora reage à física; exibe `spriteJump1` na subida/descida e `spriteJump2` cravado no ápice do salto (gravidade zero). 
  3. **ChromaKey em Tempo Real**: Aplicado filtro de remoção de fundo cinza nativo em cada frame carregado, garantindo transparência perfeita no mundo 3D.

### [Patch 1.40.0] - Março de 2026
- **Realinhamento de Sprites (Mico-Leão-Dourado)**: As coordenadas de corte do sprite sheet `spritesCharacter.png` foram recalibradas com precisão cirúrgica para extrair apenas o conteúdo interno dos retângulos tracejados. Isso remove artefatos visuais das bordas e garante que as animações de *Walking*, *Jump* e *Idle* utilizem o design oficial pretendido, mantendo a proporção correta e o alinhamento centralizado do personagem.

### [Patch 1.39.0] - Março de 2026
- **Calibração Relativa de Áudio**: Tendo em vista que a maioria dos usuários joga com o volume geral do sistema operacional/headset muito alto (ex: 80%), as alocações padrão do jogo foram diminuídas severamente para evitar estourar o áudio e assustar o jogador em novos acessos. A nova métrica inicial é: Música em `25%` e Sound Effects em `35%`.

### [Patch 1.38.0] - Março de 2026
- **Afinação de Áudio**: Redefinidos os valores iniciais (Default) dos volumes do jogo na UI e no sistema interno. A Música de fundo começa suave a `40%` para não encobrir as ações do jogador, enquanto os Efeitos Sonoros (SFX) como hover em botões e passos agora iniciam padronizados a `50%`, garantindo um balanceamento natural de primeira viagem.

### [Patch 1.37.0] - Março de 2026
- **Correção Crítica de Raycasting (Anti-Subida em Árvores)**: Solucionado o bug em que o personagem subia em árvores, arbustos e pedras ao invés de permanecer no chão. O `THREE.Raycaster` disparado de cima para baixo retornava como "chão" o primeiro objeto interceptado — que muitas vezes era o topo da copa das árvores. A lógica foi alterada para percorrer **todas as intersecções** e selecionar aquela com o **menor valor de Y** (ponto mais baixo), que corresponde ao solo real do terreno.

### [Patch 1.36.0] - Março de 2026
- **Recalibração de Caminho (2ª análise do vídeo)**: Os pontos da `CatmullRomCurve3` foram completamente reescritos com base em uma segunda análise frame-a-frame do arquivo `assets/caminho.mp4`. O eixo Z foi corrigido (valores positivos ao sul, negativos ao norte). O caminho agora possui 24 waypoints extraídos diretamente do HUD de coordenadas, seguindo estritamente as estradas de terra.

### [Patch 1.35.0] - Março de 2026
- **Sistema Debug (Ctrl+Shift+E)**: Implementado modo de exploração livre com câmera aérea ativável durante o jogo com o atalho `Ctrl+Shift+E`. No modo debug, o personagem pode voar pelo mapa com W/A/S/D (com colisão de chão via Raycaster). Um painel HUD verde no canto superior direito exibe as coordenadas `X` e `Z` em tempo real, permitindo o mapeamento preciso das estradas de terra para calibração da trilha.

### [Patch 1.34.0] - Março de 2026
- **Implementação do Sistema 2.5D (Spline + Câmera de Trilho)**: O jogo agora usa um sistema de câmera 2.5D tipo "Crash Bandicoot / Donkey Kong Country". O personagem avança/retrocede ao longo de uma curva `CatmullRomCurve3`. A câmera fica posicionada perpendicularmente à tangente da curva e gira suavemente conforme o caminho faz curvas. A altura do personagem é calculada em tempo real por Raycasting (`Y = 200` direto para baixo), garantindo que ele siga o relevo do terreno.

### [Patch 1.33.0] - Março de 2026
- **Mapa Jogável (Câmera Ortográfica → Perspectiva)**: A câmera de gameplay foi alterada de `OrthographicCamera` para `PerspectiveCamera` (FOV 35°) para melhor percepção de profundidade no mapa 3D. O `modelMap.glb` foi integrado como cenário de gameplay (além do menu). Os controles foram desconectados dos eixos livres e vinculados ao progresso `u ∈ [0,1]` na curva.

### [Patch 1.32.0] - Março de 2026
- **Layout Shift Prevention (Anti-Teleporte de Textos)**: Corrigido o famoso problema de "Flash of Unstyled Text" (FOUT). Durante o milissegundo de carregamento da fonte customizada (`Almendra`), o navegador renderizava o título com uma fonte padrão de dimensões menores, e, ao concluir o download, atualizava para o tamanho real. Como o contêiner era centrado verticalmente (`align-items: center`), esse recálculo de altura das letras forçava toda a caixa a pular de cima para baixo de uma vez só. Adicionado `font-display: block;` nos `@font-face` do CSS, bloqueando qualquer renderização da aba do menu até que o modelo matemátio da fonte original esteja 100% lido, garantindo que o texto já nasça instantaneamente no "lugar esperado ao mesmo tempo".

### [Patch 1.31.0] - Março de 2026
- **Estabilidade de Interface**: Solucionado o "bug do salto" que retornou após a implementação das barras de carregamento em `game.js`. Havia um problema na classe `.hidden` do CSS (`style.css`), que usava a propriedade `display: none`. Mudar de display removia os elementos sumariamente do fluxo da página, colapsando as "costas" do contêiner flexível e puxando todos os botões para cima num tranco abrupto. Substituí por propriedades de invisibilidade suave (`opacity: 0` e `visibility: hidden`), preservando a gaveta virtual de espaço do elemento para que as caixas da UI nunca precisem se reajustar bruscamente.

### [Patch 1.30.0] - Março de 2026
- **Realinhamento de Iluminação Solar**: Corrigido o enquadramento "silhueta" escuro da floresta. O eixo Z da luz do sol (`DirectionalLight`) foi invertido de `Z: 30` (cujas castigadas pelas costas deixavam a frente da floresta onde a câmera fica na escuridão pura) para `Z: -30` (A luz agora fica atrás e acima da câmera iterando diretamente nas frentes e folhas das árvores visíveis). Exposição da lente (`toneMappingExposure`) também aumentada de `1.15` para `1.6`.

### [Patch 1.29.0] - Março de 2026
- **Iluminação HDR Cinematográfica**: Para resolver o problema de luminosidade sem "lavar" as sombras com luz ambiente artificial pura (branca crua), foram implementadas três grandes mudanças em `game.js`:
  1. Utilização de **HemisphereLight** (luz de duas cores, simulando a abóbada celeste batendo em cima das folhas em contrapartida ao reflexo sombrio da terra batendo por baixo). 
  2. A luz principal (Sol) teve a sua intensidade brutalmente escalonada para `2.5`, fortalecendo os raios diretos para "chapar" claridade em locais diretos e gerando sombras duras e contrastantes.
  3. Para impedir que a tela virasse um borrão brilhoso, ativamos o **ACESFilmicToneMapping** direto no WebGLRenderer, um standard de colorimetria de cinema que lida com excessos de brilho, mantendo o nível global da exposição e trazendo cores vibrantes e ricas nas transições para o escuro.

### [Patch 1.28.0] - Março de 2026
- **Sincronicidade de Vento (Anti-Tearing)**: Solucionado o "derretimento/mescla" das flores durante o Shader de Vento. A frequência da onda do vento relativa à variação espacial dos vértices (`position.x` e `position.z`) foi drasticamente reduzida (de fator `1.5` para `0.05`). Com isso, a onda de flexão se torna gigantesca, fazendo com que todos os vértices da mesma flor ou arbusto sejam empurrados uniformemente, em vez de torcidos independentemente, mantendo a geometria intacta.

### [Patch 1.27.0] - Março de 2026
- **Sintonia do Vento**: Modificada a fórmula do Vertex Shader do Efeito de Vento de `max(0.0, position.y - 0.1)` (que ancorava rigidamente os componentes baixos) para `position.y + 2.0`. Isso aplica um *offset* universal de fluidez, forçando toda a vegetação na camada Y=0 a participar do balanço, injetando movimento em todo o terreno sem quebrar os limites.

### [Patch 1.26.0] - Março de 2026
- **Tecnologia de Vento (Shader Customizado)**: Implementado um efeito de "vento orgânico" que nada tem a ver com animações embutidas no modelo original. Através de uma injeção customizada no *Vertex Shader* do WebGL (via método `onBeforeCompile` do material), os vértices (arestas) das copas das árvores, montanhas e flores agora ondulam ritmicamente com base na passagem do tempo (sine waves assimétricas). A fórmula leva a altura (`position.y`) em conta para que a raiz e a base do cenário permaneçam ancoradas perfeitamente no chão.

### [Patch 1.25.0] - Março de 2026
- **Merguho Final ao Nível Zero**: A câmera foi reposicionada verticalmente para exatamente zero (`y: 0`), encostando na linha de base geométrica do modelo, enquanto mantém o recuo atual (`z: -1.3`) e o ponto focal mais alto (`lookAt Y: 0.4`), intensificando muito o ângulo de visão contra-plongée em direção à floresta.

### [Patch 1.24.0] - Março de 2026
- **Merguho de Câmera**: Redução da altura da câmera (`y: 0.2`) mantendo o ponto de foco mais alto (`lookAt Y: 0.4`), gerando o efeito clássico de contra-plongée (câmera baixa olhando levemente para cima). Isso confere um tom épico à vegetação do cenário.

### [Patch 1.23.0] - Março de 2026
- **Alinhamento Térreo**: Câmera abaixada para `y: 0.4` e avançada para `z: -1.3`, com foco nivelado perfeitamente paralelo ao solo (`lookAt Y: 0.4`). Essa aproximação remove distrações e foca apenas no relevo e textura do cenário à frente.

### [Patch 1.22.0] - Março de 2026
- **Ajuste de Terra (`lookAt Y: 0.2`)**: A câmera agora possui uma leve inclinação para baixo, valorizando a renderização do solo gramado e diminuindo a ênfase no céu e no horizonte profundo.

### [Patch 1.21.0] - Março de 2026
- **Aperfeiçoamento Final**: Câmera ajustada para `z: -1.5` (a mais próxima até agora nesta configuração), e o `lookAt` foi elevado para `y: 1.0`, gerando uma leve inclinação para cima. Esse ângulo "olhando das sombras" acentua a grandeza das árvores, que preenchem uma fatia maior do céu azul do menu.

### [Patch 1.20.0] - Março de 2026
- **Lapidação de Foco (`z: -1.8`)**: Mais um micro-avanço de proximidade no eixo Z. A câmera aproxima-se ativamente da folhagem na margem do modelo, mantendo a altura base `y: 0.6` para tentar extrair o melhor enquadramento 3D possível.

### [Patch 1.19.0] - Março de 2026
- **Ajuste Fino de Preenchimento**: Câmera ajustada em microlimites para baixo (`y: 0.6`) e mais perto do modelo (`z: -2.2`) visando ampliar a projeção da floresta na tela e minimizar o espaço vazio nas bordas inferiores.

### [Patch 1.18.0] - Março de 2026
- **Aproximação Final de Perspectiva**: Avançada a câmera para `z: -2.5` mantendo a altura `y: 0.8`, cortando o foco excedente nos cantos e trazendo a flora e as estruturas do modelo 3D para o primeiro plano.

### [Patch 1.17.0] - Março de 2026
- **Meio-Termo de Perspectiva**: Aplicada as coordenadas `y: 0.8` e `z: -3.0` como uma tentativa de alcançar um meio-termo entre a visão térrea e a panorâmica, buscando o enquadramento ideal para o relevo do terreno central.

### [Patch 1.16.0] - Março de 2026
- **Redefinição Panorâmica**: A câmera foi reposicionada para as coordenadas solicitadas (`y: 1.2`, `z: -3.5`), proporcionando uma visão mais elevada e distante do modelo. Além disso, o foco da câmera (`lookAt`) foi completamente zerado (`0, 0, 0`), ancorando a perspectiva perfeitamente no centro (origem) da cena sem qualquer desvio vertical ou lateral.

### [Patch 1.15.0] - Março de 2026
- **Nivelamento de Câmera**: Removida a inclinação "para cima" da câmera do menu (`lookAt` `Y` alterado de `1.5` para `-0.5`, igualando a altura da câmera). A visão agora segue reta em direção ao modelo de terreno, no que seria um "ponto de fuga" perfeitamente alinhado.

### [Patch 1.14.0] - Março de 2026
- **Exploração de Câmera**: Ajustadas as coordenadas para `z: -3.0` (maior recuo) e `y: -0.5` (abaixo do solo) como requisitado no teste iterativo para aumentar a parcela da tela coberta pelas árvores no horizonte.

### [Patch 1.13.0] - Março de 2026
- **Ajuste Fino ("Visão Abaixo do Solo")**: Câmera do menu reposicionada para as coordenadas precisas solicitadas (`z: -2.0`, `y: -0.2`) para testar uma angulação ainda mais baixa e próxima, forçando o modelo a ocupar mais espaço vertical na tela e destacando as copas das árvores no céu.

### [Patch 1.12.0] - Março de 2026
- **Ajuste Fino ("Visão de Trilha")**: A câmera foi rebaixada ao limite do terreno (`y: 0.15`) e recuada de volta em relação ao centro (`z: -2.8`), olhando para cima em direção à copa das árvores. Isso maximiza a sensação de profundidade, deixando a silhueta da floresta contra o céu azul igual à da imagem de referência estática.

### [Patch 1.11.0] - Março de 2026
- **Câmera "Inside the Forest"**: Redução dramática na altura e distância da câmera do menu (`y: 0.4`, `z: -1.2`) e ajuste de ângulo (`lookAt` apontando para cima). O objetivo é replicar a sensação da imagem `fundo.png`, onde o jogador se sente "dentro" da vegetação, com flores no primeiro plano e árvores preenchendo o fundo.

### [Patch 1.10.0] - Março de 2026
- **Inversão de Câmera 3D**: Câmera do menu rotacionada em 180º (posição `z` negativa) para exibir a face oposta do modelo 3D.
- **Micro-Ajuste de Distância**: Zoom significativamente aumentado e campo de visão rebaixado para capturar melhor os detalhes do terreno e preencher o fundo.

### [Patch 1.9.0] - Março de 2026
- **Ajuste de Câmera 3D**: Câmera do menu reposicionada drasticamente (`y: 1.5`, `z: 4`) para dar uma visão térrea e imersiva do modelo, ocupando mais espaço visual na tela.
- **Foco Fixo**: Removida a rotação automática do modelo 3D no menu principal para manter o foco constante no enquadramento.

### [Patch 1.8.1] - Março de 2026
- **Resiliência de Sistema (CORS)**: Implementado um fallback no `game.js`. Caso navegadores bloqueiem o carregamento dos arquivos `.glb` localmente via protocolo `file:///`, a imagem estática `fundo.png` é ativada automaticamente, evitando telas pretas/azuis.
- **Ferramenta de Servidor**: Adicionado script utilitário `iniciar_jogo.py` para permitir que usuários Windows iniciem rapidamente um servidor local e contornem bloqueios de CORS com dois cliques.

### [Patch 1.8.0] - Março de 2026
- **Refinamento de Entrada**: Removida a animação de deslocamento vertical (que causava um "salto") ao carregar o menu.
- **Fade Unificado**: Implementada transição suave de opacidade (`fade-in`) durando 2 segundos para o fundo e o conteúdo do menu.
- **Sincronização Visual**: Sincronizado o aparecimento dos textos com o carregamento da imagem de fundo para uma experiência mais limpa e profissional.

### [Patch 1.7.0] - Março de 2026
- **Refinamento de Proporções**: Janela de opções ajustada para um formato mais esguio (`650px`), melhorando a estética geral.
- **Scrollbar Personalizada**: Implementada barra de rolagem estilizada em amarelo arredondado, integrada ao design da janela para substituir o padrão do navegador.
- **Melhoria de Padding**: Ajustado o espaçamento interno para evitar sobreposição da barra de rolagem com os elementos da interface.

### [Patch 1.6.0] - Março de 2026
- **Centralização do Menu "Options"**: Corrigido o posicionamento da janela para garantir que ela esteja sempre centralizada vertical e horizontalmente em qualquer resolução.
- **Responsividade**: Ajustada a largura máxima e adicionado suporte para rolagem interna em telas menores, evitando que o menu fique cortado ou esticado.
- **Aprimoramento Visual**: Aumentada a espessura da borda e o desfoque de fundo para maior clareza visual.

### [Patch 1.5.0] - Março de 2026
- **Reformulação da Janela "Options"**: 
    - Novo layout em duas colunas para facilitar a visualização de comandos.
    - Implementação de sliders de volume interativos (barra com círculo) com feedback de porcentagem em tempo real.
    - Adicionada funcionalidade de "Rebind" (teste visual); ao clicar em uma tecla, o jogo aguarda uma nova entrada do teclado.
- **Melhoria Estética**: Janela de opções agora conta com animação de "slide-up" e acabamento refinado com bordas douradas e sombras profundas.
- **Interatividade Total**: Sliders e botões agora respondem visualmente e logicamente às ações do usuário.

### [Patch 1.4.0] - Março de 2026
- **Recuperação de Bibliotecas**: Re-inseridas as bibliotecas `Three.js` e `GLTFLoader` que haviam sido removidas acidentalmente, corrigindo o erro `THREE is not defined`.
- **Limpeza de Estrutura**: Corrigidas duplicatas de tags `<body>` e `<script>` no final do `index.html`.

### [Patch 1.3.0] - Março de 2026
- **Correção Visual**: Adicionado `assets/fundo.png` como imagem estática de fundo para garantir compatibilidade caso os modelos 3D falhem ao carregar localmente.
- **Estabilidade**: Implementado tratamento de erros no carregamento de assets para evitar que o jogo trave em telas pretas ou em estado de "Loading" infinito.
- **Funcionamento dos Botões**: Corrigido bug na lógica de estados que impedia a interação com os botões "Start", "Options" e "Quit" quando os modelos 3D demoravam ou falhavam.
- **Limpeza de Código**: Removidos atributos redundantes que causavam erros de execução no console.

### [Patch 1.2.0] - Março de 2026
- **Novo Menu Principal**: Implementação de interface 3D integrada com o modelo `modelMenu.glb`.
- **Tipografia Personalizada**: 
    - `Almendra-Bold` para o título "LIFE ECHOES".
    - `IMFellEnglish` para botões e funções.
    - `PlayfairDisplaySC` para textos auxiliares e números nas opções.
- **Interatividade**: Adicionado efeito de "hover" (escala dinâmica) nos botões do menu.
- **Sistema de Opções**: Criação de janela modal para ajuste de volumes e visualização de comandos.
- **Função Quit**: Implementação de efeito "fade-to-black" para encerramento da sessão.
- **Otimização de Carregamento**: Barra de progresso integrada para os modelos 3D do mapa e menu.

### [Patch 1.1.0] - Março de 2026
- **Início do Acompanhamento**: Implementação do sistema de logs no README.md para documentar a evolução do projeto.
- **Integração Assistente**: Configuração do ambiente para desenvolvimento assistido por Antigravity (Google DeepMind).


