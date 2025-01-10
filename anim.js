import * as THREE from "https://unpkg.com/three@latest/build/three.module.js";

let scene, camera, renderer;
let chunks = new Map();
const chunkSize = 200;
const fixedHeight = 30;
const flightSpeed = 0.5;
var noise = new Noise(Math.random());

const flightState = {
  position: new THREE.Vector3(0, fixedHeight, 0),
  rotation: new THREE.Euler(0, 0, 0),
  time: 0,
};

// Tree template geometries and materials
const treeTemplates = {
  trunk: null,
  foliage: null,
};

function init() {
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000010, 0.005);

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000010);
  document.body.appendChild(renderer.domElement);

  const moonLight = new THREE.DirectionalLight(0x6666ff, 1.0);
  moonLight.position.set(0.5, 1, -0.5).normalize();
  scene.add(moonLight);

  const frontLight = new THREE.DirectionalLight(0x4444ff, 0.8);
  frontLight.position.set(0, 1, -1).normalize();
  scene.add(frontLight);

  const ambientLight = new THREE.AmbientLight(0x333366, 0.5);
  scene.add(ambientLight);

  initTreeTemplates();
  addStars();

  camera.position.set(0, fixedHeight, 100);
  camera.lookAt(0, fixedHeight, 0);

  setupEventListeners();
  animate();
}

function initTreeTemplates() {
  treeTemplates.trunk = new THREE.CylinderGeometry(0.2, 0.4, 2, 6);
  treeTemplates.foliage = new THREE.ConeGeometry(1.2, 3, 6);
}

function addStars() {
  const starGeometry = new THREE.BufferGeometry();
  const starMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.3, // Increased star size
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true, // Stars get smaller with distance
  });

  const starVertices = [];
  // Create more stars
  for (let i = 0; i < 15000; i++) {
    const x = (Math.random() - 0.5) * 2000;
    // Concentrate more stars above
    const y = Math.random() * 1000 + 200;
    const z = (Math.random() - 0.5) * 2000;
    starVertices.push(x, y, z);
  }

  starGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(starVertices, 3),
  );
  const stars = new THREE.Points(starGeometry, starMaterial);

  // Create a second layer of brighter stars
  const brightStarGeometry = new THREE.BufferGeometry();
  const brightStarMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.5,
    transparent: true,
    opacity: 1.0,
  });

  const brightStarVertices = [];
  for (let i = 0; i < 1000; i++) {
    const x = (Math.random() - 0.5) * 2000;
    const y = Math.random() * 1000 + 200;
    const z = (Math.random() - 0.5) * 2000;
    brightStarVertices.push(x, y, z);
  }

  brightStarGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(brightStarVertices, 3),
  );
  const brightStars = new THREE.Points(brightStarGeometry, brightStarMaterial);

  // Add both star layers to the scene
  scene.add(stars);
  scene.add(brightStars);
}

function getTreePosition(x, z, chunkX, chunkZ) {
  const treeChance = noise.perlin2(x / 100, z / 100);
  const chunkSeed = noise.perlin2(chunkX, chunkZ);
  const randomFactor = noise.perlin2(x, z);
  return treeChance > 0.27 + chunkSeed * randomFactor * 0.1;
}

