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

            // UI Events
            this.setupUIEvents();

            // System Events
            window.addEventListener('keydown', e => {
                this.keys[e.code] = true;
                // Atalho Secreto (Debug Mode)
                if (e.ctrlKey && e.shiftKey && e.code === 'KeyE') {
                    this.debugMode = !this.debugMode;
                    console.log("DEBUG MODE Toggled: ", this.debugMode);
                    // Ocultar HUD se sair
                    if (!this.debugMode) {
                        const hud = document.getElementById('coord-hud');
                        if (hud) hud.style.opacity = '0';
                    }
                }
            });
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
                        e.preventDefault(); // Impede o scroll de página caso a barra resolva scrollar
                        btn.innerText = e.code === 'Space' ? 'SPACE' : e.key.toUpperCase();
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
            this.playerGroup.position.set(-999, 0, 0);
            this.scene.add(this.playerGroup);
            
            this.playerY = 2; this.vy = 0;
            this.onGround = false; this.facingRight = true;
            this.pathProgress = 0.0;
            
            this.buildPath();
        }

        buildPath() {
            // Pontos extraídos por 2ª análise frame-a-frame do vídeo caminho.mp4.
            // O eixo Z decresce rumo ao norte. Todos os pontos estão nas estradas de terra.
            const points = [
                // PONTO INICIAL (Sul-Oeste), beira dágua
                new THREE.Vector3(-29.1, 0,  158.0),
                new THREE.Vector3(-29.1, 0,  145.1),
                new THREE.Vector3(-29.1, 0,  131.7),
                new THREE.Vector3(-29.1, 0,  118.3),
                new THREE.Vector3(-29.1, 0,  104.9),
                new THREE.Vector3(-29.1, 0,   91.5),
                new THREE.Vector3(-29.1, 0,   78.1), // Primeira bifurcação: curva abrupta para oeste
                new THREE.Vector3(-52.7, 0,   78.1), // Virando para oeste
                new THREE.Vector3(-76.4, 0,   59.7), // Entrando no corredor da floresta
                new THREE.Vector3(-76.4, 0,   41.3),
                new THREE.Vector3(-73.6, 0,   28.1), // Leve curva para direita
                new THREE.Vector3(-54.8, 0,   13.9), // Curvando Nordeste
                new THREE.Vector3(-35.3, 0,   -4.3), // Diagonal Norte
                new THREE.Vector3(-31.6, 0,  -13.9),
                new THREE.Vector3(-31.3, 0,  -28.5),
                new THREE.Vector3(-32.8, 0,  -44.1), // Segunda bifurcação: curva abrupta para leste
                new THREE.Vector3(-18.0, 0,  -48.9), // Virando para leste
                new THREE.Vector3( -3.3, 0,  -53.7),
                new THREE.Vector3( 24.3, 0,  -69.3), // Longa diagonal sudeste
                new THREE.Vector3( 42.5, 0,  -76.9),
                new THREE.Vector3( 49.3, 0, -101.5), // Retificando Norte
                new THREE.Vector3( 56.9, 0, -126.9),
                new THREE.Vector3( 54.1, 0, -154.2),
                // PONTO FINAL (Sul-Leste)
                new THREE.Vector3( 54.1, 0, -163.1),
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

            // Pequeno delay dramático antes de dar o controle
            await sleep(1500); 
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
                // MODO 2.5D ORIGINAL (Câmera Trilho)
                if (left) { 
                    this.pathProgress -= 0.08 * delta; 
                    this.facingRight = false; 
                } else if (right) { 
                    this.pathProgress += 0.08 * delta; 
                    this.facingRight = true; 
                }

                this.pathProgress = THREE.MathUtils.clamp(this.pathProgress, 0, 1);
                const curvePoint = this.pathCurve.getPointAt(this.pathProgress);
                const tangent = this.pathCurve.getTangentAt(this.pathProgress);

                if (jump && this.onGround) { this.vy = JUMP_FORCE; this.onGround = false; }
                this.vy += GRAVITY;
                this.playerY += this.vy;

                let groundY = -5;
                if (this.mapMesh) {
                    const rayOrigin = new THREE.Vector3(curvePoint.x, 200, curvePoint.z);
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

                if (this.playerY < groundY) { 
                    this.playerY = groundY; 
                    this.vy = 0; 
                    this.onGround = true; 
                } else if (this.playerY > groundY + 0.1) {
                    this.onGround = false;
                }

                this.playerGroup.position.set(curvePoint.x, this.playerY, curvePoint.z);

                const lookPos = new THREE.Vector3().copy(this.playerGroup.position).add(tangent);
                if (!this.facingRight) lookPos.copy(this.playerGroup.position).sub(tangent);
                this.playerGroup.lookAt(lookPos);

                const up = new THREE.Vector3(0, 1, 0);
                const offsetDir = new THREE.Vector3().crossVectors(tangent, up).normalize();
                const camDist = 18;
                const camHeight = 12;
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

