// Life Echoes v1.1 - Stable Script
// Versão sem módulos (ESM) para funcionamento em qualquer servidor (GitHub Pages, Vercel, etc)

(function() {
    class Game {
        constructor() {
            this.canvas = document.querySelector('#game-canvas');
            this.renderer = null;
            this.scene = null;
            this.camera = null;
            this.controls = null;
            this.clock = new THREE.Clock();
            
            // Game State
            this.state = 'SPLASH';
            this.energy = 100;
            this.threat = 0;
            this.fruitsCollected = 0;
            
            // Objects
            this.player = null;
            this.trees = [];
            this.fruits = [];
            this.drones = [];
            this.competitors = [];
            this.particles = null;

            this.init();
        }

        init() {
            // Scene setup
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x0a110d);
            this.scene.fog = new THREE.FogExp2(0x0a110d, 0.015);

            // Camera
            this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            this.camera.position.set(0, 50, 100);
            
            // Renderer
            this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.shadowMap.enabled = true;

            // Lights
            const ambient = new THREE.AmbientLight(0xffffff, 0.4);
            this.scene.add(ambient);
            this.sun = new THREE.DirectionalLight(0xfff5e1, 1.2);
            this.sun.position.set(50, 100, 50);
            this.sun.castShadow = true;
            this.scene.add(this.sun);

            // Controls (Using Global Version)
            if (typeof THREE.OrbitControls !== 'undefined') {
                this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            } else if (typeof OrbitControls !== 'undefined') {
                this.controls = new OrbitControls(this.camera, this.renderer.domElement);
            }

            if (this.controls) {
                this.controls.enableDamping = true;
                this.controls.autoRotate = true;
                this.controls.autoRotateSpeed = 0.5;
                this.controls.enableZoom = false;
                this.controls.target.set(0, 10, 0);
            }

            this.createGround();
            this.createForest(150);
            this.createPlayer();
            this.createBackgroundParticles();
            this.bindEvents();
            this.animate();
            this.simulateLoading();
        }

        createBackgroundParticles() {
            const count = 1000;
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(count * 3);
            for (let i = 0; i < count * 3; i++) positions[i] = (Math.random() - 0.5) * 300;
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const material = new THREE.PointsMaterial({ size: 0.5, color: 0x6de2a2, transparent: true, opacity: 0.4 });
            this.particles = new THREE.Points(geometry, material);
            this.scene.add(this.particles);
        }

        createGround() {
            const geometry = new THREE.PlaneBufferGeometry(1000, 1000, 30, 30);
            geometry.rotateX(-Math.PI / 2);
            const material = new THREE.MeshStandardMaterial({ color: 0x124d2f, flatShading: true });
            const ground = new THREE.Mesh(geometry, material);
            ground.receiveShadow = true;
            this.scene.add(ground);
        }

        createTree(x, z) {
            const group = new THREE.Group();
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.6, 8, 5), new THREE.MeshStandardMaterial({ color: 0x3d2b1f }));
            trunk.position.y = 4; trunk.castShadow = true;
            group.add(trunk);
            const leafMat = new THREE.MeshStandardMaterial({ color: 0x224422, flatShading: true });
            const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(Math.random() * 2 + 3, 0), leafMat);
            leaves.position.y = 10; leaves.castShadow = true;
            group.add(leaves);
            group.position.set(x, 0, z);
            group.scale.setScalar(Math.random() * 0.5 + 0.8);
            this.scene.add(group);
            this.trees.push({ mesh: group, leafMat: leafMat });
            if (Math.random() > 0.8) this.spawnFruit(x, z);
        }

        spawnFruit(x, z) {
            const fruit = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ color: 0xff4d00, emissive: 0xff4d00, emissiveIntensity: 0.5 }));
            fruit.position.set(x + (Math.random()-0.5)*3, 8 + Math.random()*2, z + (Math.random()-0.5)*3);
            this.scene.add(fruit);
            this.fruits.push(fruit);
        }

        createForest(count) {
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const r = 30 + Math.random() * 150;
                this.createTree(Math.cos(angle) * r, Math.sin(angle) * r);
            }
            this.createDrones(8);
        }

        createDrones(count) {
            for (let i = 0; i < count; i++) {
                const drone = new THREE.Mesh(new THREE.OctahedronGeometry(1.5, 0), new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000 }));
                drone.position.set((Math.random()-0.5)*300, 15 + Math.random()*10, (Math.random()-0.5)*300);
                this.scene.add(drone);
                this.drones.push({ mesh: drone, speed: 0.05 + Math.random()*0.02 });
            }
        }

        createPlayer() {
            this.player = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color: 0xff9900 });
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.8), mat);
            body.castShadow = true;
            this.player.add(body);
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), mat);
            head.position.set(0, 0.6, 1);
            this.player.add(head);
            this.player.position.y = 1;
            this.player.velocity = new THREE.Vector3();
            this.scene.add(this.player);
        }

        bindEvents() {
            this.keys = {};
            window.addEventListener('keydown', (e) => this.keys[e.key] = true);
            window.addEventListener('keyup', (e) => this.keys[e.key] = false);
            window.addEventListener('resize', () => {
                this.camera.aspect = window.innerWidth / window.innerHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(window.innerWidth, window.innerHeight);
            });

            document.getElementById('start-btn').addEventListener('click', () => this.startGame());
            document.getElementById('manifesto-btn').addEventListener('click', () => {
                document.getElementById('manifesto-modal').classList.remove('hidden');
                document.getElementById('manifesto-modal').classList.add('active');
            });
            document.getElementById('close-manifesto').addEventListener('click', () => {
                document.getElementById('manifesto-modal').classList.remove('active');
                document.getElementById('manifesto-modal').classList.add('hidden');
            });
            document.getElementById('restart-btn').addEventListener('click', () => location.reload());
        }

        simulateLoading() {
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 30;
                if (progress >= 100) { progress = 100; clearInterval(interval); }
                document.getElementById('loading-inner').style.width = `${progress}%`;
            }, 100);
        }

        startGame() {
            this.state = 'PLAYING';
            document.getElementById('splash-screen').classList.add('hidden');
            document.getElementById('hud').classList.remove('hidden');
            if (this.controls) this.controls.autoRotate = false;
            this.camera.position.set(0, 10, 20);
        }

        endGame(msg) {
            this.state = 'END';
            document.getElementById('hud').classList.add('hidden');
            document.getElementById('end-screen').classList.remove('hidden');
            document.getElementById('final-message').innerText = msg;
            document.getElementById('recap-fruits').innerText = this.fruitsCollected;
        }

        updateControls() {
            if (this.state !== 'PLAYING') return;
            const dir = new THREE.Vector3();
            this.camera.getWorldDirection(dir);
            dir.y = 0; dir.normalize();
            const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();

            const speed = 0.25;
            if (this.keys['w']) this.player.position.addScaledVector(dir, speed);
            if (this.keys['s']) this.player.position.addScaledVector(dir, -speed);
            if (this.keys['a']) this.player.position.addScaledVector(side, -speed);
            if (this.keys['d']) this.player.position.addScaledVector(side, speed);
            if (this.keys[' '] && this.player.position.y <= 1.1) this.player.velocity.y = 0.35;

            this.player.position.y += this.player.velocity.y;
            if (this.player.position.y > 1) this.player.velocity.y -= 0.018;
            else { this.player.position.y = 1; this.player.velocity.y = 0; }

            this.camera.position.lerp(this.player.position.clone().add(new THREE.Vector3(0, 12, 22)), 0.08);
            if (this.controls) this.controls.target.lerp(this.player.position, 0.1);
        }

        checkCollisions() {
            this.fruits.forEach((f, i) => {
                if (this.player.position.distanceTo(f.position) < 2.5) {
                    this.scene.remove(f); this.fruits.splice(i, 1);
                    this.fruitsCollected++; this.energy = Math.min(100, this.energy + 15);
                    if (this.fruitsCollected % 5 === 0) this.degrade();
                }
            });
            this.energy -= 0.03;
            if (this.energy <= 0) this.endGame("Sua energia se esgotou.");
        }

        degrade() {
            this.threat += 10;
            this.scene.fog.color.lerp(new THREE.Color(0x333333), 0.2);
            this.trees.forEach(t => { if (Math.random() > 0.4) t.leafMat.color.lerp(new THREE.Color(0x444444), 0.3); });
        }

        animate() {
            requestAnimationFrame(() => this.animate());
            if (this.state === 'PLAYING') {
                this.updateControls();
                this.checkCollisions();
                this.drones.forEach(d => {
                    const vec = new THREE.Vector3().subVectors(this.player.position, d.mesh.position).normalize();
                    if (this.threat >= 0) d.mesh.position.addScaledVector(vec, d.speed);
                    if (d.mesh.position.distanceTo(this.player.position) < 3) this.endGame("Caputurado pela vigilância industrial.");
                });
                document.getElementById('energy-inner').style.width = `${this.energy}%`;
            }
            if (this.particles) this.particles.rotation.y += 0.001;
            if (this.controls) this.controls.update();
            this.renderer.render(this.scene, this.camera);
        }
    }

    // Inicializa o jogo quando o DOM estiver pronto
    window.onload = () => { new Game(); };
})();
