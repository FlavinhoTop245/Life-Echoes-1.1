// Life Echoes v2.0 — 2.5D Side-Scrolling Platformer
// Câmera ortográfica lateral, cutscene de intro, Fase 1: coleta de frutas

(function () {
    'use strict';

    // ─── CONSTANTS ─────────────────────────────────────────────────────────────
    const GRAVITY        = -0.022;
    const JUMP_FORCE     = 0.55;
    const MOVE_SPEED     = 0.28;
    const FRUITS_NEEDED  = 8;
    const PLAYER_W       = 1.0;
    const PLAYER_H       = 1.4;

    // ─── HELPERS ───────────────────────────────────────────────────────────────
    function makeColor(hex) { return new THREE.Color(hex); }

    function showNarrative(text, duration = 4000) {
        return new Promise(resolve => {
            const bar  = document.getElementById('narrative-bar');
            const txt  = document.getElementById('narrative-text');
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
            this.canvas   = document.getElementById('game-canvas');
            this.clock    = new THREE.Clock();
            this.state    = 'LOADING'; // LOADING | MENU | CUTSCENE | PLAYING

            this.mapMesh    = null;
            this.menuMesh   = null;
            this.assetsLoaded = 0;
            this.totalAssets = 2; // modelMap and modelMenu

            this.raycaster  = new THREE.Raycaster();
            this.keys = {};
            this.timeUniform = { value: 0 }; // Uniform de tempo para o Shader de vento

            this.init();
        }

        init() {
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

            // UI Events
            this.setupUIEvents();

            // System Events
            window.addEventListener('keydown', e => this.keys[e.code] = true);
            window.addEventListener('keyup', e => this.keys[e.code] = false);
            window.addEventListener('resize', () => this.onResize());

            this.loop();
        }

        addLights(targetScene) {
            // HemiLight com subtons mais claros e brilhantes (clarea a área de sombra na grama e troncos)
            const hemiLight = new THREE.HemisphereLight(0xffffff, 0x666666, 1.5); 
            targetScene.add(hemiLight);
            
            // Anteriormente a luz vinha de Z = 30 (costas da ilha), por isso a frente da floresta estava em sombra.
            // Movemos para Z = -30 (costas da câmera), injetando luz perfeitamente em toda a parte da frente da floresta!
            const sun = new THREE.DirectionalLight(0xfffccf, 2.0); 
            sun.position.set(20, 40, -30);
            sun.castShadow = true;
            sun.shadow.normalBias = 0.05; // Evita artefatos escuros nas arestas
            targetScene.add(sun);
        }

        setupUIEvents() {
            // Start Game
            document.getElementById('start-btn').addEventListener('click', () => {
                if (this.state === 'MENU') this.runCutscene();
            });

            // Options Toggle
            const optionsMenu = document.getElementById('options-menu');
            document.getElementById('options-btn').addEventListener('click', () => {
                optionsMenu.classList.add('active');
            });
            document.getElementById('back-to-menu').addEventListener('click', () => {
                optionsMenu.classList.remove('active');
            });

            // Volume Sliders
            const musicSlider = document.getElementById('music-slider');
            const sfxSlider   = document.getElementById('sfx-slider');
            const musicPct    = document.getElementById('music-vol-percent');
            const sfxPct      = document.getElementById('sfx-vol-percent');

            musicSlider.addEventListener('input', (e) => musicPct.innerText = `${e.target.value}%`);
            sfxSlider.addEventListener('input', (e) => sfxPct.innerText = `${e.target.value}%`);

            // Rebind mock logic
            document.querySelectorAll('.rebind-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const originalText = btn.innerText;
                    btn.innerText = "PRESS ANY KEY...";
                    btn.style.color = "#FFBF00";
                    
                    const handleOnce = (e) => {
                        btn.innerText = e.key.toUpperCase();
                        btn.style.color = "#fff";
                        window.removeEventListener('keydown', handleOnce);
                    };
                    window.addEventListener('keydown', handleOnce);
                });
            });

            // Quit
            document.getElementById('quit-btn').addEventListener('click', () => {
                document.getElementById('quit-overlay').classList.add('active');
            });
        }

        loadAssets() {
            const loader = new THREE.GLTFLoader();
            const loadingBar = document.getElementById('loading-inner');

            const checkDone = () => {
                this.assetsLoaded++;
                console.log(`Asset ${this.assetsLoaded}/${this.totalAssets} handled.`);
                if (this.assetsLoaded >= this.totalAssets) {
                    this.state = 'MENU';
                    console.log("Game state set to MENU");
                    setTimeout(() => {
                        const loadingElem = document.getElementById('menu-loading');
                        if (loadingElem) loadingElem.classList.add('hidden');
                    }, 500);
                }
            };

            // Error handler to ensure we don't get stuck in LOADING
            const onError = (err) => {
                console.warn('Asset loading failed (likely CORS or file not found):', err);
                
                // FALLBACK: Se o modelo falhar, restauramos a imagem de fundo estática
                const splash = document.getElementById('splash-screen');
                if (splash) {
                    splash.style.background = "url('assets/fundo.png') no-repeat center center";
                    splash.style.backgroundSize = "cover";
                }
                
                checkDone();
            };

            // Load Menu Model
            loader.load('models/modelMenu.glb', (gltf) => {
                this.menuMesh = gltf.scene;
                this.menuMesh.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        
                        // Efeito de Vento: Injeção de Shader Customizado (Vertex Shader)
                        if (child.material) {
                            child.material.onBeforeCompile = (shader) => {
                                shader.uniforms.time = this.timeUniform;
                                shader.vertexShader = `uniform float time;\n` + shader.vertexShader;
                                shader.vertexShader = shader.vertexShader.replace(
                                    `#include <begin_vertex>`,
                                    `
                                    #include <begin_vertex>
                                    // Como a vegetação está muito próxima do Y=0, não podemos zerar a força na base.
                                    // Incrementamos um valor constante (offset) para assegurar que toda a superfície ondule.
                                    float heightFactor = position.y + 2.0; 
                                    float windForce = 0.008 * heightFactor; // Força do vento
                                    
                                    // Ampliamos muito o tamanho da "onda" reduzindo a frequência cruzada (0.05 em vez de 1.2).
                                    // Isso assegura que uma flor inteira sofra a mesma força, evitando que ela
                                    // estique e "derreta/mescle" com as folhas vizinhas. As coisas balançam como blocos sólidos.
                                    transformed.x += sin(time * 1.5 + position.z * 0.05) * windForce;
                                    transformed.z += cos(time * 1.0 + position.x * 0.05) * windForce * 0.4;
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
            const mat = new THREE.MeshStandardMaterial({ color: 0xf9a825, flatShading: true });
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.6), mat);
            body.position.y = 0.5;
            this.playerGroup.add(body);
            // (Simpilifed for now to ensure working state)
            this.playerGroup.position.set(-999, 0, 0);
            this.scene.add(this.playerGroup);
            this.playerX = 0; this.playerY = 2; this.vx = 0; this.vy = 0;
            this.onGround = false; this.facingRight = true;
        }

        onResize() {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.updateCameraProjection();
        }

        updateCameraProjection() {
            const aspect = window.innerWidth / window.innerHeight;
            if (this.state === 'MENU' || this.state === 'LOADING') {
                this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
                // Mais um micro-ajuste final de câmera: z: -1.3, y: 0
                this.camera.position.set(0, 0, -1.3); 
                // Mantendo look at em 0.4 para ter uma inclinação mais nítida para cima
                this.camera.lookAt(0, 0.4, 0);
            } else {
                const zoom = 18;
                this.camera = new THREE.OrthographicCamera(-zoom*aspect, zoom*aspect, zoom, -zoom, 0.1, 600);
                this.camera.position.set(0, 10, 50);
                this.camera.lookAt(0, 10, 0);
            }
        }

        async runCutscene() {
            this.state = 'CUTSCENE';
            document.getElementById('splash-screen').style.opacity = '0';
            setTimeout(() => document.getElementById('splash-screen').classList.add('hidden'), 1000);

            this.updateCameraProjection(); 
            this.playerX = 0; this.playerY = 40;
            this.playerGroup.position.set(0, 40, 0);

            await this.panCamera(0, 12, 1500);
            this.state = 'PLAYING';
        }

        panCamera(targetX, targetY, duration) {
            return new Promise(resolve => {
                const startX = this.camera.position.x;
                const startY = this.camera.position.y;
                const start = performance.now();
                const tick = (now) => {
                    const t = Math.min((now - start) / duration, 1);
                    const ease = t<.5 ? 2*t*t : -1+(4-2*t)*t;
                    this.camera.position.x = startX + (targetX - startX) * ease;
                    this.camera.position.y = startY + (targetY - startY) * ease;
                    this.camera.lookAt(this.camera.position.x, this.camera.position.y, 0);
                    if (t < 1) requestAnimationFrame(tick); else resolve();
                };
                requestAnimationFrame(tick);
            });
        }

        updatePlaying(delta) {
            const left = this.keys['KeyA'] || this.keys['ArrowLeft'];
            const right = this.keys['KeyD'] || this.keys['ArrowRight'];
            const jump = this.keys['Space'] || this.keys['KeyW'] || this.keys['ArrowUp'];

            if (left) { this.vx = -MOVE_SPEED; this.facingRight = false; }
            else if (right) { this.vx = MOVE_SPEED; this.facingRight = true; }
            else { this.vx = 0; }

            if (jump && this.onGround) { this.vy = JUMP_FORCE; this.onGround = false; }

            this.vy += GRAVITY;
            this.playerX += this.vx;
            this.playerY += this.vy;

            // Simple ground check
            if (this.playerY < 0) { this.playerY = 0; this.vy = 0; this.onGround = true; }

            this.playerGroup.position.set(this.playerX, this.playerY, 0);
            this.camera.position.x += (this.playerX - this.camera.position.x) * 0.1;
            this.camera.lookAt(this.camera.position.x, 10, 0);
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

