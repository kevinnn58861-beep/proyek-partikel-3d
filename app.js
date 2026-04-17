let scene, camera, renderer, particleSystem;
let particlesCount = 15000;
let targetPositions = [];
let currentPattern = 'sphere';

const videoElement = document.getElementById('video-preview');

// 1. Setup Three.js
function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    createParticles();
    window.addEventListener('resize', onWindowResize);
}

function createParticles() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(particlesCount * 3);
    
    // Inisialisasi posisi awal (acak)
    for (let i = 0; i < particlesCount * 3; i++) {
        pos[i] = (Math.random() - 0.5) * 10;
        targetPositions.push(pos[i]);
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    
    const mat = new THREE.PointsMaterial({
        size: 0.02,
        color: new THREE.Color('#00ffcc'),
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    particleSystem = new THREE.Points(geo, mat);
    scene.add(particleSystem);
}

// 2. Logika Pola (Shape Morphing)
function updatePattern(type) {
    currentPattern = type;
    const positions = particleSystem.geometry.attributes.position.array;
    
    for (let i = 0; i < particlesCount; i++) {
        let x, y, z;
        if (type === 'sphere') {
            const phi = Math.acos(-1 + (2 * i) / particlesCount);
            const theta = Math.sqrt(particlesCount * Math.PI) * phi;
            x = 2 * Math.cos(theta) * Math.sin(phi);
            y = 2 * Math.sin(theta) * Math.sin(phi);
            z = 2 * Math.cos(phi);
        } else if (type === 'box') {
            x = (Math.random() - 0.5) * 4;
            y = (Math.random() - 0.5) * 4;
            z = (Math.random() - 0.5) * 4;
        } else {
            x = (Math.random() - 0.5) * 10;
            y = (Math.random() - 0.5) * 10;
            z = (Math.random() - 0.5) * 10;
        }
        targetPositions[i * 3] = x;
        targetPositions[i * 3 + 1] = y;
        targetPositions[i * 3 + 2] = z;
    }
}

// 3. MediaPipe Hand Tracking
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});

hands.onResults((results) => {
    const posAttr = particleSystem.geometry.attributes.position;
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const hand = results.multiHandLandmarks[0];
        
        // Deteksi Jarak Genggaman (Thumb tip to Pinky tip)
        const dx = hand[4].x - hand[20].x;
        const dy = hand[4].y - hand[20].y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        // Konversi koordinat hand ke world 3D
        const hX = (hand[9].x - 0.5) * -12; // Inverted X
        const hY = (hand[9].y - 0.5) * -8;

        for (let i = 0; i < particlesCount; i++) {
            const ix = i * 3;
            
            // Efek Gestur: Jika distance < 0.2 (Mengepal), partikel tersedot ke tangan
            const lerpSpeed = distance < 0.2 ? 0.15 : 0.05;
            
            // Gerakan menuju target pola + interaksi tangan
            const tx = targetPositions[ix] + hX;
            const ty = targetPositions[ix+1] + hY;

            posAttr.array[ix] += (tx - posAttr.array[ix]) * lerpSpeed;
            posAttr.array[ix+1] += (ty - posAttr.array[ix+1]) * lerpSpeed;
            posAttr.array[ix+2] += (targetPositions[ix+2] - posAttr.array[ix+2]) * lerpSpeed;
        }
    } else {
        // Jika tangan tidak ada, kembali ke pola dasar di tengah
        for (let i = 0; i < particlesCount; i++) {
            const ix = i * 3;
            posAttr.array[ix] += (targetPositions[ix] - posAttr.array[ix]) * 0.02;
            posAttr.array[ix+1] += (targetPositions[ix+1] - posAttr.array[ix+1]) * 0.02;
            posAttr.array[ix+2] += (targetPositions[ix+2] - posAttr.array[ix+2]) * 0.02;
        }
    }
    posAttr.needsUpdate = true;
});

// 4. UI Events
document.getElementById('patternSelect').addEventListener('change', (e) => updatePattern(e.target.value));
document.getElementById('colorPicker').addEventListener('input', (e) => {
    particleSystem.material.color.set(e.target.value);
});

function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    particleSystem.rotation.y += 0.002; // Rotasi halus konstan
    renderer.render(scene, camera);
}

// Start Camera
const cameraInput = new Camera(videoElement, {
    onFrame: async () => { await hands.send({ image: videoElement }); },
    width: 640, height: 480
});

init();
updatePattern('sphere');
cameraInput.start();
animate();