function generateTerrainChunk(chunkX, chunkZ) {
  const group = new THREE.Group();

  // Generate more interesting terrain
  const geometry = new THREE.PlaneGeometry(chunkSize, chunkSize, 50, 50);
  geometry.rotateX(-Math.PI / 2);

  const vertices = geometry.attributes.position.array;
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i] + chunkX * chunkSize;
    const z = vertices[i + 2] + chunkZ * chunkSize;

    // Multiple layers of noise for more organic terrain
    const largeFeatures = noise.perlin2(x / 400, z / 400) * 40; // Large hills
    const mediumFeatures = noise.perlin2(x / 100, z / 100) * 15; // Medium features
    const smallFeatures = noise.perlin2(x / 30, z / 30) * 5; // Small details
    const microFeatures = noise.perlin2(x / 10, z / 10) * 1; // Micro details

    // Combine features with different weights
    const baseHeight = largeFeatures + mediumFeatures;
    const detail = smallFeatures + microFeatures;

    // Add some erosion-like effects
    const erosion = Math.abs(noise.perlin2(x / 50, z / 50));
    const finalHeight = baseHeight + detail * (1 - erosion * 0.5);

    vertices[i + 1] = finalHeight;
  }

  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0x1d4f25,
    roughness: 0.7,
    metalness: 0.1,
    emissive: 0x112244,
    emissiveIntensity: 0.2,
    flatShading: true,
    transparent: true,
    opacity: 0,
  });

  const terrain = new THREE.Mesh(geometry, material);
  group.add(terrain);

  // Add trees using deterministic positioning
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x442200,
    roughness: 0.9,
    emissive: 0x221100,
    emissiveIntensity: 0.1,
  });

  const foliageMaterial = new THREE.MeshStandardMaterial({
    color: 0x224422,
    roughness: 0.8,
    emissive: 0x112211,
    emissiveIntensity: 0.1,
  });

  // Grid-based tree placement with noise
  const gridSize = 10; // Distance between potential tree positions
  for (let x = -chunkSize / 2; x < chunkSize / 2; x += gridSize) {
    for (let z = -chunkSize / 2; z < chunkSize / 2; z += gridSize) {
      const offsetX = (Math.random() - 0.5) * 5; // Offset noise by up to ±2.5 units
      const offsetZ = (Math.random() - 0.5) * 5;

      if (getTreePosition(x + offsetX, z + offsetZ, chunkX, chunkZ)) {
        const worldX = x + offsetX + chunkX * chunkSize;
        const worldZ = z + offsetZ + chunkZ * chunkSize;
        const height = getHeightAt(worldX, worldZ);

        // Create tree with slight variations
        const trunkHeight = 1.5 + noise.perlin2(worldX / 10, worldZ / 10) * 0.5;
        const trunk = new THREE.Mesh(treeTemplates.trunk, trunkMaterial);
        trunk.scale.y = trunkHeight;
        trunk.position.set(x + offsetX, height + trunkHeight, z + offsetZ);

        const foliageScale =
          0.8 + noise.perlin2(worldX / 20, worldZ / 20) * 0.4;
        const foliage = new THREE.Mesh(treeTemplates.foliage, foliageMaterial);
        foliage.scale.set(foliageScale, foliageScale, foliageScale);
        foliage.position.set(
          x + offsetX,
          height + trunkHeight * 2 + 1,
          z + offsetZ,
        );

        group.add(trunk);
        group.add(foliage);
      }
    }
  }

  group.position.set(chunkX * chunkSize, 0, chunkZ * chunkSize);
  group.userData.terrain = terrain;
  return group;
}

function getHeightAt(x, z) {
  const largeFeatures = noise.perlin2(x / 400, z / 400) * 40;
  const mediumFeatures = noise.perlin2(x / 100, z / 100) * 15;
  const smallFeatures = noise.perlin2(x / 30, z / 30) * 5;
  const microFeatures = noise.perlin2(x / 10, z / 10) * 1;

  const baseHeight = largeFeatures + mediumFeatures;
  const detail = smallFeatures + microFeatures;
  const erosion = Math.abs(noise.perlin2(x / 50, z / 50));

  return baseHeight + detail * (1 - erosion * 0.5);
}

function updateTerrain() {
  const currentChunkX = Math.floor(camera.position.x / chunkSize);
  const currentChunkZ = Math.floor(camera.position.z / chunkSize);

  for (let x = -2; x <= 2; x++) {
    for (let z = -2; z <= 2; z++) {
      const chunkKey = `${currentChunkX + x},${currentChunkZ + z}`;
      if (!chunks.has(chunkKey)) {
        const chunk = generateTerrainChunk(
          currentChunkX + x,
          currentChunkZ + z,
        );
        scene.add(chunk);
        chunks.set(chunkKey, { chunk, fadeState: 0 });
      }
    }
  }

  for (const [key, data] of chunks.entries()) {
    const [chunkX, chunkZ] = key.split(",").map(Number);
    const distance = Math.max(
      Math.abs(chunkX - currentChunkX),
      Math.abs(chunkZ - currentChunkZ),
    );

    if (distance > 3) {
      scene.remove(data.chunk);
      chunks.delete(key);
    } else {
      data.fadeState = Math.min(data.fadeState + 0.02, 1);
      data.chunk.userData.terrain.material.opacity = data.fadeState;
    }
  }
}

function updateFlight() {
  flightState.time += 0.005;

  const newX = camera.position.x + Math.sin(flightState.time * 0.5) * 0.2;
  const newZ = camera.position.z - flightSpeed;

  camera.position.set(newX, fixedHeight, newZ);

  const rotationX = Math.sin(flightState.time * 0.5) * 0.05;
  const rotationZ = Math.sin(flightState.time * 0.7) * 0.03;

  camera.rotation.x = rotationX;
  camera.rotation.z = rotationZ;
  camera.rotation.y = Math.sin(flightState.time * 0.3) * 0.05;
}

function setupEventListeners() {
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function animate() {
  requestAnimationFrame(animate);
  updateFlight();
  updateTerrain();
  renderer.render(scene, camera);
}

window.addEventListener("load", init);
