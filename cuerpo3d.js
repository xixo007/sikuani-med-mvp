/* Mapa corporal 3D con un cuerpo humano realista (Human Base Meshes de Blender Studio, CC0).
   Todo se carga desde la propia app (three.js y modelos en vendor/ y modelos/), sin internet.
   Expone window.Cuerpo3D y llama a window.setSelectedZone(zona, region, true) al tocar una zona. */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// nodo del modelo -> [zona del formulario, región del perfil clínico]
const ZONAS = {
  Cabeza: ["Cabeza", "Cabeza"],
  Torax: ["Pecho", "Torax"],
  Abdomen: ["Abdomen", "Abdomen"],
  BrazoIzquierdo: ["Extremidades", "ExtremidadesSuperiores"],
  BrazoDerecho: ["Extremidades", "ExtremidadesSuperiores"],
  Piernas: ["Extremidades", "ExtremidadesInferiores"],
};
const PIEL = new THREE.Color("#8d5b43");
const RESALTE = new THREE.Color("#14b8a6");

const escena = document.querySelector("#anatomy-stage");
const lienzo = document.createElement("canvas");
lienzo.className = "cuerpo-3d";
lienzo.setAttribute("role", "img");
lienzo.setAttribute("aria-label", "Cuerpo humano en 3D: toca una zona o arrastra para girarlo");
escena.prepend(lienzo);

const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: "low-power" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const mundo = new THREE.Scene();
const camara = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
camara.position.set(0, 0.95, 4.6);
mundo.add(new THREE.HemisphereLight("#dff4ff", "#3a2a22", 1.6));
const clave = new THREE.DirectionalLight("#fff4e6", 2.4); clave.position.set(-2, 3, 3); mundo.add(clave);
const contra = new THREE.DirectionalLight("#9be7ff", 1.6); contra.position.set(2.5, 2, -3); mundo.add(contra);

const controles = new OrbitControls(camara, lienzo);
controles.target.set(0, 0.9, 0);
controles.enablePan = false;
controles.enableDamping = true;
controles.minDistance = 2.2;
controles.maxDistance = 6;
controles.minPolarAngle = Math.PI * 0.32;
controles.maxPolarAngle = Math.PI * 0.62;

const cargador = new GLTFLoader();
const modelos = {};
let cuerpo = null, esqueleto = null, sexo = "hombre", modo = "piel", regionActiva = null;
let pendiente = false;

function dibujar() {
  if (pendiente) return;
  pendiente = true;
  requestAnimationFrame(() => {
    pendiente = false;
    if (controles.update()) dibujar(); // sigue mientras dura la inercia
    renderer.render(mundo, camara);
  });
}
controles.addEventListener("change", dibujar);

function ajustarTamano() {
  const r = escena.getBoundingClientRect();
  if (!r.width || !r.height) return;
  renderer.setSize(r.width, r.height, false);
  camara.aspect = r.width / r.height;
  camara.updateProjectionMatrix();
  dibujar();
}
new ResizeObserver(ajustarTamano).observe(escena);

async function cargar(nombre) {
  if (!modelos[nombre]) modelos[nombre] = (await cargador.loadAsync(`modelos/${nombre}.glb`)).scene;
  return modelos[nombre];
}

function prepararCuerpo(raiz) {
  raiz.traverse((o) => {
    if (!o.isMesh) return;
    o.material = new THREE.MeshStandardMaterial({ color: PIEL, roughness: 0.62, metalness: 0, emissive: RESALTE, emissiveIntensity: 0 });
  });
}

function encajarEsqueleto() {
  if (!cuerpo || !esqueleto) return;
  esqueleto.scale.setScalar(1);
  esqueleto.position.set(0, 0, 0);
  const bc = new THREE.Box3().setFromObject(cuerpo), be = new THREE.Box3().setFromObject(esqueleto);
  const s = ((bc.max.y - bc.min.y) * 0.975) / (be.max.y - be.min.y);
  esqueleto.scale.setScalar(s);
  const be2 = new THREE.Box3().setFromObject(esqueleto);
  const cc = bc.getCenter(new THREE.Vector3()), ce = be2.getCenter(new THREE.Vector3());
  esqueleto.position.set(cc.x - ce.x, bc.min.y + 0.01 - be2.min.y, cc.z - ce.z);
}

