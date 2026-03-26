// Life Echoes v2.0 — 2.5D Side-Scrolling Platformer
// Câmera ortográfica lateral, cutscene de intro, Fase 1: coleta de frutas

(function () {
    'use strict';

    // ─── CONSTANTS ─────────────────────────────────────────────────────────────
    const GRAVITY = -0.022;
    const JUMP_FORCE = 0.5;
    const MOVE_SPEED = 0.18; // Reduzida ainda mais para controle
    const FRUITS_NEEDED = 8;
    const HUNTER_CHASE_START = 0.3; 
    const MINIGAME_START_POS = 0.85; 
    const PLAYER_W = 1.0;
    const PLAYER_H = 1.4;

    // Sprite sheet: spritesCharacter.png (1456×770 px)
    // Coordenadas originais exatas para focar apenas nos macacos (ignorando texto à esquerda)
    const SPRITE_FRAMES = {
        walking: [
            [398, 237, 137, 148], [546, 237, 137, 148], [696, 237, 137, 148], [844, 237, 137, 148]
        ],
        jump: [
            [394, 452, 146, 148], [546, 452, 146, 148]
        ],
        idle: [
            [396, 658, 114, 150]
        ],
    };
    const SPRITE_FPS = 8;

    // ─── HELPERS ───────────────────────────────────────────────────────────────
    function makeColor(hex) { return new THREE.Color(hex); }

    function showNarrative(text, duration = 4000) {
        return new Promise(resolve => {
            const bar = document.getElementById('narrative-bar');
            const txt = document.getElementById('narrative-text');
            txt.textContent = text;
            bar.style.opacity = '1';
            setTimeout(() => {
                bar.style.opacity = '0';
                setTimeout(resolve, 900);
            }, duration);
        });
    }

    function hideSplash() {
        return new Promise(resolve => {
            const splash = document.getElementById('splash-screen');
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.classList.add('hidden');
                resolve();
            }, 1300);
        });
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // ─── PLATFORM AABB COLLISION ────────────────────────────────────────────────
    function aabbOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    // ─── HUNTER CLASS ────────────────────────────────────────────────────────────
    class Hunter {
        constructor(scene, pathCurve) {
            this.scene = scene;
            this.pathCurve = pathCurve;
            this.group = new THREE.Group();
            this.scene.add(this.group);
            
            this.progress = 0;
            this.state = 'idle'; // idle | walking | chasing | minigame | fainted
            this.facingRight = true;
            this.groundY = 0;

            this.spriteTextures = { walking: [], idle: [], jump: [], faint: [] };
            this.spriteFrame = 0;
            this.spriteTimer = 0;
            this.loadAssets();
        }

        async loadAssets() {
            const loader = new THREE.TextureLoader();
            const process = (path) => new Promise(res => {
                loader.load(path, tex => {
                    const padding = 15;
                    const cv = document.createElement('canvas');
                    cv.width = tex.image.width + padding*2; cv.height = tex.image.height + padding*2;
                    const ctx = cv.getContext('2d');
                    ctx.drawImage(tex.image, padding, padding);
                    
                    // Chromakey Agressivo: Alvo é o fundo azulado/acinzentado dos sprites do Hunter
                    const id = ctx.getImageData(0,0,cv.width,cv.height), d = id.data;
                    for(let i=0; i<d.length; i+=4) {
                        const r=d[i], g=d[i+1], b=d[i+2];
                        
                        // Detecta o fundo azul claro/acinzentado (o retângulo em volta do caçador)
                        // Cores típicas: r: 170-210, g: 190-230, b: 200-250 (ou azul ciano r:80... g:180... b:230...)
                        const isBlueish = (b > r && b > g && b > 100);
                        const isGreyish = (Math.abs(r-g)<25 && Math.abs(g-b)<25 && r > 150);
                        const isWhiteish = (r > 220 && g > 220 && b > 220);

                        if (isBlueish || isGreyish || isWhiteish) {
                            d[i+3] = 0;
                        }
                    }
                    ctx.putImageData(id,0,0);

                    // Contorno Preto Fino e Limpo
                    const sprClean = document.createElement('canvas');
                    sprClean.width = cv.width; sprClean.height = cv.height;
                    sprClean.getContext('2d').putImageData(id, 0, 0);
                    
                    ctx.clearRect(0,0,cv.width,cv.height);
                    const thickness = 4;
                    ctx.globalCompositeOperation = 'source-over';
                    // Desenha o contorno apenas onde existe opacidade na imagem original
                    for(let x = -thickness; x <= thickness; x++) {
                        for(let y = -thickness; y <= thickness; y++) {
                            if (x*x + y*y > thickness*thickness) continue;
                            ctx.drawImage(sprClean, x, y);
                        }
                    }
                    ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = 'black'; ctx.fillRect(0,0,cv.width,cv.height);
                    ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(sprClean, 0,0);

                    const cleanTex = new THREE.CanvasTexture(cv);
                    cleanTex.magFilter = cleanTex.minFilter = THREE.LinearFilter;
                    res(cleanTex);
                });
            });

            const walks = ['sprites/hunter/spriteWalking1.png', 'sprites/hunter/spriteWalking2.png', 'sprites/hunter/spriteWalking3.png'];
            const results = await Promise.all([
                ...walks.map(p => process(p)),
                process('sprites/hunter/spriteIdle.png'),
                process('sprites/hunter/spriteJump.png'),
                process('sprites/hunter/spriteFaint.png')
            ]);

            this.spriteTextures.walking = results.slice(0, 3);
            this.spriteTextures.idle = [results[3]];
            this.spriteTextures.jump = [results[4]];
            this.spriteTextures.fainted = [results[5]];

            const geo = new THREE.PlaneGeometry(3.8, 3.8);
            this.mat = new THREE.MeshBasicMaterial({ map: results[3], transparent: true, alphaTest: 0.1 });
            this.mesh = new THREE.Mesh(geo, this.mat);
            this.mesh.position.y = 1.9;
            this.group.add(this.mesh);
            this.group.renderOrder = 998;
        }

        update(playerProgress, delta, camera) {
            if (!this.mesh) return;

            // Se o player ainda não chegou nos 30%, o hunter fica "escondido" no início do caminho
            if (playerProgress < HUNTER_CHASE_START && this.state !== 'fainted') {
                this.group.visible = false;
                this.progress = 0;
                return;
            }
            this.group.visible = true;

            if (this.state !== 'fainted') {
                if (playerProgress >= HUNTER_CHASE_START && playerProgress < MINIGAME_START_POS) {
                    this.state = 'walking';
                    // Caçador tenta alcançar o player com uma velocidade constante levemente menor que a do player em linha reta,
                    // mas ele não para se o player parar.
                    const hunterSpeed = 0.02 * delta; 
                    this.progress += hunterSpeed;
                } else if (playerProgress >= MINIGAME_START_POS) {
                    this.state = 'minigame';
                    // No minigame ele se aproxima. A velocidade será controlada pelo Game (minigameHunterSpeed)
                } else {
                    this.state = 'idle';
                }
            }

            // Garante que o hunter não ultrapasse o fim do caminho antes do mico
            this.progress = Math.min(this.progress, playerProgress + 0.01);

            const pos = this.pathCurve.getPointAt(this.progress);
            this.group.position.set(pos.x, this.groundY, pos.z);

            this.spriteTimer += delta;
            if (this.spriteTimer > 1/8) {
                this.spriteTimer = 0;
                const isWalking = (this.state === 'minigame' || this.state === 'walking');
                const animKey = isWalking ? 'walking' : this.state;
                const frames = this.spriteTextures[animKey] || this.spriteTextures.idle;
                if (frames.length > 0) {
                    this.spriteFrame = (this.spriteFrame + 1) % frames.length;
                    this.mat.map = frames[this.spriteFrame];
                    this.mat.needsUpdate = true;
                }
            }

            if (camera) {
                this.mesh.quaternion.copy(camera.quaternion);
                const e = new THREE.Euler().setFromQuaternion(this.mesh.quaternion, 'YXZ');
                e.x = 0; e.z = 0;
                this.mesh.quaternion.setFromEuler(e);
            }
            this.mesh.scale.x = (playerProgress >= this.progress) ? 1 : -1;
        }
    }

    // ─── GAME CLASS ────────────────────────────────────────────────────────────
    class Game {
        constructor() {
            // Singleton Guard: Se já houver uma instância rodando, paramos o loop dela
            if (window._activeGame) {
                window._activeGame.state = 'STOPPED';
                if (window._activeGame.renderer) {
                    window._activeGame.renderer.dispose();
                }
            }
            window._activeGame = this;

            this.canvas = document.getElementById('game-canvas');
            this.clock = new THREE.Clock();
            this.state = 'LOADING'; 

            // Minigame State
            this.minigameActive = false;
            this.minigameHits = 0;
            this.minigameAngle = 0;
            this.minigameSpeed = 4;
            this.minigameHunterSpeed = 0.005; 
            this.successZone = { start: 0, end: 60 };
            this.hunterDefeated = false;

            this.mapMesh = null;
            this.menuMesh = null;
            this.assetsLoaded = 0;
            this.totalAssets = 2; 

            this.raycaster = new THREE.Raycaster();
            this.keys = {};
            this.timeUniform = { value: 0 }; 

            this.init();
        }

        init() {
            this.debugMode = false;

            // Scenes
            this.scene = new THREE.Scene();
            this.menuScene = new THREE.Scene();
            this.scene.background = makeColor(0x87ceeb);
            this.menuScene.background = makeColor(0x5caede);

            // Gerenciamento de Renderer (Anti-Memory Leak)
            this.renderer = new THREE.WebGLRenderer({ 
                canvas: this.canvas, 
                antialias: true,
                powerPreference: "high-performance",
                precision: "mediump",
                stencil: false, // Otimização para economizar memória
                depth: true
            });
            
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Limite de 1.5 para salvar GPU
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.6;

            this.updateCameraProjection();
            this.addLights(this.scene);
            this.addLights(this.menuScene);
            this.loadAssets();
            this.buildPlayer();
            this.setupAudio();
            this.setupUIEvents();

            document.documentElement.style.cursor = 'default';
            document.body.style.cursor = 'default';

            // AUTO-START Intro
            document.getElementById('intro-ggj').classList.add('active'); 
            this.runIntro();

            // Áudio Unlock
            const unlockAudio = () => {
                if (this.state === 'MENU' && !this._menuMusicStarted) {
                    this._menuMusicStarted = true;
                    this.audioMenu.play().then(() => this._fadeAudioIn(this.audioMenu, 4000)).catch(() => {});
                }
                document.removeEventListener('mousedown', unlockAudio);
            };
            document.addEventListener('mousedown', unlockAudio);

            // Input Global
            window.onkeydown = (e) => {
                this.keys[e.code] = true;
                if (e.code === 'KeyQ') {
                    this.debugMode = !this.debugMode;
                    const hud = document.getElementById('coord-hud');
                    if (hud) hud.style.display = this.debugMode ? 'block' : 'none';
                    if (this.pathMesh) this.pathMesh.visible = this.debugMode;
                }
            };
            window.onkeyup = (e) => this.keys[e.code] = false;

            this.animate();
        }

        animate() {
            if (this.state === 'STOPPED') return;
            requestAnimationFrame(() => this.animate());
            this.loop();
        }

        addLights(targetScene) {
            const hemiLight = new THREE.HemisphereLight(0xffffff, 0x666666, 1.5);
            targetScene.add(hemiLight);
            const sun = new THREE.DirectionalLight(0xfffccf, 2.0);
            sun.position.set(20, 40, -30);
            sun.castShadow = true;
            sun.shadow.normalBias = 0.05;
            targetScene.add(sun);
        }

        // ─── AUDIO ─────────────────────────────────────────────────────────────────
        setupAudio() {
            this.musicVolume = 0.25;
            this.sfxVolume   = 0.35;

            this._walkPlaying = false;
            this._menuMusicStarted = false;

            this.audioMenu     = new Audio('music/musicMenu.mp3');
            this.audioMenu.loop = true;
            this.audioMenu.volume = 0;

            this.audioGameplay     = new Audio('music/musicGameplay.mp3');
            this.audioGameplay.loop = true;
            this.audioGameplay.volume = 0;

            this.sfxHover = new Audio('sfx/sfxHover.mp3');
            this.sfxHover.volume = this.sfxVolume;

            this.sfxWalk = new Audio('sfx/sfxWalk.mp3');
            this.sfxWalk.loop = true;
            this.sfxWalk.volume = this.sfxVolume;
        }

        async runIntro() {
            const delay = 3500; // Tempo de cada frase
            const steps = ['intro-ggj', 'intro-fecap', 'intro-studio'];
            
            for (let i = 0; i < steps.length; i++) {
                await sleep(delay);
                document.getElementById(steps[i]).classList.remove('active');
                await sleep(1500); // Intervalo de tela preta entre frases
                if (i < steps.length - 1) {
                    document.getElementById(steps[i+1]).classList.add('active');
                }
            }

            // Fim da intro preta
            const introSequence = document.getElementById('intro-sequence');
            introSequence.style.transition = 'opacity 3s ease-in-out';
            introSequence.style.opacity = '0';
            
            // O áudio agora é disparado pelo listener de 'mousedown' no init(),
            // garantindo que toque assim que o usuário interagir.

            await sleep(3000);
            
            // Aparece o Menu (Título e Botões)
            const splash = document.getElementById('splash-screen');
            splash.style.display = 'flex'; // Torna visível para o layout
            
            // Pequeno delay para forçar o browser a registrar o 'display: flex' antes da opacidade
            await sleep(50);
            splash.classList.remove('pre-start');

            // Remove a intro do fluxo para não bloquear cliques nos botões
            introSequence.classList.add('hidden');
            document.body.style.cursor = 'default';
        }

        _fadeAudioIn(audio, duration) {
            if (!audio) return;
            const target = audio === this.audioMenu || audio === this.audioGameplay ? this.musicVolume : this.sfxVolume;
            audio.volume = 0;
            const steps = 40, stepTime = duration / steps;
            let step = 0;
            const id = setInterval(() => {
                audio.volume = Math.min((++step / steps) * target, target);
                if (step >= steps || audio.volume >= target) clearInterval(id);
            }, stepTime);
        }

        _fadeAudioOut(audio, duration, cb) {
            if (!audio) { if(cb) cb(); return; }
            const start = audio.volume, steps = 40, stepTime = duration / steps;
            let step = 0;
            const id = setInterval(() => {
                audio.volume = Math.max(start * (1 - (++step / steps)), 0);
                if (step >= steps || audio.volume <= 0) { 
                    clearInterval(id); 
                    audio.pause(); 
                    audio.currentTime = 0; 
                    if (cb) cb(); 
                }
            }, stepTime);
        }

        playSFXHover() {
            try { 
                // Clona o nó para que múltiplos hovers possam tocar simultaneamente sobrepondo sem engasgos
                let snd = this.sfxHover.cloneNode();
                snd.volume = this.sfxVolume;
                snd.play().catch(() => {}); 
            } catch(e) {}
        }

        setWalkSound(active) {
            if (active && !this._walkPlaying) {
                this._walkPlaying = true;
                this.sfxWalk.volume = this.sfxVolume;
                this.sfxWalk.play().catch(() => {});
            } else if (!active && this._walkPlaying) {
                this._walkPlaying = false;
                this.sfxWalk.pause();
                this.sfxWalk.currentTime = 0;
            }
        }

        setupUIEvents() {
            // Hover SFX em todos os botões
            const addHover = (sel) => document.querySelectorAll(sel).forEach(el => el.addEventListener('mouseenter', () => this.playSFXHover()));
            addHover('button, .menu-btn, .rebind-btn, #start-btn, #options-btn, #quit-btn, #back-to-menu');

            document.getElementById('start-btn').addEventListener('click', () => {
                if (this.state === 'MENU') this.runCutscene();
            });

            const optionsMenu = document.getElementById('options-menu');
            document.getElementById('options-btn').addEventListener('click', () => optionsMenu.classList.add('active'));
            document.getElementById('back-to-menu').addEventListener('click', () => optionsMenu.classList.remove('active'));

            const musicSlider = document.getElementById('music-slider');
            const sfxSlider   = document.getElementById('sfx-slider');
            const musicPct    = document.getElementById('music-vol-percent');
            const sfxPct      = document.getElementById('sfx-vol-percent');

            musicSlider.addEventListener('input', (e) => {
                this.musicVolume = e.target.value / 100;
                musicPct.innerText = `${e.target.value}%`;
                if (this.audioMenu     && !this.audioMenu.paused)     this.audioMenu.volume     = this.musicVolume;
                if (this.audioGameplay && !this.audioGameplay.paused) this.audioGameplay.volume = this.musicVolume;
            });
            sfxSlider.addEventListener('input', (e) => {
                this.sfxVolume = e.target.value / 100;
                sfxPct.innerText = `${e.target.value}%`;
                if (this.sfxHover) this.sfxHover.volume = this.sfxVolume;
                if (this.sfxWalk)  this.sfxWalk.volume  = this.sfxVolume;
            });

            document.querySelectorAll('.rebind-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    btn.innerText = 'PRESS ANY KEY...';
                    btn.style.color = '#FFBF00';
                    const handleOnce = (e) => {
                        e.preventDefault();
                        btn.innerText = e.code === 'Space' ? 'SPACE' : e.key.toUpperCase();
                        btn.style.color = '#fff';
                        window.removeEventListener('keydown', handleOnce);
                    };
                    window.addEventListener('keydown', handleOnce);
                });
            });

            document.getElementById('quit-btn').addEventListener('click', () => {
                document.getElementById('quit-overlay').classList.add('active');
            });
        }

        loadAssets() {
            const loader = new THREE.GLTFLoader();
            const loadingBar = document.getElementById('loading-inner');

            const checkDone = () => {
                this.assetsLoaded++;
                if (this.assetsLoaded >= this.totalAssets) {
                    this.state = 'MENU';
                    setTimeout(() => {
                        const loadingElem = document.getElementById('menu-loading');
                        if (loadingElem) loadingElem.classList.add('hidden');
                    }, 500);

                    // Inicia a música de menu mesmo sem o fade (autoplay policy)
                    if (!this._menuMusicStarted) {
                        this.audioMenu.play().then(() => {
                            this._menuMusicStarted = true;
                            this._fadeAudioIn(this.audioMenu, 2000);
                        }).catch(() => {});
                    }

                    // Configura a câmera circular para rodar no MenuScene
                    this.menuCameraAngle = 0;
                    const box = new THREE.Box3().setFromObject(this.menuMesh);
                    this.menuCenter = box.getCenter(new THREE.Vector3());
                    this.cameraRadius = 35; // Distância da ilha
                }
            };

            const onError = (e) => console.error("Error loading models", e);

            // Shaders de Vento - Aplica movimento nos vértices das folhas
            const leafVertexShader = `
                uniform float time;
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    vec3 pos = position;
                    // Apenas balança pontos superiores (evita desconexão da árvore)
                    if (pos.y > 0.0) {
                        float speed = 1.0;
                        float disp = sin(time * speed + pos.x * 2.0) * 0.15;
                        pos.x += disp; // Balança no eixo X (suavemente)
                    }
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `;

            const leafFragmentShader = `
                uniform sampler2D map;
                varying vec2 vUv;
                // Cores para mistura: topo das folhas brilhantes, base escura
                void main() {
                    vec4 texColor = texture2D(map, vUv);
                    if (texColor.a < 0.5) discard; // Aplica transparência cortando folhas

                    // Simula iluminação no shader para combinar os tons
                    vec3 colorTop   = vec3(0.66, 0.81, 0.38); // Verde limão escuro / musgo
                    vec3 colorBot   = vec3(0.33, 0.45, 0.18); // Verde pinheiro (muito escuro)
                    vec3 mixedColor = mix(colorBot, colorTop, vUv.y);

                    // Multiplica a textura pela cor mista
                    gl_FragColor = vec4(texColor.rgb * mixedColor, texColor.a);
                }
            `;

            // Load Menu Model
            loader.load('models/modelMenu.glb', (gltf) => {
                this.menuMesh = gltf.scene;

                // Aplicar shader nas folhas para vento
                this.menuMesh.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;

                        // Se tiver textura/mapa, vamos processar caso seja follhagem (ajuste conforme nome dos materiais no .glb)
                        // Como os materiais padrões do Three.js ignoram o shader puro a menos que seja um ShaderMaterial,
                        // para as folhas (geralmente materiais com transparência ou chamados 'Leaves' / 'Foliage')
                        if (child.material && (child.material.name.toLowerCase().includes('leaf') || child.material.transparent || child.material.alphaTest > 0)) {
                            // Convertendo para o material base (MeshStandardMaterial modificado via onBeforeCompile)
                            child.material.onBeforeCompile = (shader) => {
                                shader.uniforms.time = this.timeUniform;
                                shader.vertexShader = `
                                    uniform float time;
                                    ${shader.vertexShader}
                                `.replace(
                                    `#include <begin_vertex>`,
                                    `
                                    vec3 transformed = vec3(position);
                                    // Adiciona inclinação baseada em y (apenas topos balançam)
                                    // Fator de escala da árvore afeta o displacement
                                    float windStr = max(0.0, transformed.y * 0.1);
                                    transformed.x += sin(time * 1.5 + transformed.z) * 0.4 * windStr;
                                    transformed.z += cos(time * 1.2 + transformed.x) * 0.2 * windStr;
                                    `
                                );
                            };
                        }
                    }
                });

                // Centralizar o modelo e ajustar escala se necessário
                const box = new THREE.Box3().setFromObject(this.menuMesh);
                const center = box.getCenter(new THREE.Vector3());
                this.menuMesh.position.sub(center); // Centraliza no mundo
                this.menuMesh.position.y -= box.min.y; // Assenta a base no chão (y=0)

                this.menuScene.add(this.menuMesh);
                checkDone();
            }, undefined, onError);

            // Load Map Model
            loader.load('models/modelMap.glb', (gltf) => {
                this.mapMesh = gltf.scene;
                this.scene.add(this.mapMesh);
                const box = new THREE.Box3().setFromObject(this.mapMesh);
                this.mapMesh.position.y = -box.min.y;
                checkDone();
            }, (xhr) => {
                if (xhr.lengthComputable && loadingBar) {
                    loadingBar.style.width = `${(xhr.loaded / xhr.total) * 100}%`;
                }
            }, onError);
        }

        // ... existing player and other methods adjusted ...
        buildPlayer() {
            this.playerGroup = new THREE.Group();
            this.playerGroup.position.set(-999, 0, 0);
            this.scene.add(this.playerGroup);

            // Estado da animação de sprite
            this.spriteState  = 'idle';
            this.spriteFrame  = 0;
            this.spriteTimer  = 0;
            this.spriteTextures = null;
            this.spriteMesh   = null;
            this.spriteMat    = null;

            // Inicializa sistema de texturas múltiplas (pasta character/)
            this._buildSpriteTextures();

            this.playerY = 2; this.vy = 0;
            this.onGround = false; this.facingRight = true;
            this.pathProgress = 0.0;
            this.smoothedGroundY = 0;

            this.buildPath();
            this.hunter = new Hunter(this.scene, this.pathCurve);
        }

        _buildSpriteTextures() {
            this.spriteTextures = {
                walking: [],
                jump: [],
                idle: []
            };

            const loader = new THREE.TextureLoader();
            const processTexture = (path) => {
                return new Promise((resolve) => {
                    loader.load(path, (tex) => {
                        const img = tex.image;
                        const cv = document.createElement('canvas');
                        // Aumenta o canvas um pouco para acomodar o contorno sem cortar
                        const padding = 12; 
                        cv.width = img.width + padding * 2; 
                        cv.height = img.height + padding * 2;
                        const ctx = cv.getContext('2d');
                        
                        // Desenha o sprite original temporariamente para processar a transparência
                        ctx.drawImage(img, padding, padding);
                        const id = ctx.getImageData(0, 0, cv.width, cv.height), d = id.data;
                        for (let i = 0; i < d.length; i += 4) {
                            const r = d[i], g = d[i+1], b = d[i+2];
                            if (r > 40 && r < 160 && Math.abs(r-g) < 20 && Math.abs(g-b) < 20) {
                                d[i+3] = 0;
                            } else if (r > 220 && g > 220 && b > 220) {
                                d[i+3] = 0;
                            }
                        }
                        ctx.putImageData(id, 0, 0);

                        // Agora que temos a imagem limpa no canvas, vamos criar o CONTORNO
                        // Salvamos o sprite limpo
                        const spriteClean = document.createElement('canvas');
                        spriteClean.width = cv.width; spriteClean.height = cv.height;
                        spriteClean.getContext('2d').putImageData(id, 0, 0);

                        // Limpa o canvas principal para desenhar o contorno por baixo
                        ctx.clearRect(0, 0, cv.width, cv.height);

                        // Desenha o contorno preto grosso (8 direções)
                        const thickness = 5;
                        ctx.globalCompositeOperation = 'source-over';
                        for(let x = -thickness; x <= thickness; x += thickness/2) {
                            for(let y = -thickness; y <= thickness; y += thickness/2) {
                                if (x*x + y*y > thickness*thickness) continue;
                                ctx.drawImage(spriteClean, x, y);
                            }
                        }
                        
                        // Transforma o contorno em PRETO PURO
                        ctx.globalCompositeOperation = 'source-in';
                        ctx.fillStyle = 'black';
                        ctx.fillRect(0, 0, cv.width, cv.height);

                        // Desenha o sprite original por cima do contorno preto
                        ctx.globalCompositeOperation = 'source-over';
                        ctx.drawImage(spriteClean, 0, 0);

                        const cleanTex = new THREE.CanvasTexture(cv);
                        cleanTex.magFilter = THREE.LinearFilter;
                        cleanTex.minFilter = THREE.LinearFilter;
                        resolve(cleanTex);
                    });
                });
            };

            // Definindo as ordens específicas conforme solicitado
            const walkPaths = [
                'sprites/character/spriteWalking1.png',
                'sprites/character/spriteWalking2.png',
                'sprites/character/spriteWalking3.png',
                'sprites/character/spriteWalking4.png',
                'sprites/character/spriteWalking3.png',
                'sprites/character/spriteWalking2.png'
            ];
            const jumpPaths = [
                'sprites/character/spriteJump1.png',
                'sprites/character/spriteJump2.png'
            ];
            const idlePath = 'sprites/character/spriteIdle.png';

            Promise.all([
                ...walkPaths.map(p => processTexture(p)),
                ...jumpPaths.map(p => processTexture(p)),
                processTexture(idlePath)
            ]).then((results) => {
                this.spriteTextures.walking = results.slice(0, 6);
                this.spriteTextures.jump = results.slice(6, 8);
                this.spriteTextures.idle = [results[8]];

                // Criação do "Papelão 3D" (Dois planos paralelos para dar espessura)
                this.spriteMesh = new THREE.Group();
                const planeGeo = new THREE.PlaneGeometry(3.5, 3.5);
                
                this.spriteMat = new THREE.MeshBasicMaterial({
                    map: this.spriteTextures.idle[0],
                    transparent: true, side: THREE.FrontSide,
                    alphaTest: 0.1,
                });

                const frontPlane = new THREE.Mesh(planeGeo, this.spriteMat);
                const backPlane = new THREE.Mesh(planeGeo, this.spriteMat);
                
                // Afasta levemente para dar a "grossura" de papelão (0.05 unidades)
                frontPlane.position.z = 0.025;
                backPlane.position.z = -0.025;
                backPlane.rotation.y = Math.PI; // Vira o verso

                this.spriteMesh.add(frontPlane);
                this.spriteMesh.add(backPlane);
                this.spriteMesh.position.y = 1.75;
                this.playerGroup.add(this.spriteMesh);
            });
        }

        updateSpriteAnimation(state, delta) {
            if (!this.spriteTextures || !this.spriteMesh || !this.spriteTextures.idle.length) return;
            
            if (state !== this.spriteState) {
                this.spriteState = state;
                this.spriteFrame = 0;
                this.spriteTimer = 0;
            }

            let frames = this.spriteTextures[this.spriteState] || this.spriteTextures.idle;
            
            if (this.spriteState === 'jump') {
                if (Math.abs(this.vy) < 0.1) {
                    this.spriteFrame = 1; 
                } else {
                    this.spriteFrame = 0;
                }
            } else {
                this.spriteTimer += delta;
                if (this.spriteTimer > 1 / SPRITE_FPS) {
                    this.spriteTimer = 0;
                    this.spriteFrame = (this.spriteFrame + 1) % frames.length;
                }
            }

            this.spriteMat.map = frames[this.spriteFrame] || this.spriteTextures.idle[0];
            
            // "Billboarding" Puro: Sempre olha para a câmera
            if (this.camera) {
                // Sincroniza o Billboard
                this.spriteMesh.quaternion.copy(this.camera.quaternion);
                const euler = new THREE.Euler().setFromQuaternion(this.spriteMesh.quaternion, 'YXZ');
                euler.x = 0; euler.z = 0;
                this.spriteMesh.quaternion.setFromEuler(euler);
            }

            // Garante que o sprite apareça na frente de folhagens e objetos transparentes
            this.playerGroup.renderOrder = 999;
            this.spriteMesh.children.forEach(child => child.renderOrder = 999);
            
            this.spriteMesh.scale.x = this.facingRight ? -1 : 1;
        }

        buildPath() {
            // Pontos atualizados para loop completo do mapa
            const points = [
                new THREE.Vector3(-29.1, 0, 158),
                new THREE.Vector3(-29.1, 0, 152.5),
                new THREE.Vector3(-29.1, 0, 144),
                new THREE.Vector3(-29.1, 0, 135),
                new THREE.Vector3(-29.1, 0, 125.5),
                new THREE.Vector3(-29.1, 0, 116),
                new THREE.Vector3(-29.1, 0, 110.1),
                new THREE.Vector3(-32.1, 0, 102.6),
                new THREE.Vector3(-35.1, 0, 99.1),
                new THREE.Vector3(-38.1, 0, 95.1),
                new THREE.Vector3(-42.6, 0, 91.6),
                new THREE.Vector3(-48.6, 0, 88.1),
                new THREE.Vector3(-51.6, 0, 85.1),
                new THREE.Vector3(-57.1, 0, 81.6),
                new THREE.Vector3(-60.1, 0, 76.6),
                new THREE.Vector3(-66.1, 0, 71.6),
                new THREE.Vector3(-68.6, 0, 66.5),
                new THREE.Vector3(-72.1, 0, 61),
                new THREE.Vector3(-73.6, 0, 51.5),
                new THREE.Vector3(-73.6, 0, 44),
                new THREE.Vector3(-73.6, 0, 39.1),
                new THREE.Vector3(-73.6, 0, 30.6),
                new THREE.Vector3(-74.1, 0, 21.6),
                new THREE.Vector3(-74.1, 0, 13.6),
                new THREE.Vector3(-74.1, 0, 6.6),
                new THREE.Vector3(-74.1, 0, -3.4),
                new THREE.Vector3(-74.1, 0, -9.9),
                new THREE.Vector3(-72.6, 0, -20.9),
                new THREE.Vector3(-70.1, 0, -27.4),
                new THREE.Vector3(-66.1, 0, -36.4),
                new THREE.Vector3(-62.1, 0, -40.4),
                new THREE.Vector3(-58.1, 0, -43.4),
                new THREE.Vector3(-49.6, 0, -46.4),
                new THREE.Vector3(-44.6, 0, -48.9),
                new THREE.Vector3(-38.1, 0, -51.9),
                new THREE.Vector3(-29.1, 0, -53.9),
                new THREE.Vector3(-29.1, 0, -47.9),
                new THREE.Vector3(-29.1, 0, -44.4),
                new THREE.Vector3(-29.1, 0, -38.4),
                new THREE.Vector3(-29.1, 0, -33.9),
                new THREE.Vector3(-29.1, 0, -30.4),
                new THREE.Vector3(-31.6, 0, -25.9),
                new THREE.Vector3(-31.6, 0, -19.9),
                new THREE.Vector3(-32.6, 0, -15.9),
                new THREE.Vector3(-32.6, 0, -10.9),
                new THREE.Vector3(-32.6, 0, -6.9),
                new THREE.Vector3(-32.6, 0, -0.9),
                new THREE.Vector3(-32.6, 0, 4.1),
                new THREE.Vector3(-31.6, 0, 8.6),
                new THREE.Vector3(-31.6, 0, 15.1),
                new THREE.Vector3(-30.6, 0, 20.6),
                new THREE.Vector3(-27.6, 0, 24.6),
                new THREE.Vector3(-27.6, 0, 30.1),
                new THREE.Vector3(-24.1, 0, 34.1),
                new THREE.Vector3(-25.1, 0, 39.6),
                new THREE.Vector3(-25.1, 0, 45.1),
                new THREE.Vector3(-19.7, 0, 49.1),
                new THREE.Vector3(-11.7, 0, 53.1),
                new THREE.Vector3(-4.7, 0, 53.1),
                new THREE.Vector3(-0.2, 0, 54.6),
                new THREE.Vector3(5.8, 0, 54.6),
                new THREE.Vector3(11.3, 0, 54.6),
                new THREE.Vector3(16.3, 0, 54.6),
                new THREE.Vector3(24.3, 0, 49.6),
                new THREE.Vector3(30.3, 0, 49.1),
                new THREE.Vector3(33.8, 0, 53.1),
                new THREE.Vector3(35.8, 0, 60.6),
                new THREE.Vector3(38.8, 0, 65.1),
                new THREE.Vector3(42.3, 0, 72.6),
                new THREE.Vector3(42.8, 0, 76.6),
                new THREE.Vector3(41.8, 0, 82.1),
                new THREE.Vector3(42.8, 0, 88.6),
                new THREE.Vector3(44.8, 0, 95.1),
                new THREE.Vector3(46.8, 0, 101.6),
                new THREE.Vector3(50.3, 0, 108.1),
                new THREE.Vector3(52.8, 0, 115.1),
                new THREE.Vector3(52.8, 0, 121.6),
                new THREE.Vector3(52.8, 0, 127.1),
                new THREE.Vector3(52.8, 0, 131.1),
                new THREE.Vector3(52.8, 0, 139.1),
                new THREE.Vector3(52.8, 0, 142.6),
                new THREE.Vector3(52.8, 0, 146.1),
                new THREE.Vector3(52.8, 0, 150.1),
                new THREE.Vector3(52.8, 0, 154.1),
                new THREE.Vector3(52.8, 0, 157.1),
                new THREE.Vector3(52.8, 0, 160.1),
                new THREE.Vector3(52.8, 0, 163.1),
                new THREE.Vector3(52.8, 0, 166.1),
            ];
            this.pathCurve = new THREE.CatmullRomCurve3(points);

            // Linha guia vermelha visível (para depuração)
            const outlineGeom = new THREE.TubeGeometry(this.pathCurve, 200, 0.4, 8, false);
            const outlineMat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
            this.pathMesh = new THREE.Mesh(outlineGeom, outlineMat);
            this.pathMesh.position.y = 0.5;
            this.scene.add(this.pathMesh);
        }

        onResize() {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.updateCameraProjection();
        }

        updateCameraProjection() {
            const aspect = window.innerWidth / window.innerHeight;
            if (this.state === 'MENU' || this.state === 'LOADING') {
                this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
                this.camera.position.set(0, 0, -1.3);
                this.camera.lookAt(0, 0.4, 0);
            } else {
                // Modo 2.5D muda para PerspectiveCamera para melhor percepção de profundidade
                this.camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 1000);
            }
        }

        async runCutscene() {
            this.state = 'CUTSCENE';
            document.getElementById('splash-screen').style.opacity = '0';
            setTimeout(() => document.getElementById('splash-screen').classList.add('hidden'), 1000);

            this.updateCameraProjection();
            this.pathProgress = 0.0;
            const startPt = this.pathCurve.getPointAt(0);

            if (this.debugMode) {
                // Spawn top-down alto para debug geográfico
                this.playerY = 50;
                this.playerGroup.position.set(startPt.x, this.playerY, startPt.z);
                this.camera.position.set(startPt.x, 80, startPt.z + 50);
                this.camera.lookAt(startPt);
            } else {
                // Modo 2.5D Real
                this.playerY = 15;
                this.playerGroup.position.set(startPt.x, this.playerY, startPt.z);

                const up = new THREE.Vector3(0, 1, 0);
                const tangent = this.pathCurve.getTangentAt(0);
                const offsetDir = new THREE.Vector3().crossVectors(tangent, up).normalize();

                const camPos = new THREE.Vector3().copy(startPt)
                    .addScaledVector(offsetDir, 18)
                    .add(new THREE.Vector3(0, 12, 0));

                this.camera.position.copy(camPos);
                this.camera.lookAt(startPt);
            }

            await sleep(1500);

            // Transição musical: fade out menu → fade in gameplay
            this._fadeAudioOut(this.audioMenu, 1500, () => {
                this.audioGameplay.play().then(() => this._fadeAudioIn(this.audioGameplay, 2000)).catch(() => {});
            });

            this.state = 'PLAYING';
        }

        updatePlaying(delta) {
            const left = this.keys['KeyA'] || this.keys['ArrowLeft'];
            const right = this.keys['KeyD'] || this.keys['ArrowRight'];
            const jump = this.keys['Space']; // Pulo completamente isolado para não misturar funções

            if (this.debugMode) {
                // MODO HUD DE EXPLORAÇÃO/MAPEAMENTO
                const forward = this.keys['KeyW'] || this.keys['ArrowUp'];
                const back = this.keys['KeyS'] || this.keys['ArrowDown'];
                const SPEED = 30.0;
                let dx = 0, dz = 0;

                if (left) dx = -SPEED * delta;
                if (right) dx = SPEED * delta;
                if (forward) dz = -SPEED * delta;
                if (back) dz = SPEED * delta;

                this.playerGroup.position.x += dx;
                this.playerGroup.position.z += dz;

                const hud = document.getElementById('coord-hud');
                if (hud) {
                    hud.style.opacity = '1';
                    hud.innerText = `X: ${this.playerGroup.position.x.toFixed(1)} | Z: ${this.playerGroup.position.z.toFixed(1)}`;
                }

                if (jump && this.onGround) { this.vy = JUMP_FORCE * 1.5; this.onGround = false; }
                this.vy += GRAVITY;
                this.playerY += this.vy;

                let groundY = -5;
                if (this.mapMesh) {
                    const rayOrigin = new THREE.Vector3(this.playerGroup.position.x, 200, this.playerGroup.position.z);
                    const rayDir = new THREE.Vector3(0, -1, 0);
                    this.raycaster.set(rayOrigin, rayDir);
                    const intersects = this.raycaster.intersectObject(this.mapMesh, true);
                    // FIX CRÍTICO: Pegar o ponto mais BAIXO (chão), não o mais alto (topo das árvores)
                    if (intersects.length > 0) {
                        groundY = intersects.reduce((lowest, hit) =>
                            hit.point.y < lowest ? hit.point.y : lowest,
                            intersects[0].point.y
                        );
                    }
                }

                if (this.playerY < groundY) { this.playerY = groundY; this.vy = 0; this.onGround = true; }
                this.playerGroup.position.y = this.playerY;

                if (dx !== 0 || dz !== 0) {
                    this.playerGroup.rotation.y = Math.atan2(dx, dz);
                }

                const targetCamPos = new THREE.Vector3().copy(this.playerGroup.position).add(new THREE.Vector3(0, 60, 40));
                this.camera.position.lerp(targetCamPos, 0.1);
                this.camera.lookAt(this.playerGroup.position);

            } else {
                // MODO 2.5D ORIGINAL
                const isMoving = left || right;
                if (left)  { this.pathProgress -= 0.035 * delta; this.facingRight = false; }
                else if (right) { this.pathProgress += 0.035 * delta; this.facingRight = true; }

                this.pathProgress = THREE.MathUtils.clamp(this.pathProgress, 0, 1);
                const curvePoint = this.pathCurve.getPointAt(this.pathProgress);
                const tangent    = this.pathCurve.getTangentAt(this.pathProgress);

                // Física
                if (jump && this.onGround) { this.vy = JUMP_FORCE; this.onGround = false; }
                this.vy += GRAVITY;
                this.playerY += this.vy;

                // Raycaster com suavização para eliminar solavancos do low-poly
                if (this.mapMesh) {
                    const rayOrigin = new THREE.Vector3(curvePoint.x, 200, curvePoint.z);
                    this.raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
                    const hits = this.raycaster.intersectObject(this.mapMesh, true);
                    if (hits.length > 0) {
                        const rawY = hits.reduce((lo, h) => h.point.y < lo ? h.point.y : lo, hits[0].point.y);
                        this.smoothedGroundY = THREE.MathUtils.lerp(this.smoothedGroundY, rawY + 1.5, 0.06);
                    }
                }
                const groundY = this.smoothedGroundY;
                if (this.playerY < groundY) { this.playerY = groundY; this.vy = 0; this.onGround = true; }
                else if (this.playerY > groundY + 0.1) { this.onGround = false; }

                this.playerGroup.position.set(curvePoint.x, this.playerY, curvePoint.z);

                // Animação do sprite
                const sprState = !this.onGround ? 'jump' : isMoving ? 'walking' : 'idle';
                this.updateSpriteAnimation(sprState, delta);

                // Som de passos
                this.setWalkSound(isMoving && this.onGround);

                // Câmera
                const up = new THREE.Vector3(0, 1, 0);
                const offsetDir = new THREE.Vector3().crossVectors(tangent, up).normalize();
                const camDist = 18, camHeight = 12;
                const targetCamPos = new THREE.Vector3().copy(this.playerGroup.position)
                    .addScaledVector(offsetDir, camDist)
                    .add(new THREE.Vector3(0, camHeight, 0));

                this.camera.position.lerp(targetCamPos, 0.08);
                this.camera.lookAt(this.playerGroup.position.x, this.playerGroup.position.y + 1.5, this.playerGroup.position.z);

                // MODO 2.5D ORIGINAL
                if (!this.minigameActive) {
                    const isMoving = left || right;
                    if (left)  { this.pathProgress -= 0.025 * delta; this.facingRight = false; } // Velocidade reduzida
                    else if (right) { this.pathProgress += 0.025 * delta; this.facingRight = true; } // Velocidade reduzida

                    this.pathProgress = THREE.MathUtils.clamp(this.pathProgress, 0, 1);
                    const curvePoint = this.pathCurve.getPointAt(this.pathProgress);
                    const tangent    = this.pathCurve.getTangentAt(this.pathProgress);

                    // Física
                    if (jump && this.onGround) { this.vy = JUMP_FORCE; this.onGround = false; }
                    this.vy += GRAVITY;
                    this.playerY += this.vy;

                    // Raycaster com suavização
                    if (this.mapMesh) {
                        const rayOrigin = new THREE.Vector3(curvePoint.x, 200, curvePoint.z);
                        this.raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
                        const hits = this.raycaster.intersectObject(this.mapMesh, true);
                        if (hits.length > 0) {
                            const rawY = hits.reduce((lo, h) => h.point.y < lo ? h.point.y : lo, hits[0].point.y);
                            this.smoothedGroundY = THREE.MathUtils.lerp(this.smoothedGroundY, rawY + 1.5, 0.06);
                        }
                    }
                    const groundY = this.smoothedGroundY;
                    if (this.playerY < groundY) { this.playerY = groundY; this.vy = 0; this.onGround = true; }
                    else if (this.playerY > groundY + 0.1) { this.onGround = false; }

                    this.playerGroup.position.set(curvePoint.x, this.playerY, curvePoint.z);

                    const sprState = !this.onGround ? 'jump' : isMoving ? 'walking' : 'idle';
                    this.updateSpriteAnimation(sprState, delta);
                    this.setWalkSound(isMoving && this.onGround);
                } else {
                    // MICO-LEÃO PARADO E TREMENDO NO MINIGAME
                    this.updateSpriteAnimation('idle', delta);
                    const shakeAmount = 0.06;
                    this.spriteMesh.position.x = (Math.random() - 0.5) * shakeAmount;
                    this.spriteMesh.position.z = (Math.random() - 0.5) * shakeAmount;

                    // Aproximação do Caçador no Minigame
                    this.hunter.progress += this.minigameHunterSpeed * delta;
                }

                // Update Hunter
                if (this.hunter) {
                    this.hunter.groundY = this.smoothedGroundY;
                    this.hunter.update(this.pathProgress, delta, this.camera);
                    
                    // Condição de Game Over: Caçador alcançou o Mico (Distância curtíssima)
                    // Importante: Só checa se o hunter já começou a perseguição (progress > 0)
                    const dist = Math.abs(this.pathProgress - this.hunter.progress);
                    if (this.hunter.progress > 0 && dist < 0.008 && this.hunter.state !== 'fainted') {
                        this.gameOver();
                    }
                }

                // Gatilho do Minigame
                if (this.pathProgress >= MINIGAME_START_POS && !this.hunterDefeated && !this.minigameActive) {
                    this.startMinigame();
                }

                if (this.minigameActive) {
                    this.updateMinigame(delta);
                }
            }
        }

        gameOver() {
            // Em vez de reload (que causa erro de WebGL), fazemos um reset interno
            this.resetGame();
        }

        resetGame() {
            // Reseta progresso e estados
            this.pathProgress = 0;
            this.playerY = 0;
            this.vy = 0;
            this.onGround = false;
            this.smoothedGroundY = 0;
            this.minigameActive = false;
            this.minigameHits = 0;
            this.hunterDefeated = false;
            
            if (this.hunter) {
                this.hunter.progress = 0;
                this.hunter.state = 'idle';
                this.hunter.group.visible = false;
            }

            // Reseta UI
            document.getElementById('minigame-container').style.display = 'none';
            for (let i = 1; i <= 3; i++) {
                document.getElementById(`dot-${i}`).classList.remove('hit');
            }

            // Reposiciona o grupo do player
            if (this.pathCurve) {
                const start = this.pathCurve.getPointAt(0);
                this.playerGroup.position.set(start.x, 20, start.z);
            }
            
            showNarrative("Você foi capturado! Tente novamente.");
        }

        startMinigame() {
            this.minigameActive = true;
            this.minigameHits = 0;
            this.minigameAngle = 0;
            this.minigameHunterSpeed = 0.005; // Reseta a velocidade de aproximação
            document.getElementById('minigame-container').style.display = 'flex';
            this.randomizeSuccessZone();
        }

        randomizeSuccessZone() {
            const start = Math.random() * 300;
            this.successZone = { start, end: start + 60 };
            const dial = document.getElementById('minigame-sector');
            dial.style.background = `conic-gradient(transparent ${start}deg, #fff ${start}deg ${start+60}deg, transparent ${start+60}deg)`;
        }

        updateMinigame(delta) {
            this.minigameAngle = (this.minigameAngle + (this.minigameSpeed * 60 * delta)) % 360;
            document.getElementById('minigame-needle').style.transform = `translateX(-50%) rotate(${this.minigameAngle}deg)`;

            // Verificação de Input do Minigame (ACTION: E)
            if (this.keys['KeyE']) {
                this.keys['KeyE'] = false; // Consome o input
                
                const angle = this.minigameAngle;
                const s = this.successZone;
                
                let success = false;
                if (s.end > 360) {
                    if (angle >= s.start || angle <= (s.end % 360)) success = true;
                } else {
                    if (angle >= s.start && angle <= s.end) success = true;
                }

                if (success) {
                    this.minigameHits++;
                    document.getElementById(`dot-${this.minigameHits}`).classList.add('hit');
                    if (this.minigameHits >= 3) {
                        this.endMinigame(true);
                    } else {
                        this.randomizeSuccessZone();
                        this.minigameSpeed += 1.5; 
                    }
                } else {
                    // ERROU: O caçador se aproxima MAIS RÁPIDO
                    const container = document.getElementById('minigame-container');
                    container.classList.add('shake');
                    setTimeout(() => container.classList.remove('shake'), 200);
                    
                    this.minigameHunterSpeed += 0.015; // Aceleração por erro
                    this.minigameSpeed = Math.max(4, this.minigameSpeed - 0.5);
                }
            }
        }

        endMinigame(success) {
            this.minigameActive = false;
            document.getElementById('minigame-container').style.display = 'none';
            if (success) {
                this.hunterDefeated = true;
                this.hunter.state = 'fainted';
                showNarrative("O caçador foi nocauteado! Continue o caminho.");
            }
        }

        loop() {
            requestAnimationFrame(() => this.loop());
            const delta = this.clock.getDelta();
            this.timeUniform.value = this.clock.getElapsedTime(); // Atualizar o timer do vento para os shaders

            if (this.state === 'PLAYING') {
                this.updatePlaying(delta);
                this.renderer.render(this.scene, this.camera);
            } else if (this.state === 'MENU' || this.state === 'LOADING') {
                // A rotação foi parada conforme solicitado pelo usuário.
                this.renderer.render(this.menuScene, this.camera);
            }
        }
    }

    // Aguarda o carregamento e dá um tempo para a GPU limpar o lixo da sessão anterior
    window.addEventListener('load', () => {
        setTimeout(() => {
            window.gameInst = new Game();
        }, 500); 
    });
})();

