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
            this.platforms  = []; // { mesh, x, y, w, h }
            this.fruits     = []; // { mesh, x, y, collected }
            this.micoNpcs   = []; // extra mico models for cutscene
            this.bgLayers   = [];

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
            this.buildBackground();
            this.buildLevel();
            this.buildPlayer();
            this.buildNpcMicos();

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

            // Loading bar animation
            this.simulateLoading();

            // Start button
            document.getElementById('start-btn').addEventListener('click', () => {
                if (this.state === 'LOADING') this.runCutscene();
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
            const zoom   = 14; // units visible vertically / 2
            this.camera = new THREE.OrthographicCamera(
                -zoom * aspect, zoom * aspect,
                zoom, -zoom,
                0.1, 500
            );
            // Position camera to look straight at the XY plane, offset in Z
            this.camera.position.set(0, 8, 40);
            this.camera.lookAt(0, 8, 0);
        }

        // ─── BACKGROUND PARALLAX LAYERS ──────────────────────────────────────
        buildBackground() {
            // Sky gradient via scene background (solid color + fog)
            this.scene.background = makeColor(0x87ceeb);

            // Layer 1: distant mountains / hills (Z = -60)
            const hillMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, flatShading: true });
            for (let i = -6; i <= 6; i++) {
                const h = 6 + Math.random() * 10;
                const hill = new THREE.Mesh(
                    new THREE.ConeGeometry(8 + Math.random() * 5, h, 5),
                    hillMat.clone()
                );
                hill.material.color.set(new THREE.Color().setHSL(0.32, 0.5 + Math.random() * 0.2, 0.25 + Math.random() * 0.12));
                hill.position.set(i * 16 + (Math.random() - 0.5) * 8, -3 + h / 2, -60);
                this.scene.add(hill);
                this.bgLayers.push({ mesh: hill, parallaxFactor: 0.08 });
            }

            // Layer 2: mid-forest trees (Z = -30)
            for (let i = -10; i <= 10; i++) {
                const t = this.makeTreeMesh(0.7 + Math.random() * 0.4, 0x388e3c);
                t.position.set(i * 9 + (Math.random() - 0.5) * 4, -2, -30);
                this.scene.add(t);
                this.bgLayers.push({ mesh: t, parallaxFactor: 0.25 });
            }

            // Ground plane
            const ground = new THREE.Mesh(
                new THREE.PlaneGeometry(800, 20),
                new THREE.MeshStandardMaterial({ color: 0x33691e, flatShading: true })
            );
            ground.rotation.x = -Math.PI / 2;
            ground.position.set(0, -2, -5);
            ground.receiveShadow = true;
            this.scene.add(ground);
        }

        makeTreeMesh(scale = 1, leafColor = 0x2e7d32) {
            const g = new THREE.Group();
            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.25 * scale, 0.4 * scale, 5 * scale, 5),
                new THREE.MeshStandardMaterial({ color: 0x5d4037 })
            );
            trunk.position.y = 2.5 * scale;
            trunk.castShadow = true;
            g.add(trunk);
            const leaves = new THREE.Mesh(
                new THREE.IcosahedronGeometry((2.5 + Math.random()) * scale, 0),
                new THREE.MeshStandardMaterial({ color: leafColor, flatShading: true })
            );
            leaves.position.y = (6 + Math.random()) * scale;
            leaves.castShadow = true;
            g.add(leaves);
            return g;
        }

        // ─── LEVEL LAYOUT ────────────────────────────────────────────────────
        buildLevel() {
            // Platform data: [x_center, y_top, width, height, type]
            // type: 'ground' | 'branch' | 'log'
            const pData = [
                // Ground segment
                { x:  0,   y: -2,   w: 60,  h: 2,   type: 'ground' },
                // Right extension (scroll area)
                { x: 60,   y: -2,   w: 50,  h: 2,   type: 'ground' },
                { x: 110,  y: -2,   w: 40,  h: 2,   type: 'ground' },

                // Platforms / branches (staggered heights)
                { x:  8,   y:  5,   w: 8,   h: 1.2, type: 'branch' },
                { x:  20,  y:  8,   w: 7,   h: 1.2, type: 'branch' },
                { x:  31,  y:  5.5, w: 6,   h: 1.2, type: 'branch' },
                { x:  42,  y:  9,   w: 8,   h: 1.2, type: 'branch' },
                { x:  53,  y:  6,   w: 6,   h: 1.2, type: 'branch' },
                { x:  63,  y: 11,   w: 7,   h: 1.2, type: 'branch' },
                { x:  74,  y:  7,   w: 6,   h: 1.2, type: 'branch' },
                { x:  85,  y: 13,   w: 9,   h: 1.2, type: 'branch' },
                { x:  96,  y:  9,   w: 6,   h: 1.2, type: 'branch' },
                { x: 107,  y: 14,   w: 8,   h: 1.2, type: 'branch' },
                { x: 118,  y: 10,   w: 7,   h: 1.2, type: 'branch' },
            ];

            pData.forEach(p => {
                const isGround = p.type === 'ground';
                const color    = isGround ? 0x33691e : 0x5d4037;
                const mesh = new THREE.Mesh(
                    new THREE.BoxGeometry(p.w, p.h, 4),
                    new THREE.MeshStandardMaterial({ color, flatShading: !isGround })
                );
                mesh.position.set(p.x, p.y - p.h / 2, 0);
                mesh.receiveShadow = true;
                mesh.castShadow    = !isGround;
                this.scene.add(mesh);

                // Add canopy trees on top of ground sections
                if (isGround) {
                    const treeCount = Math.floor(p.w / 8);
                    for (let i = 0; i < treeCount; i++) {
                        const tx = p.x - p.w / 2 + 4 + i * 8 + (Math.random() - 0.5) * 3;
                        const tree = this.makeTreeMesh(0.8 + Math.random() * 0.5, 0x388e3c);
                        tree.position.set(tx, p.y, -2 + (Math.random() - 0.5) * 2);
                        this.scene.add(tree);
                    }
                }

                // Store for collision (AABB in XY)
                this.platforms.push({
                    mesh,
                    x: p.x - p.w / 2,
                    y: p.y - p.h,
                    w: p.w,
                    h: p.h,
                    top: p.y  // top surface Y
                });
            });

            // ─── FRUITS (scattered on platforms) ─────────────────────────────
            const fruitPositions = [
                { x:  8,   y:  7.2  },
                { x: 20,   y: 10.2  },
                { x: 31,   y:  7.7  },
                { x: 42,   y: 11.2  },
                { x: 53,   y:  8.2  },
                { x: 63,   y: 13.2  },
                { x: 74,   y:  9.2  },
                { x: 85,   y: 15.2  },
            ];

            fruitPositions.forEach(fp => {
                const fruitMesh = new THREE.Mesh(
                    new THREE.DodecahedronGeometry(0.55, 0),
                    new THREE.MeshStandardMaterial({ color: 0xff6f00, emissive: 0xbf360c, emissiveIntensity: 0.5, flatShading: true })
                );
                fruitMesh.position.set(fp.x, fp.y, 0);
                fruitMesh.castShadow = true;
                this.scene.add(fruitMesh);
                this.fruits.push({ mesh: fruitMesh, x: fp.x - 0.55, y: fp.y - 0.55, w: 1.1, h: 1.1, collected: false });
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

        // ─── NPC MICOS for cutscene ───────────────────────────────────────────
        buildNpcMicos() {
            // Build 3 NPC mico models high in a big intro tree
            const introTree = this.makeTreeMesh(2.5, 0x2e7d32);
            introTree.position.set(-8, -2, 0);
            this.scene.add(introTree);
            this.introTree = introTree;

            const colors = [0xf9a825, 0xffb300, 0xffa000];
            for (let i = 0; i < 3; i++) {
                const npc = this.makeSimpleMico(colors[i]);
                // Start high on the tree
                npc.position.set(-8 + (i - 1) * 0.9, 16 + i * 0.6, 0.3);
                npc.visible = false;
                this.scene.add(npc);
                this.micoNpcs.push(npc);
            }
        }

        makeSimpleMico(color) {
            const g = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color, flatShading: true });
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.7, 0.5), mat);
            body.position.y = 0.35; g.add(body);
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.55), mat);
            head.position.y = 0.95; g.add(head);
            const maneMat = new THREE.MeshStandardMaterial({ color: 0xffb300, flatShading: true });
            const mane = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), maneMat);
            mane.position.set(0, 0.9, 0); g.add(mane);
            return g;
        }

        // ─── LOADING BAR ─────────────────────────────────────────────────────
        simulateLoading() {
            let p = 0;
            const el = document.getElementById('loading-inner');
            const iv = setInterval(() => {
                p += Math.random() * 20;
                if (p >= 100) { p = 100; clearInterval(iv); }
                el.style.width = `${p}%`;
            }, 120);
        }

        // ─── CUTSCENE ────────────────────────────────────────────────────────
        async runCutscene() {
            this.state = 'CUTSCENE';
            await hideSplash();

            // Point camera at intro tree
            this.camera.position.set(-8, 10, 40);
            this.camera.lookAt(-8, 10, 0);

            // Show NPC micos on tree
            this.micoNpcs.forEach(m => m.visible = true);

            await sleep(600);

            // Animate micos descending one by one
            for (let i = 0; i < this.micoNpcs.length; i++) {
                await this.animateMicoDescend(this.micoNpcs[i], 3500);
                await sleep(300);
            }

            // Fade in player at base of intro tree — hide NPC micos
            this.micoNpcs.forEach(m => m.visible = false);
            this.playerX = -6;
            this.playerY = -0.6;
            this.playerGroup.position.set(this.playerX, this.playerY, 0);

            // Camera pan to start of level
            await this.panCamera(0, 4, 1800);

            this.state = 'PLAYING';
        }

        animateMicoDescend(mico, duration) {
            return new Promise(resolve => {
                const startY  = mico.position.y;
                const targetY = -0.8; // ground level
                const start   = performance.now();
                const tick    = (now) => {
                    const t = Math.min((now - start) / duration, 1);
                    const ease = 1 - Math.pow(1 - t, 3);
                    mico.position.y = startY + (targetY - startY) * ease;
                    if (t < 1) requestAnimationFrame(tick);
                    else resolve();
                };
                requestAnimationFrame(tick);
            });
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

            // Platform collision
            this.onGround = false;
            const px = this.playerX;
            const py = this.playerY;

            for (const plat of this.platforms) {
                // Only resolve landing on top (falling down onto platform)
                if (this.vy <= 0 &&
                    px + PLAYER_W > plat.x && px < plat.x + plat.w &&
                    py < plat.top && py + PLAYER_H > plat.top - 0.5) {
                    this.playerY = plat.top;
                    this.vy      = 0;
                    this.onGround = true;
                }
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

            // Parallax background
            this.bgLayers.forEach(layer => {
                layer.mesh.position.x = -targetCamX * layer.parallaxFactor;
            });

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