function aplicarModo() {
  if (!cuerpo) return;
  const transparente = modo === "esqueleto";
  cuerpo.traverse((o) => {
    if (!o.isMesh) return;
    o.material.transparent = transparente;
    o.material.opacity = transparente ? 0.12 : 1;
    o.material.depthWrite = !transparente;
    o.material.needsUpdate = true; // sin esto three.js no recompila el material y la piel sigue opaca
  });
  if (esqueleto) esqueleto.visible = transparente;
  resaltar(regionActiva);
}

function resaltar(region) {
  regionActiva = region;
  if (!cuerpo) return;
  const esq = modo === "esqueleto";
  cuerpo.traverse((o) => {
    if (!o.isMesh) return;
    const zona = ZONAS[o.name];
    const elegida = Boolean(zona && region && zona[1] === region);
    o.material.emissiveIntensity = elegida ? (esq ? 0.9 : 0.5) : 0;
    // con el esqueleto solo se ve, como un velo, la zona elegida: el esqueleto no calza exacto con la piel
    o.material.opacity = esq ? (elegida ? 0.28 : 0.04) : 1;
  });
  dibujar();
}

async function ponerSexo(nuevo) {
  sexo = nuevo;
  const raiz = await cargar(`cuerpo_${sexo}`);
  if (cuerpo) mundo.remove(cuerpo);
  cuerpo = raiz;
  if (!cuerpo.userData.preparado) { prepararCuerpo(cuerpo); cuerpo.userData.preparado = true; }
  mundo.add(cuerpo);
  encajarEsqueleto();
  aplicarModo();
  document.querySelectorAll("[data-sexo]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sexo === sexo)));
}

async function ponerModo(nuevo) {
  modo = nuevo;
  if (modo === "esqueleto" && !esqueleto) {
    esqueleto = await cargar("esqueleto");
    esqueleto.traverse((o) => { if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ color: "#e8dcc3", roughness: 0.55 }); });
    mundo.add(esqueleto);
    encajarEsqueleto();
  }
  aplicarModo();
}

// tocar una zona: se distingue de arrastrar para girar
const rayo = new THREE.Raycaster(), puntero = new THREE.Vector2();
let inicio = null;
lienzo.addEventListener("pointerdown", (e) => { inicio = { x: e.clientX, y: e.clientY }; });
lienzo.addEventListener("pointerup", (e) => {
  if (!inicio || Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 6 || !cuerpo) { inicio = null; return; }
  inicio = null;
  const r = lienzo.getBoundingClientRect();
  puntero.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  rayo.setFromCamera(puntero, camara);
  const golpe = rayo.intersectObject(cuerpo, true).find((g) => ZONAS[g.object.name]);
  if (!golpe) return;
  const [zona, region] = ZONAS[golpe.object.name];
  resaltar(region);
  if (typeof window.setSelectedZone === "function") window.setSelectedZone(zona, region, true);
});

document.querySelectorAll("[data-sexo]").forEach((b) => b.addEventListener("click", () => ponerSexo(b.dataset.sexo)));

window.Cuerpo3D = { activo: false, resaltar, ponerModo, ponerSexo, get modo() { return modo; } };

try {
  await ponerSexo("hombre");
  escena.classList.add("con-3d");
  window.Cuerpo3D.activo = true;
  ajustarTamano();
  document.querySelector("#anatomy-mode-label").textContent = "CUERPO 3D · ARRASTRA PARA GIRAR";
  const boton = document.querySelector("#anatomy-view-toggle");
  boton.textContent = "Ver esqueleto";
  boton.setAttribute("aria-pressed", "false");
  try { resaltar(selectedMapRegion); } catch { /* el formulario aún no eligió zona */ }
} catch (error) {
  // sin WebGL o sin modelos: se queda el mapa anterior
  lienzo.remove();
  console.warn("Mapa 3D no disponible:", error);
}
