// Life Echoes v2.0 — 2.5D Side-Scrolling Platformer
// Câmera ortográfica lateral, cutscene de intro, Fase 1: coleta de frutas

(function () {
    'use strict';

    // ─── CONSTANTS ─────────────────────────────────────────────────────────────
    const GRAVITY = -0.022;
    const JUMP_FORCE = 0.55;
    const MOVE_SPEED = 0.28;
    const FRUITS_NEEDED = 8;
    const PLAYER_W = 1.0;
    const PLAYER_H = 1.4;

    // Sprite sheet: spritesCharacter.png (1456×770 px)
    // Coordenadas originais exatas para focar apenas nos macacos (ignorando texto à esquerda)
    const SPRITE_FRAMES = {
        idle:    [[567, 538, 148, 222]],
        walking: [[567,173,162,167],[729,173,162,167],[891,173,162,167],[1053,173,162,167]],
        jump:    [[567,355,166,170],[733,355,166,170]],
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

    // ─── GAME CLASS ────────────────────────────────────────────────────────────
    class Game {
        constructor() {
            this.canvas = document.getElementById('game-canvas');
            this.clock = new THREE.Clock();
            this.state = 'LOADING'; // LOADING | MENU | CUTSCENE | PLAYING

            this.mapMesh = null;
            this.menuMesh = null;
            this.assetsLoaded = 0;
            this.totalAssets = 2; // modelMap and modelMenu

            this.raycaster = new THREE.Raycaster();
            this.keys = {};
            this.timeUniform = { value: 0 }; // Uniform de tempo para o Shader de vento

            this.init();
        }

        init() {
            this.debugMode = false; // Add this line

            // Scenes
            this.scene = new THREE.Scene();
            this.menuScene = new THREE.Scene();

            this.scene.background = makeColor(0x87ceeb);
            // Céu azul e ensolarado para o Menu
            this.menuScene.background = makeColor(0x5caede);

            // Renderer
            this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Deixa as bordas das sombras mais elegantes

            // Implementação de Tone Mapping (HDR Cinematográfico) para brilho alto sem "estourar" a imagem branca
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.6; // Exposição bem mais alta para clarear os elementos

            // Camera setup
            this.updateCameraProjection();

            // Lights for both scenes
            this.addLights(this.scene);
            this.addLights(this.menuScene);

            // Load Assets
            this.loadAssets();
            this.buildPlayer();

            // Audio
            this.setupAudio();

            // UI Events
            this.setupUIEvents();

            // Resize
            window.addEventListener('resize', () => {
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                this.updateCameraProjection();
            });

            // Input
            window.addEventListener('keydown', (e) => this.keys[e.code] = true);
            window.addEventListener('keyup', (e) => this.keys[e.code] = false);

            // Debug Toggle
            window.addEventListener('keydown', (e) => {
                if (e.code === 'KeyQ') {
                    this.debugMode = !this.debugMode;
                    const hud = document.getElementById('coord-hud');
                    if (hud) hud.style.display = this.debugMode ? 'block' : 'none';
                    if (this.pathMesh) this.pathMesh.visible = this.debugMode;
                }
            });

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
            this.musicVolume = 0.5;
            this.sfxVolume   = 0.5;
            this._walkPlaying = false;

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

            // Tenta iniciar música de menu com fade in
            const startMenu = () => {
                if (this._menuMusicStarted) return;
                this._menuMusicStarted = true;
                this.audioMenu.play().then(() => this._fadeAudioIn(this.audioMenu, 2000)).catch(() => {});
            };
            // Autoplay imediato + fallback no primeiro clique/tecla
            this.audioMenu.play().then(() => { this._menuMusicStarted = true; this._fadeAudioIn(this.audioMenu, 2000); }).catch(() => {});
            document.addEventListener('click',   startMenu, { once: true });
            document.addEventListener('keydown', startMenu, { once: true });
        }

        _fadeAudioIn(audio, duration) {
            const target = this.musicVolume;
            audio.volume = 0;
            const steps = 40, stepTime = duration / steps;
            let step = 0;
            const id = setInterval(() => {
                audio.volume = Math.min((++step / steps) * target, target);
                if (step >= steps) clearInterval(id);
            }, stepTime);
        }

        _fadeAudioOut(audio, duration, cb) {
            const start = audio.volume, steps = 40, stepTime = duration / steps;
            let step = 0;
            const id = setInterval(() => {
                audio.volume = Math.max(start * (1 - (++step / steps)), 0);
                if (step >= steps) { clearInterval(id); audio.pause(); audio.currentTime = 0; if (cb) cb(); }
            }, stepTime);
        }

        playSFXHover() {
            try { this.sfxHover.currentTime = 0; this.sfxHover.volume = this.sfxVolume; this.sfxHover.play().catch(() => {}); } catch(e) {}
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
                        this.audioMenu.play().then(() => this._fadeAudioIn(this.audioMenu, 2000)).catch(() => {});
                        this._menuMusicStarted = true;
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

            // Carrega sprite sheet e extrai frames
            const img = new Image();
            img.onload = () => this._buildSpriteTextures(img);
            img.src = 'sprites/spritesCharacter.png';

            this.playerY = 2; this.vy = 0;
            this.onGround = false; this.facingRight = true;
            this.pathProgress = 0.0;
            this.smoothedGroundY = 0;

            this.buildPath();
        }

        _buildSpriteTextures(img) {
            this.spriteTextures = {};
            for (const [anim, frames] of Object.entries(SPRITE_FRAMES)) {
                this.spriteTextures[anim] = frames.map(([sx, sy, sw, sh]) => {
                    const cv  = document.createElement('canvas');
                    cv.width  = sw; cv.height = sh;
                    const ctx = cv.getContext('2d');
                    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

                    // Chromakey: Apenas apaga a cor cinza escuro de fundo da imagem diretamente
                    const id = ctx.getImageData(0, 0, sw, sh), d = id.data;
                    for (let i = 0; i < d.length; i += 4) {
                        const r = d[i], g = d[i+1], b = d[i+2];
                        if (r > 50 && r < 130 && g > 50 && g < 130 && b > 50 && b < 130
                            && Math.abs(r-g) < 30 && Math.abs(g-b) < 30) {
                            d[i+3] = 0; // Transparente
                        } else if (r > 215 && g > 215 && b > 215) {
                            d[i+3] = 0; // Branco vira transparente
                        }
                    }
                    ctx.putImageData(id, 0, 0);

                    const tex = new THREE.CanvasTexture(cv);
                    tex.magFilter = THREE.LinearFilter;
                    tex.minFilter = THREE.LinearFilter;
                    return tex;
                });
            }
            // Plano billboard normalizado e ampliado para acomodar 250x250
            const planeGeo = new THREE.PlaneGeometry(3.5, 3.5);
            this.spriteMat = new THREE.MeshBasicMaterial({
                map: this.spriteTextures.idle[0],
                transparent: true, side: THREE.DoubleSide,
                depthWrite: false, alphaTest: 0.05,
            });
            this.spriteMesh = new THREE.Mesh(planeGeo, this.spriteMat);
            this.spriteMesh.position.y = 1.75; // Eleva acima do chão (metade de 3.5)
            this.playerGroup.add(this.spriteMesh);
        }

        updateSpriteAnimation(state, delta) {
            if (!this.spriteTextures || !this.spriteMesh) return;
            if (state !== this.spriteState) {
                this.spriteState = state;
                this.spriteFrame = 0;
                this.spriteTimer = 0;
            }
            const frames = this.spriteTextures[this.spriteState] || this.spriteTextures.idle;
            this.spriteTimer += delta;
            if (this.spriteTimer > 1 / SPRITE_FPS) {
                this.spriteTimer = 0;
                this.spriteFrame = (this.spriteFrame + 1) % frames.length;
            }
            this.spriteMat.map = frames[this.spriteFrame];
            this.spriteMat.needsUpdate = true;
            
            // Cylindrical Billboarding: olhar para a câmera, mas sem deitar (Pitch = 0, Roll = 0)
            // Isso garante que o sprite fique em pé "em cima do solo" como um personagem 3D.
            if (this.camera) {
                const camPos = this.camera.position.clone();
                // Assumindo que o playerGroup não tem rotação (XYZ = 0,0,0)
                camPos.y = this.playerGroup.position.y + this.spriteMesh.position.y;
                this.playerGroup.worldToLocal(camPos);
                this.spriteMesh.lookAt(camPos);
            }
            // Espelhar quando vai para a esquerda
            this.spriteMesh.scale.x = this.facingRight ? 1 : -1;
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

    window.addEventListener('load', () => new Game());
})();

