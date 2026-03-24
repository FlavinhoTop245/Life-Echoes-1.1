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
            this.state    = 'LOADING'; // LOADING | CUTSCENE | PLAYING | PHASEDONE

            // Player physics
            this.vx        = 0;
            this.vy        = 0;
            this.onGround  = false;
            this.facingRight = true;

            // Collections
            this.fruits     = []; // { mesh, x, y, collected }
            
            this.mapMesh    = null;
            this.mapLoaded  = false;
            this.raycaster  = new THREE.Raycaster();

            this.fruitsCollected = 0;
            this.keys = {};

            this.init();
        }

        // ─── INIT ────────────────────────────────────────────────────────────
        init() {
            // Scene
            this.scene = new THREE.Scene();
            this.scene.background = makeColor(0x3a7d44); // will be overridden per state
            this.scene.fog = new THREE.Fog(0x87ceeb, 60, 180);

            // Orthographic camera for 2.5D look
            this.updateCameraProjection();

            // Renderer
            this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.shadowMap.enabled = true;

            // Lights
            const ambient = new THREE.AmbientLight(0xffffff, 0.55);
            this.scene.add(ambient);
            this.sunLight = new THREE.DirectionalLight(0xfff8e1, 1.4);
            this.sunLight.position.set(20, 50, 30);
            this.sunLight.castShadow = true;
            this.scene.add(this.sunLight);
            const fill = new THREE.DirectionalLight(0xb2dfdb, 0.4);
            fill.position.set(-30, 10, -10);
            this.scene.add(fill);

            // Build world
            // Load Custom GLTF Map
            this.loadMap();
            this.buildPlayer();

            // Events
            window.addEventListener('keydown', e => {
                this.keys[e.key.toLowerCase()] = true;
                this.keys[e.code]              = true;
            });
            window.addEventListener('keyup', e => {
                this.keys[e.key.toLowerCase()] = false;
                this.keys[e.code]              = false;
            });
            window.addEventListener('resize', () => this.onResize());



            // Start button
            document.getElementById('start-btn').addEventListener('click', () => {
                if (this.state === 'LOADING' && this.mapLoaded) this.runCutscene();
            });

            // Render loop
            this.loop();
        }

        onResize() {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.updateCameraProjection();
        }

        updateCameraProjection() {
            const aspect = window.innerWidth / window.innerHeight;
            const zoom   = 18; // wider view to see more of the map
            this.camera = new THREE.OrthographicCamera(
                -zoom * aspect, zoom * aspect,
                zoom, -zoom,
                0.1, 600
            );
            this.camera.position.set(0, 10, 50);
            this.camera.lookAt(0, 10, 0);
        }

        // ─── MAP LOADING ───────────────────────────────────────────────────────
        loadMap() {
            const loader = new THREE.GLTFLoader();
            const loadingBar = document.getElementById('loading-inner');
            const loadingLabel = document.getElementById('loading-text-label');
            
            loader.load('low_poly_forest.glb', (gltf) => {
                this.mapMesh = gltf.scene;

                // Auto-fit: scale so the model spans ~200 game units wide
                const box = new THREE.Box3().setFromObject(this.mapMesh);
                const size = box.getSize(new THREE.Vector3());
                const scaleFactor = 200 / Math.max(size.x, 0.001);
                this.mapMesh.scale.setScalar(scaleFactor);

                // Re-center: rest bottom at y=0, center on x=0
                const scaledBox = new THREE.Box3().setFromObject(this.mapMesh);
                this.mapMesh.position.x -= scaledBox.getCenter(new THREE.Vector3()).x;
                this.mapMesh.position.y -= scaledBox.min.y;

                this.scene.add(this.mapMesh);
                this.mapMesh.traverse(child => {
                    if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
                });

                this.mapLoaded = true;
                if (loadingLabel) loadingLabel.innerText = 'Floresta Pronta! Jogue agora.';
                if (loadingBar) loadingBar.style.width = '100%';
            }, (xhr) => {
                if (xhr.lengthComputable) {
                    if (loadingBar) loadingBar.style.width = `${(xhr.loaded / xhr.total) * 100}%`;
                }
            }, (error) => {
                console.error('Error loading custom map:', error);
                
                // Fallback local map when CORS blocks loading via file://
                this.mapMesh = new THREE.Mesh(
                    new THREE.BoxGeometry(200, 10, 20),
                    new THREE.MeshStandardMaterial({ color: 0x33691e, flatShading: true })
                );
                this.mapMesh.position.y = -5;
                this.scene.add(this.mapMesh);
                
                this.mapLoaded = true;
                
                if (loadingLabel) loadingLabel.innerText = 'CORS Erro: Mapa de Teste Carregado.';
                if (loadingBar) loadingBar.style.width = '100%';
            });
        }

        // ─── PLAYER (Mico-Leão-Dourado) ──────────────────────────────────────
        buildPlayer() {
            this.playerGroup = new THREE.Group();

            const mat = new THREE.MeshStandardMaterial({ color: 0xf9a825, flatShading: true }); // golden
            const darkMat = new THREE.MeshStandardMaterial({ color: 0x6d3b07, flatShading: true });

            // Body
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.6), mat);
            body.position.y = 0.5;
            body.castShadow = true;
            this.playerGroup.add(body);

            // Head
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.7, 0.65), mat);
            head.position.set(0, 1.25, 0);
            head.castShadow = true;
            this.playerGroup.add(head);

            // Mane (fluffy sides)
            const maneMat = new THREE.MeshStandardMaterial({ color: 0xffb300, flatShading: true });
            [-0.5, 0.5].forEach(ox => {
                const mane = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), maneMat);
                mane.position.set(ox, 1.2, 0);
                this.playerGroup.add(mane);
            });

            // Eyes
            const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
            [-0.2, 0.2].forEach(ox => {
                const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 5), eyeMat);
                eye.position.set(ox, 1.35, 0.35);
                this.playerGroup.add(eye);
            });

            // Tail
            const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.2, 5), darkMat);
            tail.position.set(0, 0.1, -0.5);
            tail.rotation.x = Math.PI / 4;
            this.playerGroup.add(tail);

            // Start position — hides off-screen during cutscene
            this.playerGroup.position.set(-999, 0, 0);
            this.scene.add(this.playerGroup);

            // Physics state
            this.playerX = 0;
            this.playerY = 2;
        }



        // ─── CUTSCENE ────────────────────────────────────────────────────────
        async runCutscene() {
            this.state = 'CUTSCENE';
            await hideSplash();

            // Start high so player falls down onto the map via raycaster gravity
            this.playerX = 0;
            this.playerY = 80;
            this.playerGroup.position.set(this.playerX, this.playerY, 0);

            // Camera: pan to map center height
            await this.panCamera(0, 12, 1800);

            this.state = 'PLAYING';
        }



        panCamera(targetX, targetY, duration) {
            return new Promise(resolve => {
                const startX = this.camera.position.x;
                const startY = this.camera.position.y;
                const start  = performance.now();
                const tick   = (now) => {
                    const t    = Math.min((now - start) / duration, 1);
                    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOut
                    this.camera.position.x = startX + (targetX - startX) * ease;
                    this.camera.position.y = startY + (targetY - startY) * ease;
                    this.camera.lookAt(this.camera.position.x, this.camera.position.y, 0);
                    if (t < 1) requestAnimationFrame(tick);
                    else resolve();
                };
                requestAnimationFrame(tick);
            });
        }

        // ─── GAMEPLAY UPDATE ─────────────────────────────────────────────────
        updatePlaying(delta) {
            // Horizontal movement
            const left  = this.keys['a'] || this.keys['arrowleft']  || this.keys['ArrowLeft'];
            const right = this.keys['d'] || this.keys['arrowright'] || this.keys['ArrowRight'];
            const jump  = this.keys[' '] || this.keys['w']          || this.keys['arrowup'] || this.keys['ArrowUp'];

            this.vx = 0;
            if (left)  { this.vx = -MOVE_SPEED; this.facingRight = false; }
            if (right) { this.vx =  MOVE_SPEED; this.facingRight = true;  }
            if (jump && this.onGround) { this.vy = JUMP_FORCE; this.onGround = false; }

            // Gravity
            this.vy += GRAVITY;

            // Apply velocity
            this.playerX += this.vx;
            this.playerY += this.vy;

            // Platform collision using Raycaster (Dynamic ground detection)
            this.onGround = false;
            let floorY = -100;
            
            if (this.mapMesh) {
                // Raycast downwards from slightly above the player
                const origin = new THREE.Vector3(this.playerX + PLAYER_W / 2, this.playerY + 2.0, 0);
                const dir = new THREE.Vector3(0, -1, 0);
                this.raycaster.set(origin, dir);
                
                // Intersect with map meshes
                const intersects = this.raycaster.intersectObject(this.mapMesh, true);
                if (intersects.length > 0) {
                    floorY = intersects[0].point.y; // The highest point directly under the player
                }
            }

            // Hit ground
            if (this.vy <= 0 && this.playerY <= floorY) {
                this.playerY = floorY;
                this.vy = 0;
                this.onGround = true;
            }

            // Death zone (fell below map)
            if (this.playerY < -20) {
                this.playerY = -0.6;
                this.playerX = 0;
                this.vy = 0;
                this.vx = 0;
            }

            // Left boundary
            if (this.playerX < -10) this.playerX = -10;

            // Update mesh position (player pivot is at feet)
            this.playerGroup.position.set(this.playerX + PLAYER_W / 2, this.playerY, 0);
            this.playerGroup.scale.x = this.facingRight ? 1 : -1;

            // Oscillate tail / bob slightly
            const t = this.clock.getElapsedTime();
            this.playerGroup.position.y += Math.sin(t * 8) * (this.onGround && (left || right) ? 0.04 : 0);

            // Camera follows player X only (fixed Y offset)
            const targetCamX = this.playerX + PLAYER_W / 2;
            const targetCamY = Math.max(8, this.playerY + 10);
            this.camera.position.x += (targetCamX - this.camera.position.x) * 0.1;
            this.camera.position.y += (targetCamY - this.camera.position.y) * 0.06;
            this.camera.lookAt(this.camera.position.x, this.camera.position.y, 0);



            // Fruit collection
            this.fruits.forEach(fr => {
                if (fr.collected) return;
                if (aabbOverlap(px, py, PLAYER_W, PLAYER_H, fr.x, fr.y, fr.w, fr.h)) {
                    fr.collected = true;
                    this.scene.remove(fr.mesh);
                    this.fruitsCollected++;
                }
            });

            // Spin uncollected fruits
            this.fruits.forEach(fr => {
                if (!fr.collected) fr.mesh.rotation.y += 0.04;
            });
        }



        // ─── MAIN LOOP ───────────────────────────────────────────────────────
        loop() {
            requestAnimationFrame(() => this.loop());

            const delta = this.clock.getDelta();

            if (this.state === 'PLAYING') {
                this.updatePlaying(delta);
            }

            this.renderer.render(this.scene, this.camera);
        }
    }

    // ─── BOOTSTRAP ─────────────────────────────────────────────────────────────
    window.addEventListener('load', () => new Game());
})();
