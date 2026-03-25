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
                    } else {
                        const hud = document.getElementById('coord-hud');
                        if (hud) {
                            hud.style.opacity = '1';
                            hud.innerText = "Modo Debug ON: Voe com WASD. P=Criar Ponto, O=Copiar Rota";
                        }
                    }
                }

                // Ferramenta de Mapeamento de Caminho no Debug
                if (this.debugMode && this.state === 'PLAYING') {
                    if (e.code === 'KeyP') {
                        const vx = parseFloat(this.playerGroup.position.x.toFixed(1));
                        const vz = parseFloat(this.playerGroup.position.z.toFixed(1));

                        if (!this.customPathPoints) {
                            this.customPathPoints = [];
                            this.customPathGroup = new THREE.Group();
                            this.scene.add(this.customPathGroup);
                        }

                        this.customPathPoints.push(new THREE.Vector3(vx, 0, vz));

                        // Dropar uma esfera amarela (waypoint)
                        const geo = new THREE.SphereGeometry(1.5, 8, 8);
                        const mat = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true });
                        const marker = new THREE.Mesh(geo, mat);
                        marker.position.set(vx, this.playerGroup.position.y, vz);
                        this.customPathGroup.add(marker);

                        const hud = document.getElementById('coord-hud');
                        if (hud) hud.innerText = `Ponto Adicionado: X:${vx} Z:${vz} (Total: ${this.customPathPoints.length})`;
                        console.log(`Ponto gravado: new THREE.Vector3(${vx}, 0, ${vz})`);
                    }

                    if (e.code === 'KeyO') {
                        if (!this.customPathPoints || this.customPathPoints.length === 0) {
                            console.log("Nenhum ponto gravado ainda. Pressione P para gravar pontos.");
                            return;
                        }
                        let txt = "const points = [\n";
                        this.customPathPoints.forEach(p => {
                            txt += `    new THREE.Vector3(${p.x}, 0, ${p.z}),\n`;
                        });
                        txt += "];";

                        navigator.clipboard.writeText(txt).then(() => {
                            console.log("CÓDIGO COPIADO!");
                            console.log(txt);
                            const hud = document.getElementById('coord-hud');
                            if (hud) hud.innerText = `ROTA COPIADA PARA A ÁREA DE TRANSFERÊNCIA! (${this.customPathPoints.length} pontos)`;
                        }).catch(err => {
                            console.log("Erro ao copiar. Segue o código:\n" + txt);
                        });
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
            const sfxSlider = document.getElementById('sfx-slider');
            const musicPct = document.getElementById('music-vol-percent');
            const sfxPct = document.getElementById('sfx-vol-percent');

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
            this.smoothedGroundY = 0; // Altura suavizada do chão para evitar oscilação

            this.buildPath();
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
                // Modo 2.5D Real - Câmera Direcional Fixa
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
                    this.pathProgress -= 0.035 * delta; // Velocidade reduzida
                    this.facingRight = false;
                } else if (right) {
                    this.pathProgress += 0.035 * delta; // Velocidade reduzida
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
                    if (intersects.length > 0) {
                        groundY = intersects.reduce((lowest, hit) =>
                            hit.point.y < lowest ? hit.point.y : lowest,
                            intersects[0].point.y
                        );
                        groundY += 1.0; // Offset para ficar acima do solo
                    }
                }

                // Suavização forte: o chão "efetivo" muda muito devagar,
                // eliminando os solavancos do terreno low-poly.
                this.smoothedGroundY = THREE.MathUtils.lerp(this.smoothedGroundY, groundY, 0.03);

                if (this.playerY < this.smoothedGroundY) {
                    this.playerY = this.smoothedGroundY;
                    this.vy = 0;
                    this.onGround = true;
                } else if (this.playerY > this.smoothedGroundY + 0.1) {
                    this.onGround = false;
                }

                this.playerGroup.position.set(curvePoint.x, this.playerY, curvePoint.z);

                // O personagem continua olhando para frente na tangente do caminho
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

