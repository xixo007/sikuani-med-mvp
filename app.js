const clinicalData = JSON.parse(document.querySelector("#clinical-data").textContent);
const phrases = clinicalData.frases_rapidas;
const clinicalVocabulary = clinicalData.vocabulario_clinico;
const patientResponses = clinicalData.respuestas_paciente_sikuani;

const categoryNames = ["Todas", "Urgencia", "Síntomas", "Materno", "Pediatría", "Tratamiento"];
const priorityMeta = {
  I: { color: "#b52d2d", name: "Rojo", description: "Crítico" },
  II: { color: "#c85d24", name: "Naranja", description: "Grave" },
  III: { color: "#a77b0b", name: "Amarillo", description: "Urgente" },
  IV: { color: "#28754a", name: "Verde", description: "Estándar" },
};
const storageKey = "sikuani-med-triage-patients-v1";
const seedKey = "sikuani-med-suite-v2-seeded";
let patients = [];
let activeCategory = "Todas";
let speechRate = 1;
let voiceGender = "female";
let speechVoices = [];
let activeSpeechVoice = null;
let speechRequestId = 0;
let activeSpeechButton = null;
let selectedZone = "General";
let selectedMapRegion = null;
let storageAvailable = true;
let conversationEntries = [];
let pendingAlert = null;
let pendingTranscript = "";
let activeRecognition = null;
let waveFrame = 0;
let wavePhase = 0;
let waveChannel = "doctor";
let activeQuickCaseId = null;
let simulationTimer = 0;
let selectedEvaPain = 1;
let selectedZoneSymptom = "";
let anatomyMode = "scanner";
let anatomyYaw = 0;
let anatomyRenderer = null;
let anatomyAnimationFrame = 0;
let anatomyDragStart = null;

const biometricZoneProfiles = {
  General: {
    region: "General", title: "Evaluación general", zone: "General",
    questionEs: "¿Qué siente y desde cuándo?", questionSik: "Detsa jiwi juka?", phonetic: "Det-sa ji-wi ju-ka",
    symptoms: ["Malestar general", "Fiebre", "Debilidad"],
  },
  Cabeza: {
    region: "Cabeza", title: "Cabeza / Neurología", zone: "Cabeza",
    questionEs: "¿Le duele la cabeza o siente mareo?", questionSik: "Pemata juka?", phonetic: "Pe-ma-ta ju-ka",
    symptoms: ["Dolor de cabeza", "Mareo", "Visión borrosa"],
  },
  Torax: {
    region: "Torax", title: "Tórax / Cardiorrespiratorio", zone: "Pecho",
    questionEs: "¿Le duele el pecho o le falta el aire?", questionSik: "Pexania juka neba? Aje yabara?", phonetic: "Pe-xa-nia ju-ka ne-ba · A-je ya-ba-ra",
    symptoms: ["Dolor torácico", "Falta de aire", "Palpitaciones"],
  },
  Abdomen: {
    region: "Abdomen", title: "Abdomen / Digestivo y materno", zone: "Abdomen",
    questionEs: "¿Tiene dolor de estómago, vómito o diarrea?", questionSik: "Pekotsi juka neba? Yaka o tseka?", phonetic: "Pe-ko-tsi ju-ka ne-ba · Ya-ka o tse-ka",
    symptoms: ["Dolor abdominal", "Vómito o diarrea", "Embarazo / contracciones"],
  },
  ExtremidadesSuperiores: {
    region: "ExtremidadesSuperiores", title: "Brazo / Extremidad superior", zone: "Extremidades",
    questionEs: "¿Dónde le duele el brazo? Señale con la mano.", questionSik: "Detsa jiwi juka? Kbepona.", phonetic: "Det-sa ji-wi ju-ka · K-be-po-na",
    symptoms: ["Herida", "Sangrado", "Dolor o debilidad"],
  },
  ExtremidadesInferiores: {
    region: "ExtremidadesInferiores", title: "Piernas / Extremidad inferior", zone: "Extremidades",
    questionEs: "¿Le mordió una serpiente o tiene una herida en la pierna?", questionSik: "Kowibo nekana taxuipa?", phonetic: "Ko-wi-bo ne-ka-na ta-xui-pa",
    symptoms: ["Mordedura de serpiente", "Sangrado", "Fractura"],
  },
};

const phraseList = document.querySelector("#phrase-list");
const patientQueue = document.querySelector("#patient-queue");
const attendedQueue = document.querySelector("#attended-queue");
const triageForm = document.querySelector("#triage-form");
const anatomyCanvas = document.querySelector("#anatomy-canvas");
const triageStatus = document.querySelector("#triage-status");
const translatorStatus = document.querySelector("#translator-status");
const searchInput = document.querySelector("#phrase-search");
const patientDialog = document.querySelector("#patient-dialog");
const voiceConsole = document.querySelector("#voice-console");
const voiceStatus = document.querySelector("#voice-status");
const voiceGenderSelect = document.querySelector("#voice-gender");
const voiceListSelect = document.querySelector("#voice-list");
const voiceEngineModeSelect = document.querySelector("#voice-engine-mode");
const voiceTestButton = document.querySelector("#voice-test-button");
const voiceEngineLabel = document.querySelector("#voice-engine-label");
const localTtsPlayer = document.querySelector("#local-tts-player");
const waveformCanvas = document.querySelector("#voice-waveform");
const waveCaption = document.querySelector("#wave-caption");
const conversationHistory = document.querySelector("#conversation-history");
const voiceOrb = document.querySelector("#voice-orb");

function setVoiceStatus(message, active = false, channel = "doctor") {
  voiceStatus.textContent = message;
  waveCaption.textContent = active
    ? channel === "patient" ? "ESCUCHANDO SIKUANI..." : "ESCUCHANDO AL MÉDICO..."
    : "";
  voiceConsole.classList.toggle("is-listening", active);
  voiceConsole.dataset.channel = channel;
  waveChannel = channel;
  document.querySelector(".voice-orb-zone").classList.toggle("is-active", active);
  voiceOrb.classList.toggle("is-active", active);
  document.querySelector("#doctor-mic").classList.toggle("is-recording", active && channel === "doctor");
  document.querySelector("#patient-mic").classList.toggle("is-recording", active && channel === "patient");
  if (active) startWaveform();
  else stopWaveform();
}

function createSphereMesh(gl) {
  const positions = [];
  const normals = [];
  const indices = [];
  const latitudeBands = 24;
  const longitudeBands = 32;
  for (let latitude = 0; latitude <= latitudeBands; latitude += 1) {
    const theta = latitude * Math.PI / latitudeBands;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    for (let longitude = 0; longitude <= longitudeBands; longitude += 1) {
      const phi = longitude * Math.PI * 2 / longitudeBands;
      const x = Math.cos(phi) * sinTheta;
      const y = cosTheta;
      const z = Math.sin(phi) * sinTheta;
      positions.push(x, y, z);
      normals.push(x, y, z);
    }
  }
  for (let latitude = 0; latitude < latitudeBands; latitude += 1) {
    for (let longitude = 0; longitude < longitudeBands; longitude += 1) {
      const first = latitude * (longitudeBands + 1) + longitude;
      const second = first + longitudeBands + 1;
      indices.push(first, second, first + 1, second, second + 1, first + 1);
    }
  }
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  const normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  return { positionBuffer, normalBuffer, indexBuffer, indexCount: indices.length };
}

function compileAnatomyShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message || "No se pudo preparar el visor anatómico.");
  }
  return shader;
}

function makeAnatomyParts() {
  const parts = [
    { zone: "Cabeza", offset: [0, .76, 0], scale: [.15, .19, .13], color: "#c9eafa" },
    { zone: "General", offset: [0, .53, 0], scale: [.083, .12, .082], color: "#a8d4e8" },
    { zone: "Torax", offset: [0, .30, 0], scale: [.275, .25, .16], color: "#b7e1f1" },
    { zone: "Torax", offset: [-.13, .29, -.015], scale: [.13, .17, .14], color: "#c1e7f3" },
    { zone: "Torax", offset: [.13, .29, -.015], scale: [.13, .17, .14], color: "#c1e7f3" },
    { zone: "Abdomen", offset: [0, -.045, 0], scale: [.22, .26, .13], color: "#b9dfed" },
    { zone: "Abdomen", offset: [0, -.30, 0], scale: [.23, .16, .14], color: "#add7e9" },
    { zone: "Torax", offset: [-.235, .38, 0], scale: [.16, .14, .13], color: "#c2e7f4" },
    { zone: "Torax", offset: [.235, .38, 0], scale: [.16, .14, .13], color: "#c2e7f4" },
    { zone: "ExtremidadesSuperiores", offset: [-.37, .19, 0], scale: [.105, .22, .10], color: "#b8e0ef" },
    { zone: "ExtremidadesSuperiores", offset: [.37, .19, 0], scale: [.105, .22, .10], color: "#b8e0ef" },
    { zone: "ExtremidadesSuperiores", offset: [-.43, -.075, 0], scale: [.083, .19, .083], color: "#a9d6e8" },
    { zone: "ExtremidadesSuperiores", offset: [.43, -.075, 0], scale: [.083, .19, .083], color: "#a9d6e8" },
    { zone: "ExtremidadesSuperiores", offset: [-.46, -.27, 0], scale: [.073, .19, .073], color: "#b5deed" },
    { zone: "ExtremidadesSuperiores", offset: [.46, -.27, 0], scale: [.073, .19, .073], color: "#b5deed" },
    { zone: "ExtremidadesSuperiores", offset: [-.47, -.46, -.005], scale: [.072, .105, .05], color: "#c7e6f1" },
    { zone: "ExtremidadesSuperiores", offset: [.47, -.46, -.005], scale: [.072, .105, .05], color: "#c7e6f1" },
    { zone: "ExtremidadesInferiores", offset: [-.13, -.49, 0], scale: [.12, .24, .115], color: "#b6ddec" },
    { zone: "ExtremidadesInferiores", offset: [.13, -.49, 0], scale: [.12, .24, .115], color: "#b6ddec" },
    { zone: "ExtremidadesInferiores", offset: [-.14, -.72, -.005], scale: [.092, .105, .095], color: "#c4e5f0" },
    { zone: "ExtremidadesInferiores", offset: [.14, -.72, -.005], scale: [.092, .105, .095], color: "#c4e5f0" },
    { zone: "ExtremidadesInferiores", offset: [-.145, -.84, 0], scale: [.097, .17, .09], color: "#b2ddec" },
    { zone: "ExtremidadesInferiores", offset: [.145, -.84, 0], scale: [.097, .17, .09], color: "#b2ddec" },
    { zone: "ExtremidadesInferiores", offset: [-.15, -.946, -.035], scale: [.092, .055, .145], color: "#c4e5f0" },
    { zone: "ExtremidadesInferiores", offset: [.15, -.946, -.035], scale: [.092, .055, .145], color: "#c4e5f0" },
  ];
  const organs = [
    { zone: "Cabeza", offset: [0, .775, -.12], scale: [.08, .105, .035], color: "#f3a4b4", organ: true, name: "brain" },
    { zone: "Torax", offset: [-.085, .245, -.137], scale: [.072, .145, .035], color: "#53b9d4", organ: true, name: "lung" },
    { zone: "Torax", offset: [.085, .245, -.137], scale: [.072, .145, .035], color: "#53b9d4", organ: true, name: "lung" },
    { zone: "Torax", offset: [0, .18, -.18], scale: [.052, .067, .04], color: "#f06e78", organ: true, name: "heart" },
    { zone: "Abdomen", offset: [-.035, -.065, -.12], scale: [.095, .11, .038], color: "#e9a56f", organ: true, name: "stomach" },
  ];
  return { parts, organs };
}

function initAnatomyRenderer() {
  if (!anatomyCanvas) return;
  try {
    const gl = anatomyCanvas.getContext("webgl", { alpha: true, antialias: true, powerPreference: "low-power", preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL no disponible");
    const vertexSource = `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      uniform vec3 uOffset;
      uniform vec3 uScale;
      uniform float uYaw;
      varying vec3 vNormal;
      varying vec3 vColor;
      varying float vSelected;
      varying float vOrgan;
      uniform vec3 uColor;
      uniform float uSelected;
      uniform float uOrgan;
      void main() {
        vec3 point = aPosition * uScale;
        point.y *= 0.84;
        float c = cos(uYaw);
        float s = sin(uYaw);
        point = vec3(c * point.x + s * point.z, point.y, -s * point.x + c * point.z) + uOffset;
        vec3 normal = normalize(vec3(aNormal.x / uScale.x, aNormal.y / uScale.y, aNormal.z / uScale.z));
        vNormal = normalize(vec3(c * normal.x + s * normal.z, normal.y, -s * normal.x + c * normal.z));
        vColor = uColor;
        vSelected = uSelected;
        vOrgan = uOrgan;
        gl_Position = vec4(point, 1.0);
      }
    `;
    const fragmentSource = `
      precision mediump float;
      varying vec3 vNormal;
      varying vec3 vColor;
      varying float vSelected;
      varying float vOrgan;
      uniform float uAtlas;
      uniform float uPulse;
      void main() {
        vec3 n = normalize(vNormal);
        vec3 light = normalize(vec3(-0.36, 0.62, 0.72));
        float diffuse = max(dot(n, light), 0.0);
        float rim = pow(1.0 - max(n.z, 0.0), 2.0);
        float specular = pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0), 24.0);
        vec3 base = vColor * (0.38 + diffuse * 0.72) + vec3(0.13, 0.34, 0.45) * rim * 0.38 + vec3(0.7, 0.9, 1.0) * specular * 0.2;
        vec3 atlasBase = mix(base, vColor * (0.66 + diffuse * 0.44), uAtlas * 0.68);
        vec3 heat = mix(vec3(1.0, 0.61, 0.18), vec3(0.97, 0.24, 0.29), clamp(uPulse, 0.0, 1.0));
        vec3 color = mix(atlasBase, heat, vSelected * (0.42 + rim * 0.42));
        color += vec3(0.96, 0.42, 0.24) * vOrgan * vSelected * 0.2;
        gl_FragColor = vec4(color, 1.0);
      }
    `;
    const vertexShader = compileAnatomyShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileAnatomyShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "No se pudo enlazar WebGL.");
    gl.useProgram(program);
    const mesh = createSphereMesh(gl);
    const attributes = {
      position: gl.getAttribLocation(program, "aPosition"),
      normal: gl.getAttribLocation(program, "aNormal"),
    };
    const uniforms = Object.fromEntries(["uOffset", "uScale", "uYaw", "uColor", "uSelected", "uOrgan", "uAtlas", "uPulse"].map((name) => [name, gl.getUniformLocation(program, name)]));
    const geometry = makeAnatomyParts();
    anatomyRenderer = { gl, program, mesh, attributes, uniforms, ...geometry };
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    anatomyCanvas.addEventListener("pointerdown", (event) => {
      anatomyDragStart = event.clientX;
      anatomyCanvas.setPointerCapture(event.pointerId);
    });
    anatomyCanvas.addEventListener("pointermove", (event) => {
      if (anatomyDragStart == null) return;
      anatomyYaw += (event.clientX - anatomyDragStart) * .008;
      anatomyDragStart = event.clientX;
      renderAnatomy();
    });
    anatomyCanvas.addEventListener("pointerup", () => { anatomyDragStart = null; });
    anatomyCanvas.addEventListener("pointercancel", () => { anatomyDragStart = null; });
    renderAnatomy();
  } catch (error) {
    window.__anatomyRendererError = error.message;
    anatomyRenderer = { fallback: true };
    renderAnatomyFallback();
  }
}

function hexColor(value) {
  const parsed = value.match(/[0-9a-f]{2}/gi) || ["a8", "d4", "e8"];
  return parsed.slice(0, 3).map((part) => parseInt(part, 16) / 255);
}

function drawAnatomyPart(part, pulse = 0) {
  const { gl, mesh, attributes, uniforms } = anatomyRenderer;
  gl.useProgram(anatomyRenderer.program);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
  gl.enableVertexAttribArray(attributes.position);
  gl.vertexAttribPointer(attributes.position, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
  gl.enableVertexAttribArray(attributes.normal);
  gl.vertexAttribPointer(attributes.normal, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
  gl.uniform3fv(uniforms.uOffset, part.offset);
  const scale = part.name === "heart" ? part.scale.map((value) => value * (1 + pulse * .075)) : part.scale;
  gl.uniform3fv(uniforms.uScale, scale);
  gl.uniform1f(uniforms.uYaw, anatomyYaw);
  gl.uniform3fv(uniforms.uColor, hexColor(part.color));
  const selected = selectedMapRegion !== "General" && (selectedMapRegion === part.zone || (!selectedMapRegion && selectedZone === part.zone));
  gl.uniform1f(uniforms.uSelected, selected ? 1 : 0);
  gl.uniform1f(uniforms.uOrgan, part.organ ? 1 : 0);
  gl.uniform1f(uniforms.uAtlas, anatomyMode === "atlas" ? 1 : 0);
  gl.uniform1f(uniforms.uPulse, pulse);
  gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
}

function renderAnatomyFallback() {
  if (!anatomyCanvas || !anatomyRenderer?.fallback) return;
  const bounds = anatomyCanvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  anatomyCanvas.width = Math.max(1, Math.round(bounds.width * ratio));
  anatomyCanvas.height = Math.max(1, Math.round(bounds.height * ratio));
  const context = anatomyCanvas.getContext("2d");
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, bounds.width, bounds.height);
  const center = bounds.width / 2;
  const scale = Math.min(bounds.width * .46, bounds.height * .48);
  context.save();
  context.translate(center, bounds.height * .52);
  context.scale(scale, scale);
  const ellipsoid = (x, y, rx, ry, color) => {
    const gradient = context.createRadialGradient(x - rx * .34, y - ry * .35, .01, x, y, Math.max(rx, ry));
    gradient.addColorStop(0, "#f8fdff");
    gradient.addColorStop(.45, color);
    gradient.addColorStop(1, "#397e9e");
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
  };
  ellipsoid(0, -.78, .17, .2, "#afd8e8");
  ellipsoid(0, -.52, .09, .14, "#8cc7dc");
  ellipsoid(0, -.18, .3, .32, "#9fd2e4");
  ellipsoid(0, .13, .23, .24, "#90c7dc");
  ellipsoid(0, .4, .24, .15, "#8ec4d9");
  [-1, 1].forEach((side) => {
    ellipsoid(side * .25, -.2, .17, .15, "#a9d8e8");
    ellipsoid(side * .39, .05, .1, .24, "#98ccdf");
    ellipsoid(side * .45, .33, .075, .22, "#a2d1e1");
    ellipsoid(side * .47, .55, .065, .19, "#aed9e8");
    ellipsoid(side * .48, .75, .065, .11, "#c1e2ed");
    ellipsoid(side * .14, .53, .12, .24, "#9fcfe0");
    ellipsoid(side * .15, .78, .095, .12, "#b6ddeb");
    ellipsoid(side * .15, .94, .095, .06, "#c4e5f0");
  });
  context.restore();
}

function renderAnatomy() {
  if (!anatomyCanvas) return;
  if (!anatomyRenderer) {
    initAnatomyRenderer();
    return;
  }
  if (anatomyRenderer.fallback) {
    renderAnatomyFallback();
    return;
  }
  const { gl } = anatomyRenderer;
  const bounds = anatomyCanvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(bounds.width * ratio));
  const height = Math.max(1, Math.round(bounds.height * ratio));
  if (anatomyCanvas.width !== width || anatomyCanvas.height !== height) {
    anatomyCanvas.width = width;
    anatomyCanvas.height = height;
  }
  gl.viewport(0, 0, width, height);
  gl.clearColor(.035, .075, .13, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const pulse = anatomyMode === "atlas" ? (Math.sin(performance.now() * .006) + 1) * .5 : 0;
  anatomyRenderer.parts.forEach((part) => drawAnatomyPart(part, pulse));
  if (anatomyMode === "atlas") anatomyRenderer.organs.forEach((organ) => drawAnatomyPart(organ, pulse));
  if (anatomyMode === "atlas") anatomyAnimationFrame = requestAnimationFrame(renderAnatomy);
  else if (anatomyAnimationFrame) {
    cancelAnimationFrame(anatomyAnimationFrame);
    anatomyAnimationFrame = 0;
  }
}

function startWaveform() {
  if (waveFrame) return;
  const context = waveformCanvas.getContext("2d");
  const draw = () => {
    const bounds = waveformCanvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    if (waveformCanvas.width !== Math.round(width * ratio) || waveformCanvas.height !== Math.round(height * ratio)) {
      waveformCanvas.width = Math.round(width * ratio);
      waveformCanvas.height = Math.round(height * ratio);
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const active = voiceConsole.classList.contains("is-listening");
    const tint = waveChannel === "patient" ? [6, 182, 212] : [16, 185, 129];
    const bars = Math.max(24, Math.floor(width / 8));
    const gap = 3;
    const barWidth = Math.max(2, (width - bars * gap) / bars);
    const center = height / 2;
    for (let index = 0; index < bars; index += 1) {
      const envelope = Math.sin(Math.PI * index / Math.max(1, bars - 1));
      const movement = Math.abs(Math.sin(wavePhase + index * .47)) * .72 + Math.abs(Math.sin(wavePhase * .61 + index * .17)) * .28;
      const barHeight = active ? 4 + envelope * movement * (height * .7) : 2 + envelope * 2;
      const alpha = active ? .3 + movement * .65 : .3;
      context.fillStyle = `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, ${alpha})`;
      context.beginPath();
      context.roundRect(index * (barWidth + gap), center - barHeight / 2, barWidth, barHeight, 3);
      context.fill();
    }
    if (active) {
      wavePhase += .11;
      waveFrame = requestAnimationFrame(draw);
    } else {
      waveFrame = 0;
    }
  };
  waveFrame = requestAnimationFrame(draw);
}

function stopWaveform() {
  if (waveFrame) cancelAnimationFrame(waveFrame);
  waveFrame = 0;
  if (!waveformCanvas.width) return;
  const bounds = waveformCanvas.getBoundingClientRect();
  const context = waveformCanvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, bounds.width, bounds.height);
  context.fillStyle = "rgba(148, 163, 184, .42)";
  context.fillRect(0, bounds.height / 2 - 1, bounds.width, 2);
}

function getLocalRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function startLocalRecognition(channel) {
  const Recognition = getLocalRecognitionConstructor();
  if (!Recognition) return false;
  let recognition;
  try {
    recognition = new Recognition();
    if (!("processLocally" in recognition)) return false;
    recognition.processLocally = true;
    recognition.lang = channel === "doctor" ? "es-CO" : "sik";
    recognition.continuous = false;
    recognition.interimResults = true;
  } catch {
    return false;
  }

  let finalized = false;
  recognition.onstart = () => {
    activeRecognition = recognition;
    setVoiceStatus("Escuchando voz...", true, channel);
  };
  recognition.onresult = (event) => {
    const finalText = Array.from(event.results).filter((result) => result.isFinal).map((result) => result[0].transcript).join(" ").trim();
    if (finalText && !finalized) {
      finalized = true;
      activeRecognition = null;
      setVoiceStatus("Procesando fonemas Sikuani (motor local de vocabulario)...", true, channel);
      if (channel === "doctor") processDoctorSpeech(finalText);
      else processPatientSpeech(finalText);
    }
  };
  recognition.onerror = () => {
    activeRecognition = null;
    simulateLocalSpeech(channel);
  };
  recognition.onend = () => {
    if (activeRecognition === recognition) {
      activeRecognition = null;
      setVoiceStatus("Escucha finalizada.");
    }
  };
  try {
    recognition.start();
    return true;
  } catch {
    activeRecognition = null;
    return false;
  }
}

function stopLocalRecognition() {
  if (!activeRecognition) return;
  activeRecognition.stop();
  activeRecognition = null;
  setVoiceStatus("Escucha pausada.");
}

function simulateLocalSpeech(channel, responseId = activeQuickCaseId || 2, delay = 2000) {
  if (simulationTimer) window.clearTimeout(simulationTimer);
  setVoiceStatus(channel === "doctor" ? "Escuchando al Médico..." : "Escuchando Sikuani...", true, channel);
  simulationTimer = window.setTimeout(() => {
    simulationTimer = 0;
    if (channel === "doctor") {
      processDoctorSpeech("Me duele mucho el pecho y me cuesta respirar");
      return;
    }
    const response = patientResponses.find((item) => item.id === responseId) || patientResponses[1];
    processPatientSpeech(response.sikuani_audio, response);
  }, delay);
}

function getVocabularyMatches(text) {
  const normalized = normalizeText(text);
  return clinicalVocabulary.flatMap((entry) => {
    const matched = entry.es.find((word) => normalized.includes(normalizeText(word)));
    return matched ? [{ ...entry, matched, position: normalized.indexOf(normalizeText(matched)) }] : [];
  }).sort((first, second) => first.position - second.position);
}

function findQuickPhrase(text) {
  const normalized = normalizeText(text);
  const has = (words) => words.some((word) => normalized.includes(normalizeText(word)));
  if (has(["serpiente", "culebra", "mordedura", "picadura"])) return phrases.find((phrase) => phrase.id === 2);
  if (has(["pecho", "torax", "corazon"]) && has(["respirar", "aire", "ahogo", "falta de aire"])) return phrases.find((phrase) => phrase.zona === "Pecho");
  if (has(["fiebre", "calentura"]) && has(["cabeza", "dolor de cabeza"])) return phrases.find((phrase) => phrase.categoria === "Síntomas" && phrase.zona === "Cabeza");
  if (has(["tos", "toser", "flema"])) return phrases.find((phrase) => normalizeText(phrase.espanol).includes("tos"));
  if (has(["vomito", "diarrea", "nauseas"]) && has(["estomago", "barriga", "abdomen", "agua"])) return phrases.find((phrase) => phrase.zona === "Abdomen" && phrase.categoria === "Síntomas");
  if (has(["parto", "contracciones", "embarazo"])) return phrases.find((phrase) => phrase.categoria === "Materno");
  if (has(["medicina", "pastilla", "tratamiento", "remedio"])) return phrases.find((phrase) => phrase.categoria === "Tratamiento");

  const inputWords = new Set(normalized.split(/[^a-z0-9ü]+/).filter((word) => word.length > 3));
  let bestPhrase = null;
  let bestScore = 0;
  phrases.forEach((phrase) => {
    const phraseWords = normalizeText(phrase.espanol).split(/[^a-z0-9ü]+/).filter((word) => word.length > 3);
    const matches = phraseWords.filter((word) => inputWords.has(word)).length;
    const score = matches / Math.max(1, phraseWords.length);
    if (score > bestScore) {
      bestScore = score;
      bestPhrase = phrase;
    }
  });
  return bestScore >= .3 ? bestPhrase : null;
}

function processDoctorSpeech(text) {
  const phrase = findQuickPhrase(text);
  const vocabulary = getVocabularyMatches(text);
  const translated = phrase?.sikuani || [...new Set(vocabulary.map((entry) => entry.sikuani))].join(" · ");
  const phonetic = phrase?.fonetica || [...new Set(vocabulary.map((entry) => entry.fonetica))].join(" · ");
  const translation = translated || "No se encontró una coincidencia fiable en el vocabulario local.";
  appendConversation({ direction: "doctor", original: text, translation, phonetic, speechText: translated, confidence: phrase ? "Frase rápida" : vocabulary.length ? "Vocabulario local" : "Sin coincidencia" });
  if (translated) speak(translation, null, translatorStatus, "sik", phonetic, phrase?.audio || "");
  else setVoiceStatus("No hay coincidencia local fiable · prueba con síntomas o frases conocidas.");
}

function findPatientResponse(text) {
  const normalized = normalizeText(text);
  const exact = patientResponses.find((response) => normalizeText(response.sikuani_audio) === normalized);
  if (exact) return exact;
  const inputWords = new Set(normalized.split(/[^a-z0-9ü]+/).filter((word) => word.length > 2));
  let best = null;
  let bestScore = 0;
  patientResponses.forEach((response) => {
    const words = normalizeText(response.sikuani_audio).split(/[^a-z0-9ü]+/).filter((word) => word.length > 2);
    const score = words.filter((word) => inputWords.has(word)).length / Math.max(1, words.length);
    if (score > bestScore) {
      best = response;
      bestScore = score;
    }
  });
  return bestScore >= .55 ? best : null;
}

function processPatientSpeech(text, selectedResponse = null) {
  const response = selectedResponse || findPatientResponse(text);
  if (!response) {
    appendConversation({ direction: "patient", original: text, translation: "Sin coincidencia exacta en las cinco respuestas Sikuani locales. Confirma la frase con el paciente.", phonetic: "", speechText: "", confidence: "Revisión requerida" });
    setVoiceStatus("Respuesta Sikuani no reconocida por el catálogo local · confirma antes de actuar.");
    return;
  }
  appendConversation({ direction: "patient", original: text, translation: response.traduccion_es, phonetic: response.fonetica, speechText: response.traduccion_es, confidence: "Respuesta de campo", alert: response });
  pendingAlert = response;
  speak(response.traduccion_es, null, translatorStatus, "es-CO");
}

function appendConversation(entry) {
  const message = { ...entry, time: new Date().toISOString() };
  conversationEntries.push(message);
  renderConversation();
}

function renderConversation() {
  conversationHistory.replaceChildren();
  if (conversationEntries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "conversation-empty";
    empty.innerHTML = '<span class="empty-wave" aria-hidden="true">〰</span><p>Tu conversación aparecerá aquí</p><small>Toca un micrófono o elige un caso rápido.</small>';
    conversationHistory.append(empty);
    return;
  }
  conversationEntries.forEach((entry) => {
    const turn = document.createElement("article");
    turn.className = `chat-turn ${entry.direction === "doctor" ? "is-doctor" : "is-patient"}`;
    const speaker = document.createElement("span");
    speaker.className = "chat-speaker";
    const roleLabel = entry.direction === "doctor" ? "Médico · Español → Sikuani" : "Paciente · Sikuani → Español";
    speaker.textContent = entry.demo ? `DEMO · ${roleLabel}` : roleLabel;
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    const original = document.createElement("p");
    original.className = "chat-original";
    original.textContent = entry.original;
    const translation = document.createElement("p");
    translation.className = "chat-translation";
    translation.textContent = entry.translation;
    bubble.append(original, translation);
    if (entry.phonetic) {
      const phonetic = document.createElement("p");
      phonetic.className = "chat-phonetic";
      phonetic.textContent = `Fonética: ${entry.phonetic}`;
      bubble.append(phonetic);
    }
    const foot = document.createElement("div");
    foot.className = "chat-foot";
    const confidence = document.createElement("span");
    confidence.textContent = `${entry.confidence} · ${formatDate(entry.time)}`;
    const replay = document.createElement("button");
    replay.type = "button";
    replay.className = "chat-replay";
    replay.setAttribute("aria-label", "Repetir traducción hablada");
    replay.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 9v3h3l4 3V6L6 9H3Z"/><path d="M13 8a3 3 0 0 1 0 5m2-8a7 7 0 0 1 0 11"/></svg>';
    replay.disabled = !entry.speechText;
    replay.addEventListener("click", () => entry.speechText && speak(entry.speechText, replay, translatorStatus, entry.direction === "doctor" ? "sik" : "es-CO", entry.phonetic, entry.audioPath || ""));
    foot.append(confidence, replay);
    bubble.append(foot);
    if (entry.alert) {
      const alert = document.createElement("div");
      alert.className = "chat-triage-alert";
      const alertText = document.createElement("span");
      alertText.textContent = `${entry.alert.alerta_triage} · ${entry.alert.prioridad}`;
      const sendToTriage = document.createElement("button");
      sendToTriage.type = "button";
      sendToTriage.dataset.action = "register-alert";
      sendToTriage.dataset.responseId = String(entry.alert.id);
      sendToTriage.textContent = "Enviar a Triage";
      alert.append(alertText, sendToTriage);
      bubble.append(alert);
    }
    turn.append(speaker, bubble);
    conversationHistory.append(turn);
  });
  conversationHistory.scrollTop = conversationHistory.scrollHeight;
}

function registerAlertInTriage(response = pendingAlert) {
  if (!response) return;
  const levelForPriority = { Rojo: "I", Naranja: "II", Amarillo: "III", Verde: "IV" };
  const form = triageForm.elements;
  form.name.value = "Paciente sin identificar";
  form.age.value = "0";
  form.community.value = "Por registrar";
  form.symptom.value = response.traduccion_es;
  form.zone.value = response.zona;
  const level = levelForPriority[response.prioridad] || "III";
  const radio = triageForm.querySelector(`input[name="level"][value="${level}"]`);
  if (radio) radio.checked = true;
  setSelectedZone(response.zona);
  triageStatus.textContent = `Alerta importada: ${response.alerta_triage}. Confirma identidad y signos vitales antes de guardar.`;
  switchView("triage");
  document.querySelector("#clinical-form-title").scrollIntoView({ behavior: "smooth", block: "start" });
}

function attachConversationToRecord() {
  if (!conversationEntries.length) {
    translatorStatus.textContent = "No hay turnos para adjuntar.";
    return;
  }
  const transcript = conversationEntries.map((entry) => `${entry.direction === "doctor" ? "Médico" : "Paciente"}: ${entry.original}\nInterpretación: ${entry.translation}`).join("\n\n");
  const active = sortedPatients(patients.filter((patient) => patient.status !== "attended"));
  if (active.length) {
    const target = active[0];
    const next = patients.map((patient) => patient.id === target.id
      ? { ...patient, transcript: [patient.transcript, transcript].filter(Boolean).join("\n\n---\n\n") }
      : patient);
    if (savePatients(next)) translatorStatus.textContent = `Conversación adjunta a la ficha de ${target.name}.`;
    return;
  }
  pendingTranscript = transcript;
  switchView("triage");
  if (!triageForm.elements.symptom.value) triageForm.elements.symptom.value = "Consulta bilingüe";
  triageStatus.textContent = "Transcripción preparada. Completa la ficha para adjuntarla al registro clínico.";
}

function makeDemoPatients() {
  const now = Date.now();
  const demoRows = [
    { name: "DEMO · Caso respiratorio 01", age: 46, community: "Cumaribo · ejemplo ficticio", temperature: 38.6, heartRate: 112, spo2: 89, symptom: "Fiebre y dificultad respiratoria", zone: "Pecho", level: "I", minutesAgo: 32 },
    { name: "DEMO · Caso febril 02", age: 9, community: "Puerto Carreño · ejemplo ficticio", temperature: 39.1, heartRate: 124, spo2: 95, symptom: "Fiebre alta y decaimiento", zone: "Cabeza", level: "II", minutesAgo: 21 },
    { name: "DEMO · Caso abdominal 03", age: 28, community: "Santa Rosalía · ejemplo ficticio", temperature: 37.2, heartRate: 84, spo2: 98, symptom: "Dolor abdominal y náuseas", zone: "Abdomen", level: "III", minutesAgo: 9 },
  ];
  return demoRows.map((row, index) => ({
    id: `demo-${index + 1}`,
    name: row.name,
    age: row.age,
    community: row.community,
    temperature: row.temperature,
    heartRate: row.heartRate,
    spo2: row.spo2,
    symptom: row.symptom,
    zone: row.zone,
    level: row.level,
    status: "waiting",
    createdAt: new Date(now - row.minutesAgo * 60_000).toISOString(),
    demo: true,
  }));
}

function normalizePatient(patient, index) {
  const legacyLevels = { Rojo: "I", Naranja: "II", Amarillo: "III", Verde: "IV" };
  const level = priorityMeta[patient.level] ? patient.level : legacyLevels[patient.priority] || "IV";
  const oldStatus = patient.status;
  const status = oldStatus === "attended" || oldStatus === "done"
    ? "attended"
    : oldStatus === "consultation" || oldStatus === "in-consultation"
      ? "consultation"
      : "waiting";
  return {
    ...patient,
    id: String(patient.id || `local-${Date.now()}-${index}`),
    name: String(patient.name || "Paciente sin nombre"),
    age: Number.isFinite(Number(patient.age)) ? Number(patient.age) : "",
    community: String(patient.community || "Sin comunidad registrada"),
    temperature: patient.temperature ?? null,
    heartRate: patient.heartRate ?? null,
    spo2: patient.spo2 ?? null,
    symptom: String(patient.symptom || "Sin síntoma registrado"),
    zone: ["Cabeza", "Pecho", "Abdomen", "Extremidades", "General"].includes(patient.zone) ? patient.zone : "General",
    level,
    status,
    createdAt: patient.createdAt || new Date().toISOString(),
    demo: Boolean(patient.demo),
  };
}

function loadPatients() {
  try {
    const stored = localStorage.getItem(storageKey);
    const parsed = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed)) throw new TypeError("La base local no tiene un formato válido.");
    let records = parsed.map(normalizePatient);
    const firstLaunch = localStorage.getItem(seedKey) !== "true";
    if (records.length === 0 && firstLaunch) {
      records = makeDemoPatients();
      localStorage.setItem(storageKey, JSON.stringify(records));
    }
    if (firstLaunch) localStorage.setItem(seedKey, "true");
    return records;
  } catch {
    storageAvailable = false;
    triageStatus.textContent = "No se pudo acceder al almacenamiento local. Los cambios no se conservarán.";
    return makeDemoPatients();
  }
}

function savePatients(nextPatients) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(nextPatients));
    patients = nextPatients;
    updateStorageMeter();
    renderPatients();
    renderAnalytics();
    return true;
  } catch {
    triageStatus.textContent = "No se pudo guardar en este dispositivo. Comprueba el espacio disponible.";
    return false;
  }
}

function updateStorageMeter() {
  let bytes = 0;
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      bytes += new Blob([key || "", localStorage.getItem(key) || ""]).size;
    }
  } catch {
    bytes = 0;
  }
  document.querySelector("#storage-size").textContent = bytes < 1024
    ? `${bytes} B`
    : `${(bytes / 1024).toFixed(1)} KB`;
}

function normalizeText(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

function makeCategoryFilters() {
  const container = document.querySelector("#category-filters");
  categoryNames.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `category-chip${category === activeCategory ? " is-selected" : ""}`;
    button.textContent = category;
    button.setAttribute("aria-pressed", String(category === activeCategory));
    button.addEventListener("click", () => {
      activeCategory = category;
      container.querySelectorAll("button").forEach((item) => {
        const selected = item === button;
        item.classList.toggle("is-selected", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      renderPhrases();
    });
    container.append(button);
  });
}

function playTone() {
  const AudioContextType = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextType) return false;
  try {
    const context = new AudioContextType();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 620;
    gain.gain.setValueAtTime(0.14, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.35);
    oscillator.addEventListener("ended", () => context.close(), { once: true });
    return true;
  } catch {
    return false;
  }
}

function resetSpeechButton() {
  if (activeSpeechButton) {
    activeSpeechButton.classList.remove("is-speaking");
    activeSpeechButton.setAttribute("aria-pressed", "false");
  }
  activeSpeechButton = null;
}

function getVoicePreferenceScore(voice) {
  const name = normalizeText(voice.name);
  const naturalTerms = ["natural", "online", "neural", "google español", "salome", "dalia", "jorge", "sabina", "gonzalo", "alvaro", "helena"];
  const naturalIndex = naturalTerms.findIndex((term) => name.includes(normalizeText(term)));
  const locale = voice.lang.toLocaleLowerCase("es");
  const localeScore = locale === "es-co" ? 70 : locale.startsWith("es-mx") ? 55 : locale.startsWith("es-es") ? 45 : 25;
  const naturalScore = naturalIndex < 0 ? 0 : 5000 - naturalIndex * 120;
  return naturalScore + localeScore;
}

function updateSpeechVoiceList(voices = speechVoices) {
  speechVoices = voices;
  const spanishVoices = voices.map((voice, index) => ({ voice, index })).filter(({ voice }) => /^es(?:-|$)/i.test(voice.lang));
  const selected = voiceListSelect.value;
  voiceListSelect.replaceChildren();
  const automatic = document.createElement("option");
  automatic.value = "auto";
  automatic.textContent = "Mejor voz española";
  voiceListSelect.append(automatic);
  spanishVoices.forEach(({ voice, index }) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${voice.name} · ${voice.lang}`;
    voiceListSelect.append(option);
  });
  const selectedStillExists = [...voiceListSelect.options].some((option) => option.value === selected);
  voiceListSelect.value = selectedStillExists ? selected : "auto";
  return chooseSpeechVoice();
}

function chooseSpeechVoice() {
  const requestedIndex = voiceListSelect.value;
  if (requestedIndex !== "auto") {
    activeSpeechVoice = speechVoices[Number(requestedIndex)] || null;
  } else {
    const spanishVoices = speechVoices.filter((voice) => /^es(?:-|$)/i.test(voice.lang));
    const preferredNames = voiceGender === "female"
      ? ["sabina", "dalia", "salome", "helena", "zira"]
      : ["salome", "dalia", "jorge", "gonzalo", "alvaro", "raul", "david", "mark"];
    const genderMatches = spanishVoices.filter((voice) => preferredNames.some((name) => normalizeText(voice.name).includes(name)));
    const candidates = genderMatches.length ? genderMatches : spanishVoices;
    activeSpeechVoice = [...candidates].sort((first, second) => getVoicePreferenceScore(second) - getVoicePreferenceScore(first))[0] || null;
  }
  voiceEngineLabel.textContent = activeSpeechVoice ? activeSpeechVoice.name : "Voz española del sistema";
  return activeSpeechVoice;
}

function refreshSpeechVoices() {
  if (!("speechSynthesis" in window)) {
    voiceEngineLabel.textContent = "Voz no disponible";
    return;
  }
  updateSpeechVoiceList(window.speechSynthesis.getVoices());
}

function esperarVocesEspanol(timeoutMs = 1200) {
  if (!("speechSynthesis" in window)) return Promise.resolve([]);
  const currentVoices = window.speechSynthesis.getVoices();
  if (currentVoices.length) return Promise.resolve(currentVoices);
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      window.speechSynthesis.removeEventListener("voiceschanged", finish);
      resolve(window.speechSynthesis.getVoices());
    };
    const timeout = window.setTimeout(finish, timeoutMs);
    window.speechSynthesis.addEventListener("voiceschanged", finish);
  });
}

async function obtenerMejorVoz() {
  const voices = await esperarVocesEspanol();
  updateSpeechVoiceList(voices);
  return activeSpeechVoice;
}

function humanizarSikuani(texto) {
  return String(texto)
    .toLocaleLowerCase("es")
    .replace(/[ü]/g, "u")
    .replace(/kbepona/g, "kebepona")
    .replace(/([aeiou])x(?=[aeiou])/g, "$1sh")
    .replace(/ts/g, "tz")
    .replace(/\bshanepana\b/g, "shanepána")
    .replace(/\bjuka\b/g, "júka")
    .replace(/\bneba\b/g, "néba");
}

function textoParaHablar(texto, language) {
  return language === "sik" ? humanizarSikuani(texto) : String(texto);
}

function reproducirAudioLocal(audioPath) {
  if (!audioPath) return Promise.resolve(false);
  const safeFileName = String(audioPath).split(/[\\/]/).pop();
  const source = new URL(`audios/${encodeURIComponent(safeFileName)}`, window.location.href).href;
  return new Promise((resolve) => {
    let finished = false;
    const finish = (played) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      localTtsPlayer.onended = null;
      localTtsPlayer.onerror = null;
      resolve(played);
    };
    const timeout = window.setTimeout(() => finish(false), 12000);
    localTtsPlayer.pause();
    localTtsPlayer.currentTime = 0;
    localTtsPlayer.src = source;
    localTtsPlayer.onended = () => finish(true);
    localTtsPlayer.onerror = () => finish(false);
    const playback = localTtsPlayer.play();
    if (playback?.catch) playback.catch(() => finish(false));
  });
}

async function reproducirStreamHD(texto, language) {
  if (!navigator.onLine || typeof window.SIKUANI_STREAM_TTS !== "function") return false;
  try {
    const result = await window.SIKUANI_STREAM_TTS({ text: texto, language });
    if (!(result instanceof Blob) && typeof result !== "string") return false;
    const objectUrl = result instanceof Blob ? URL.createObjectURL(result) : result;
    const played = await reproducirAudioLocal(objectUrl);
    if (result instanceof Blob) URL.revokeObjectURL(objectUrl);
    return played;
  } catch {
    return false;
  }
}

async function speak(text, button, statusNode = translatorStatus, language = "es-CO", phonetic = "", audioPath = "") {
  const request = ++speechRequestId;
  const isSikuani = language === "sik";
  const spokenText = textoParaHablar(text, language);
  resetSpeechButton();
  activeSpeechButton = button;
  if (button) {
    button.classList.add("is-speaking");
    button.setAttribute("aria-pressed", "true");
  }
  statusNode.textContent = "Preparando voz clínica...";
  setVoiceStatus("Reproduciendo traducción...", true, isSikuani ? "patient" : "doctor");

  const voice = await obtenerMejorVoz();
  if (request !== speechRequestId) return;
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    await new Promise((resolve) => window.setTimeout(resolve, 60));
    if (request !== speechRequestId) return;
  }

  if (voiceEngineModeSelect.value === "hd") {
    const localAudioPlayed = await reproducirAudioLocal(audioPath);
    if (request !== speechRequestId) return;
    if (localAudioPlayed) {
      statusNode.textContent = "Reproduciendo audio clínico local.";
      resetSpeechButton();
      setVoiceStatus("Reproduciendo traducción...", true, isSikuani ? "patient" : "doctor");
      return;
    }
    const neuralAudioPlayed = await reproducirStreamHD(spokenText, language);
    if (request !== speechRequestId) return;
    if (neuralAudioPlayed) {
      statusNode.textContent = "Reproduciendo Audio HD.";
      resetSpeechButton();
      setVoiceStatus("Reproduciendo traducción...", true, isSikuani ? "patient" : "doctor");
      return;
    }
    voiceEngineLabel.textContent = `HD no configurado · ${voice?.name || "voz local"}`;
  }

  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    statusNode.textContent = playTone() ? "Audio no disponible · aviso sonoro activado." : "Audio no disponible en este dispositivo.";
    resetSpeechButton();
    setVoiceStatus(statusNode.textContent);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(spokenText);
  utterance.voice = voice || null;
  utterance.lang = voice?.lang || "es-CO";
  utterance.rate = isSikuani ? 0.94 : 1.0;
  utterance.pitch = isSikuani ? 1.0 : 1.02;
  utterance.onend = () => {
    if (request !== speechRequestId) return;
    resetSpeechButton();
    setVoiceStatus("Motor local listo · elige un canal para comenzar");
  };
  utterance.onerror = () => {
    if (request !== speechRequestId) return;
    resetSpeechButton();
    statusNode.textContent = "Voz local no disponible; prueba otra voz instalada.";
    setVoiceStatus(statusNode.textContent);
  };
  statusNode.textContent = `Reproduciendo con ${voice?.name || "la voz del sistema"}.`;
  window.speechSynthesis.speak(utterance);
}

function showPatientPhrase(phrase) {
  document.querySelector("#patient-dialog-spanish").textContent = phrase.espanol;
  document.querySelector("#patient-dialog-title").textContent = phrase.sikuani;
  document.querySelector("#patient-dialog-phonetic").textContent = phrase.fonetica;
  document.querySelector("#patient-dialog-audio").onclick = (event) => speak(phrase.sikuani, event.currentTarget, translatorStatus, "sik", phrase.fonetica, phrase.audio || "");
  patientDialog.showModal();
}

function makePhraseCard(phrase) {
  const card = document.createElement("article");
  card.className = "phrase-card";
  card.style.setProperty("--phrase-accent", phrase.color);
  const meta = document.createElement("div");
  meta.className = "phrase-meta";
  const category = document.createElement("span");
  category.className = "phrase-category";
  category.textContent = phrase.categoria;
  const zone = document.createElement("span");
  zone.className = "anatomy-tag";
  zone.textContent = phrase.zona;
  meta.append(category, zone);
  const spanish = document.createElement("h3");
  spanish.className = "phrase-spanish";
  spanish.textContent = phrase.espanol;
  const sikuani = document.createElement("p");
  sikuani.className = "phrase-sikuani";
  sikuani.lang = "sik";
  sikuani.textContent = phrase.sikuani;
  const phonetic = document.createElement("p");
  phonetic.className = "phrase-phonetic";
  phonetic.textContent = `FONÉTICA  ${phrase.fonetica}`;
  const actions = document.createElement("div");
  actions.className = "phrase-actions";
  const listen = document.createElement("button");
  listen.type = "button";
  listen.className = "phrase-action listen-action";
  listen.setAttribute("aria-pressed", "false");
  listen.setAttribute("aria-label", `Escuchar: ${phrase.sikuani}`);
  listen.innerHTML = '<span class="sound-wave" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>Escuchar</span>';
  listen.addEventListener("click", () => speak(phrase.sikuani, listen, translatorStatus, "sik", phrase.fonetica, phrase.audio || ""));
  const patientMode = document.createElement("button");
  patientMode.type = "button";
  patientMode.className = "phrase-action patient-mode-action";
  patientMode.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z"/><circle cx="10" cy="10" r="2"/></svg><span>Pantalla Paciente</span>';
  patientMode.addEventListener("click", () => showPatientPhrase(phrase));
  actions.append(listen, patientMode);
  card.append(meta, spanish, sikuani, phonetic, actions);
  return card;
}

function renderPhrases() {
  const query = normalizeText(searchInput.value.trim());
  const filtered = phrases.filter((phrase) =>
    (activeCategory === "Todas" || phrase.categoria === activeCategory)
    && normalizeText(phrase.espanol).includes(query));
  phraseList.replaceChildren();
  document.querySelector("#phrase-count").textContent = `${filtered.length} ${filtered.length === 1 ? "frase" : "frases"}`;
  if (filtered.length) {
    phraseList.append(...filtered.map(makePhraseCard));
  } else {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No hay frases que coincidan con la búsqueda.";
    phraseList.append(empty);
  }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Hora no disponible";
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function sortedPatients(records) {
  const rank = { I: 1, II: 2, III: 3, IV: 4 };
  return [...records].sort((a, b) => rank[a.level] - rank[b.level] || new Date(a.createdAt) - new Date(b.createdAt));
}

function makePatientCard(patient) {
  const meta = priorityMeta[patient.level] || priorityMeta.IV;
  const card = document.createElement("article");
  card.className = `patient-card${patient.demo ? " is-demo" : ""}`;
  card.style.setProperty("--priority-color", meta.color);
  const main = document.createElement("div");
  main.className = "patient-card-main";
  const titleLine = document.createElement("div");
  titleLine.className = "patient-title-line";
  const name = document.createElement("h3");
  name.textContent = patient.name;
  const priority = document.createElement("span");
  priority.className = "priority-pill";
  priority.textContent = `${patient.level} · ${meta.name} · ${meta.description}`;
  titleLine.append(name, priority);
  if (patient.demo) {
    const demoTag = document.createElement("span");
    demoTag.className = "demo-tag";
    demoTag.textContent = "DEMO";
    titleLine.append(demoTag);
  }
  const details = document.createElement("p");
  details.className = "patient-details";
  details.textContent = `${patient.age} años · ${patient.community} · ${patient.zone}`;
  const symptom = document.createElement("p");
  symptom.className = "patient-symptom";
  symptom.textContent = patient.symptom;
  const vitals = document.createElement("p");
  vitals.className = "patient-vitals";
  vitals.textContent = [
    patient.temperature != null && `T ${patient.temperature} °C`,
    patient.heartRate != null && `FC ${patient.heartRate} lpm`,
    patient.spo2 != null && `SpO₂ ${patient.spo2}%`,
    `Ingreso ${formatDate(patient.createdAt)}`,
  ].filter(Boolean).join("  ·  ");
  const status = document.createElement("span");
  status.className = `patient-status status-${patient.status}`;
  status.textContent = patient.status === "consultation" ? "En Consulta" : patient.status === "attended" ? "Atendido" : "En Espera";
  main.append(titleLine, details, symptom, vitals, status);
  if (patient.transcript) {
    const transcript = document.createElement("details");
    transcript.className = "patient-transcript";
    const summary = document.createElement("summary");
    summary.textContent = "Ver transcripción bilingüe";
    const content = document.createElement("pre");
    content.textContent = patient.transcript;
    transcript.append(summary, content);
    main.append(transcript);
  }
  const actions = document.createElement("div");
  actions.className = "patient-card-actions";
  if (patient.status !== "attended") {
    const advance = document.createElement("button");
    advance.type = "button";
    advance.className = "small-action advance-action";
    advance.dataset.action = "advance";
    advance.dataset.id = patient.id;
    advance.textContent = patient.status === "consultation" ? "Marcar atendido" : "Pasar a consulta";
    actions.append(advance);
  }
  const print = document.createElement("button");
  print.type = "button";
  print.className = "small-action";
  print.dataset.action = "print";
  print.dataset.id = patient.id;
  print.textContent = "Ver / imprimir remisión";
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "small-action delete-action";
  remove.dataset.action = "delete";
  remove.dataset.id = patient.id;
  remove.textContent = "Eliminar";
  actions.append(print, remove);
  card.append(main, actions);
  return card;
}

function renderPatients() {
  const active = sortedPatients(patients.filter((patient) => patient.status !== "attended"));
  const attended = sortedPatients(patients.filter((patient) => patient.status === "attended"));
  patientQueue.replaceChildren();
  attendedQueue.replaceChildren();
  document.querySelector("#active-count").textContent = String(active.length);
  document.querySelector("#done-count").textContent = String(attended.length);
  document.querySelector("#attended-total").textContent = String(attended.length);
  document.querySelector("#nav-patient-count").textContent = String(active.length);
  document.querySelector("#demo-note").hidden = !patients.some((patient) => patient.demo);
  if (active.length) patientQueue.append(...active.map(makePatientCard));
  else patientQueue.append(makeEmptyMessage("No hay pacientes activos en la sala."));
  if (attended.length) attendedQueue.append(...attended.map(makePatientCard));
  else attendedQueue.append(makeEmptyMessage("Todavía no hay atenciones cerradas."));
}

function makeEmptyMessage(text) {
  const empty = document.createElement("p");
  empty.className = "empty-state queue-empty";
  empty.textContent = text;
  return empty;
}

function renderAnalytics() {
  const total = patients.length;
  const critical = patients.filter((patient) => patient.level === "I" || patient.level === "II").length;
  const attended = patients.filter((patient) => patient.status === "attended").length;
  document.querySelector("#kpi-total").textContent = String(total);
  document.querySelector("#kpi-critical").textContent = String(critical);
  document.querySelector("#kpi-attended").textContent = String(attended);
  document.querySelector("#kpi-efficiency").textContent = `${total ? Math.round(attended / total * 100) : 0}%`;
  drawBarChart(document.querySelector("#priority-chart"), [
    { label: "I Rojo", value: patients.filter((patient) => patient.level === "I").length, color: priorityMeta.I.color },
    { label: "II Naranja", value: patients.filter((patient) => patient.level === "II").length, color: priorityMeta.II.color },
    { label: "III Amarillo", value: patients.filter((patient) => patient.level === "III").length, color: priorityMeta.III.color },
    { label: "IV Verde", value: patients.filter((patient) => patient.level === "IV").length, color: priorityMeta.IV.color },
  ]);
  const communities = new Map();
  patients.forEach((patient) => communities.set(patient.community, (communities.get(patient.community) || 0) + 1));
  const communityData = [...communities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([label, value], index) => ({ label: label.split(" · ")[0], value, color: ["#216d5a", "#368975", "#7da991", "#c08a45", "#708b93"][index] }));
  drawBarChart(document.querySelector("#community-chart"), communityData);
}

function drawBarChart(canvas, data) {
  const width = canvas.clientWidth;
  if (!width) return;
  const height = 220;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  const styles = getComputedStyle(document.body);
  const grid = styles.getPropertyValue("--chart-grid").trim() || "#e2e8e2";
  const text = styles.getPropertyValue("--chart-text").trim() || "#66776f";
  const left = 24;
  const right = 10;
  const base = 170;
  const chartWidth = width - left - right;
  [0, 0.5, 1].forEach((fraction) => {
    const y = base - fraction * 130;
    context.strokeStyle = grid;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(width - right, y);
    context.stroke();
  });
  if (!data.length) {
    context.fillStyle = text;
    context.font = "12px sans-serif";
    context.textAlign = "center";
    context.fillText("Sin datos", width / 2, 105);
    return;
  }
  const maximum = Math.max(1, ...data.map((item) => item.value));
  const slot = chartWidth / data.length;
  const barWidth = Math.min(38, slot * 0.54);
  data.forEach((item, index) => {
    const barHeight = item.value ? Math.max(3, item.value / maximum * 120) : 0;
    const x = left + slot * index + (slot - barWidth) / 2;
    context.fillStyle = item.color;
    context.beginPath();
    context.roundRect(x, base - barHeight, barWidth, Math.max(2, barHeight), 3);
    context.fill();
    context.fillStyle = text;
    context.font = "600 11px sans-serif";
    context.textAlign = "center";
    context.fillText(String(item.value), x + barWidth / 2, base - barHeight - 7);
    context.font = "10px sans-serif";
    const label = item.label.length > 12 ? `${item.label.slice(0, 11)}…` : item.label;
    context.fillText(label, x + barWidth / 2, base + 18);
  });
}

function getSelectedZoneProfile() {
  const key = selectedMapRegion || (selectedZone === "Pecho" ? "Torax" : selectedZone);
  return biometricZoneProfiles[key] || biometricZoneProfiles.General;
}

function renderZoneClinicalPanel(profile) {
  const panel = document.querySelector("#zone-clinical-panel");
  panel.replaceChildren();
  const header = document.createElement("div");
  header.className = "zone-panel-heading";
  const headingCopy = document.createElement("div");
  const kicker = document.createElement("p");
  kicker.className = "zone-panel-kicker";
  kicker.textContent = "VALORACIÓN RÁPIDA";
  const title = document.createElement("h3");
  title.textContent = profile.title;
  headingCopy.append(kicker, title);
  const zoneBadge = document.createElement("span");
  zoneBadge.className = "zone-panel-badge";
  zoneBadge.textContent = profile.zone;
  header.append(headingCopy, zoneBadge);

  const question = document.createElement("p");
  question.className = "zone-question-es";
  question.textContent = profile.questionEs;
  const questionSik = document.createElement("p");
  questionSik.className = "zone-question-sik";
  questionSik.textContent = profile.questionSik;
  const phonetic = document.createElement("p");
  phonetic.className = "zone-question-phonetic";
  phonetic.textContent = `Fonética: ${profile.phonetic}`;

  const audioActions = document.createElement("div");
  audioActions.className = "zone-audio-actions";
  const sikuaniButton = document.createElement("button");
  sikuaniButton.type = "button";
  sikuaniButton.className = "zone-audio-button is-sikuani";
  sikuaniButton.dataset.action = "speak-sikuani";
  sikuaniButton.textContent = "▶ Escuchar Sikuani";
  const spanishButton = document.createElement("button");
  spanishButton.type = "button";
  spanishButton.className = "zone-audio-button";
  spanishButton.dataset.action = "speak-spanish";
  spanishButton.textContent = "▶ Español";
  audioActions.append(sikuaniButton, spanishButton);

  const eva = document.createElement("div");
  eva.className = "eva-control";
  const evaHeading = document.createElement("div");
  evaHeading.className = "eva-heading";
  const evaTitle = document.createElement("strong");
  evaTitle.textContent = "Intensidad del dolor · EVA";
  const evaCurrent = document.createElement("span");
  evaCurrent.className = "eva-current";
  evaCurrent.id = "eva-current";
  const painLabels = { 1: "Leve", 3: "Moderado", 6: "Fuerte", 8: "Muy fuerte", 10: "Insoportable" };
  evaCurrent.textContent = `${selectedEvaPain}/10 · ${painLabels[selectedEvaPain] || "Leve"}`;
  evaHeading.append(evaTitle, evaCurrent);
  const evaOptions = document.createElement("div");
  evaOptions.className = "eva-options";
  const painChoices = [
    { value: 1, label: "Leve" },
    { value: 3, label: "Moderado" },
    { value: 6, label: "Fuerte" },
    { value: 8, label: "Muy fuerte" },
    { value: 10, label: "Insoportable" },
  ];
  painChoices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `eva-choice${selectedEvaPain === choice.value ? " is-selected" : ""}`;
    button.dataset.action = "eva";
    button.dataset.value = String(choice.value);
    button.setAttribute("aria-pressed", String(selectedEvaPain === choice.value));
    button.innerHTML = `<strong>${choice.value}</strong><small>${choice.label}</small>`;
    evaOptions.append(button);
  });
  eva.append(evaHeading, evaOptions);

  const symptomHeading = document.createElement("p");
  symptomHeading.className = "zone-symptom-heading";
  symptomHeading.textContent = "Síntomas rápidos";
  const symptomOptions = document.createElement("div");
  symptomOptions.className = "zone-symptom-options";
  profile.symptoms.forEach((symptom) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `zone-symptom-chip${selectedZoneSymptom === symptom ? " is-selected" : ""}`;
    button.dataset.action = "symptom";
    button.dataset.symptom = symptom;
    button.setAttribute("aria-pressed", String(selectedZoneSymptom === symptom));
    button.textContent = symptom;
    symptomOptions.append(button);
  });
  const priority = getTriagePriority(profile, selectedEvaPain, selectedZoneSymptom);
  const priorityLine = document.createElement("p");
  priorityLine.className = "zone-priority-line";
  priorityLine.innerHTML = `Prioridad sugerida: <strong class="priority-value priority-${priority.level.toLowerCase()}">${priority.level} · ${priorityMeta[priority.level].name}</strong>`;

  const register = document.createElement("button");
  register.type = "button";
  register.className = "zone-triage-button";
  register.dataset.action = "send-triage";
  register.innerHTML = '<span aria-hidden="true">⚡</span> Pasar al Triage + Hablar con Paciente';
  panel.append(header, question, questionSik, phonetic, audioActions, eva, symptomHeading, symptomOptions, priorityLine, register);
}

function getTriagePriority(profile, eva, symptom) {
  const normalized = normalizeText(`${profile.title} ${profile.questionEs} ${symptom || ""}`);
  if (["mordedura de serpiente", "falta de aire", "dolor toracico", "contracciones"].some((signal) => normalized.includes(signal))) return { level: "I" };
  if (["sangrado", "fractura"].some((signal) => normalizeText(symptom || "").includes(signal))) return { level: "II" };
  if (eva >= 8) return { level: "II" };
  if (eva >= 6) return { level: "III" };
  return { level: "IV" };
}

function passZoneAssessmentToTriage(profile) {
  const symptom = selectedZoneSymptom || profile.symptoms[0];
  const priority = getTriagePriority(profile, selectedEvaPain, symptom);
  const levelForPriority = { I: "Rojo", II: "Naranja", III: "Amarillo", IV: "Verde" };
  const response = {
    traduccion_es: `${symptom} · Dolor EVA ${selectedEvaPain}/10 · ${profile.questionEs}`,
    alerta_triage: `${profile.title} · EVA ${selectedEvaPain}/10`,
    prioridad: levelForPriority[priority.level],
    zona: profile.zone,
  };
  speak(profile.questionSik, null, triageStatus, "sik", profile.phonetic);
  registerAlertInTriage(response);
}

function setSelectedZone(zone, mapRegion = null, announce = false) {
  selectedZone = zone;
  selectedMapRegion = mapRegion;
  selectedZoneSymptom = "";
  document.querySelector("#selected-zone-label").textContent = zone;
  document.querySelector("#triage-zone").value = zone;
  document.querySelectorAll(".biometric-node").forEach((node) => {
    const isSelected = node.dataset.zone === zone && (!mapRegion || node.dataset.region === mapRegion);
    node.classList.toggle("is-selected", isSelected);
    node.setAttribute("aria-pressed", String(isSelected));
  });
  const profileKey = mapRegion || (zone === "Pecho" ? "Torax" : zone === "Extremidades" ? "ExtremidadesInferiores" : zone);
  const profile = biometricZoneProfiles[profileKey] || biometricZoneProfiles.General;
  selectedMapRegion = profile.region;
  renderZoneClinicalPanel(profile);
  renderAnatomy();
  const results = phrases.filter((phrase) => phrase.zona === zone || phrase.zona === "General");
  const container = document.querySelector("#zone-phrases");
  container.replaceChildren();
  const heading = document.createElement("p");
  heading.className = "zone-phrases-title";
  heading.textContent = `Frases relacionadas · ${zone}`;
  container.append(heading);
  results.slice(0, 4).forEach((phrase) => {
    const item = document.createElement("div");
    item.className = "zone-phrase-item";
    const text = document.createElement("span");
    text.textContent = phrase.sikuani;
    const listen = document.createElement("button");
    listen.type = "button";
    listen.setAttribute("aria-label", `Escuchar: ${phrase.sikuani}`);
    listen.textContent = "▶";
    listen.addEventListener("click", () => speak(phrase.sikuani, listen, triageStatus, "sik", phrase.fonetica, phrase.audio || ""));
    item.append(text, listen);
    container.append(item);
  });
  if (announce) speak(profile.questionSik, null, triageStatus, "sik", profile.phonetic);
}

function handleZonePanelAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const profile = getSelectedZoneProfile();
  const action = button.dataset.action;
  if (action === "eva") {
    selectedEvaPain = Number(button.dataset.value);
    renderZoneClinicalPanel(profile);
  } else if (action === "symptom") {
    selectedZoneSymptom = button.dataset.symptom;
    renderZoneClinicalPanel(profile);
  } else if (action === "speak-sikuani") {
    speak(profile.questionSik, button, triageStatus, "sik", profile.phonetic);
  } else if (action === "speak-spanish") {
    speak(profile.questionEs, button, triageStatus, "es-CO");
  } else if (action === "send-triage") {
    passZoneAssessmentToTriage(profile);
  }
}

function handleTriageSubmit(event) {
  event.preventDefault();
  if (!storageAvailable) {
    triageStatus.textContent = "El almacenamiento local no está disponible en este navegador.";
    return;
  }
  const form = new FormData(triageForm);
  const patient = normalizePatient({
    id: window.crypto?.randomUUID?.() || `patient-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: String(form.get("name")).trim(),
    age: Number(form.get("age")),
    community: String(form.get("community")).trim(),
    temperature: form.get("temperature") ? Number(form.get("temperature")) : null,
    heartRate: form.get("heartRate") ? Number(form.get("heartRate")) : null,
    spo2: form.get("spo2") ? Number(form.get("spo2")) : null,
    symptom: String(form.get("symptom")).trim(),
    zone: form.get("zone"),
    level: form.get("level"),
    status: "waiting",
    createdAt: new Date().toISOString(),
    transcript: pendingTranscript,
  }, patients.length);
  if (savePatients([patient, ...patients])) {
    triageForm.reset();
    pendingTranscript = "";
    document.querySelector("#triage-zone").value = selectedZone;
    triageStatus.textContent = "Triage guardado localmente y añadido a la sala de espera.";
  }
}

function handleQueueAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const patient = patients.find((entry) => entry.id === button.dataset.id);
  if (!patient) return;
  if (button.dataset.action === "print") {
    printReferral(patient);
    return;
  }
  if (button.dataset.action === "delete") {
    savePatients(patients.filter((entry) => entry.id !== patient.id));
    return;
  }
  const nextStatus = patient.status === "waiting" ? "consultation" : "attended";
  const next = patients.map((entry) => entry.id === patient.id
    ? { ...entry, status: nextStatus, ...(nextStatus === "attended" ? { attendedAt: new Date().toISOString() } : {}) }
    : entry);
  savePatients(next);
}

function printReferral(patient) {
  const root = document.querySelector("#referral-print");
  root.replaceChildren();
  const title = document.createElement("h1");
  title.textContent = "Remisión clínica · Sikuani Med Pro";
  const intro = document.createElement("p");
  intro.textContent = "Registro generado sin conexión · Uso clínico";
  const list = document.createElement("dl");
  const fields = [
    ["Paciente", patient.name], ["Edad", `${patient.age} años`], ["Comunidad / Resguardo", patient.community],
    ["Ingreso", formatDate(patient.createdAt)], ["Prioridad Manchester", `${patient.level} · ${priorityMeta[patient.level].name} · ${priorityMeta[patient.level].description}`],
    ["Estado", patient.status === "consultation" ? "En Consulta" : patient.status === "attended" ? "Atendido" : "En Espera"],
    ["Síntoma principal", patient.symptom], ["Zona afectada", patient.zone],
    ["Temperatura", patient.temperature == null ? "No registrada" : `${patient.temperature} °C`],
    ["Frecuencia cardiaca", patient.heartRate == null ? "No registrada" : `${patient.heartRate} lpm`],
    ["SpO₂", patient.spo2 == null ? "No registrada" : `${patient.spo2}%`],
    ...(patient.transcript ? [["Transcripción clínica", patient.transcript]] : []),
  ];
  fields.forEach(([label, value]) => {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    list.append(term, description);
  });
  root.append(title, intro, list);
  document.body.classList.add("printing-referral");
  window.print();
}

function downloadFile(fileName, contents, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCsv() {
  const columns = ["id", "nombre", "edad", "comunidad", "ingreso", "nivel_manchester", "estado", "sintoma", "zona", "temperatura_c", "frecuencia_cardiaca_lpm", "spo2_pct", "demostracion"];
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = patients.map((patient) => [patient.id, patient.name, patient.age, patient.community, patient.createdAt, patient.level, patient.status, patient.symptom, patient.zone, patient.temperature, patient.heartRate, patient.spo2, patient.demo ? "Sí" : "No"]);
  const csv = `\uFEFF${[columns, ...rows].map((row) => row.map(escape).join(";")).join("\r\n")}`;
  downloadFile("sikuani-med-pacientes.csv", csv, "text/csv;charset=utf-8");
  document.querySelector("#export-status").textContent = "Base CSV generada en este dispositivo.";
}

function exportJson() {
  const backup = { app: "Sikuani Med Pro", version: "2.0", exportedAt: new Date().toISOString(), patients };
  downloadFile("sikuani-med-backup.json", JSON.stringify(backup, null, 2), "application/json;charset=utf-8");
  document.querySelector("#export-status").textContent = "Backup JSON generado en este dispositivo.";
}

function switchView(name) {
  document.querySelectorAll(".app-view").forEach((view) => {
    const active = view.dataset.view === name;
    view.hidden = !active;
    view.classList.toggle("is-active", active);
  });
  document.querySelectorAll(".nav-item").forEach((button) => {
    const active = button.dataset.viewTarget === name;
    button.classList.toggle("is-current", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (name === "analytics") requestAnimationFrame(renderAnalytics);
  if (name === "triage") requestAnimationFrame(renderAnatomy);
  else if (anatomyAnimationFrame) {
    cancelAnimationFrame(anatomyAnimationFrame);
    anatomyAnimationFrame = 0;
  }
}

function toggleContrast(button) {
  const active = document.body.classList.toggle("sun-mode");
  button.setAttribute("aria-pressed", String(active));
  try { localStorage.setItem("sikuani-med-sun-mode", String(active)); } catch {}
  updateStorageMeter();
  if (!document.querySelector("#view-analytics").hidden) renderAnalytics();
}

function seedConversationPreview() {
  if (conversationEntries.length) return;
  const patientExample = patientResponses.find((response) => response.id === 2);
  conversationEntries = [
    {
      direction: "doctor",
      original: "¿Dónde le duele exactamente?",
      translation: "Detsa jiwi juka? Kbepona.",
      phonetic: "Det-sa ji-wi ju-ka · K-be-po-na",
      speechText: "Detsa jiwi juka? Kbepona.",
      confidence: "Ejemplo de conversación",
      demo: true,
      time: new Date().toISOString(),
    },
    {
      direction: "patient",
      original: patientExample.sikuani_audio,
      translation: patientExample.traduccion_es,
      phonetic: patientExample.fonetica,
      speechText: patientExample.traduccion_es,
      confidence: "Ejemplo de conversación",
      demo: true,
      alert: patientExample,
      time: new Date().toISOString(),
    },
  ];
}

function start() {
  patients = loadPatients();
  seedConversationPreview();
  makeCategoryFilters();
  renderPhrases();
  renderConversation();
  renderPatients();
  renderAnalytics();
  setSelectedZone("General");
  updateStorageMeter();
  try {
    const sunMode = localStorage.getItem("sikuani-med-sun-mode") === "true";
    document.body.classList.toggle("sun-mode", sunMode);
    document.querySelector("#contrast-toggle").setAttribute("aria-pressed", String(sunMode));
  } catch {}
  voiceGenderSelect.addEventListener("change", () => {
    voiceGender = voiceGenderSelect.value;
    voiceListSelect.value = "auto";
    refreshSpeechVoices();
  });
  voiceListSelect.addEventListener("change", chooseSpeechVoice);
  voiceEngineModeSelect.addEventListener("change", () => {
    voiceEngineLabel.textContent = voiceEngineModeSelect.value === "hd"
      ? `${activeSpeechVoice?.name || "Voz local"} · HD si está configurado`
      : activeSpeechVoice?.name || "Voz española del sistema";
  });
  voiceTestButton.addEventListener("click", () => speak("Hola, prueba de voz clínica. ¿Cómo se siente hoy?", voiceTestButton, translatorStatus, "es-CO"));
  refreshSpeechVoices();
  if ("speechSynthesis" in window) {
    window.speechSynthesis.addEventListener("voiceschanged", refreshSpeechVoices);
    window.speechSynthesis.getVoices();
  }
  document.querySelector("#contrast-toggle").addEventListener("click", (event) => toggleContrast(event.currentTarget));
  document.querySelectorAll("[data-view-target]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.viewTarget)));
  document.querySelectorAll("[data-rate]").forEach((button) => button.addEventListener("click", () => {
    speechRate = Number(button.dataset.rate);
    document.querySelectorAll("[data-rate]").forEach((rateButton) => {
      const active = rateButton === button;
      rateButton.setAttribute("aria-pressed", String(active));
      rateButton.classList.toggle("is-selected", active);
    });
  }));
  searchInput.addEventListener("input", renderPhrases);
  document.querySelectorAll(".biometric-node").forEach((node) => {
    node.addEventListener("click", () => setSelectedZone(node.dataset.zone, node.dataset.region, true));
  });
  document.querySelector("#zone-clinical-panel").addEventListener("click", handleZonePanelAction);
  document.querySelector("#anatomy-view-toggle").addEventListener("click", (event) => {
    anatomyMode = anatomyMode === "scanner" ? "atlas" : "scanner";
    const isAtlas = anatomyMode === "atlas";
    document.querySelector("#anatomy-stage").classList.toggle("is-atlas", isAtlas);
    event.currentTarget.setAttribute("aria-pressed", String(isAtlas));
    event.currentTarget.textContent = isAtlas ? "Cambiar vista: Escáner 3D" : "Cambiar vista: Atlas Muscular";
    document.querySelector("#anatomy-mode-label").textContent = isAtlas ? "ATLAS MUSCULAR · ÓRGANOS VITALES" : "ESCÁNER BIOMÉTRICO · FRONTAL";
    renderAnatomy();
  });
  document.querySelector("#triage-zone").addEventListener("change", (event) => setSelectedZone(event.target.value));
  triageForm.addEventListener("submit", handleTriageSubmit);
  document.querySelector("#doctor-mic").addEventListener("click", () => {
    if (activeRecognition) {
      stopLocalRecognition();
      return;
    }
    if (!startLocalRecognition("doctor")) {
      simulateLocalSpeech("doctor");
    }
  });
  document.querySelector("#patient-mic").addEventListener("click", () => {
    if (activeRecognition) {
      stopLocalRecognition();
      return;
    }
    if (!startLocalRecognition("patient")) simulateLocalSpeech("patient");
  });
  document.querySelectorAll("[data-case-id]").forEach((button) => button.addEventListener("click", () => {
    activeQuickCaseId = Number(button.dataset.caseId);
    document.querySelectorAll("[data-case-id]").forEach((chip) => chip.classList.toggle("is-selected", chip === button));
    simulateLocalSpeech("patient", activeQuickCaseId, 650);
  }));
  document.querySelector("#face-mode-toggle").addEventListener("click", (event) => {
    const active = voiceConsole.classList.toggle("face-to-face");
    event.currentTarget.setAttribute("aria-pressed", String(active));
    event.currentTarget.setAttribute("aria-label", active ? "Salir del modo cara a cara" : "Activar modo cara a cara");
  });
  conversationHistory.addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="register-alert"]');
    if (!button) return;
    const response = patientResponses.find((item) => String(item.id) === button.dataset.responseId);
    pendingAlert = response || null;
    registerAlertInTriage(response);
  });
  patientQueue.addEventListener("click", handleQueueAction);
  attendedQueue.addEventListener("click", handleQueueAction);
  document.querySelector("#export-csv").addEventListener("click", exportCsv);
  document.querySelector("#export-json").addEventListener("click", exportJson);
  document.querySelector("#close-patient-dialog").addEventListener("click", () => patientDialog.close());
  patientDialog.addEventListener("click", (event) => {
    if (event.target === patientDialog) patientDialog.close();
  });
  window.addEventListener("afterprint", () => document.body.classList.remove("printing-referral"));
  window.addEventListener("resize", () => {
    renderAnatomy();
    if (!document.querySelector("#view-analytics").hidden) renderAnalytics();
  });
  if (!storageAvailable) translatorStatus.textContent = "Modo local solo en memoria: el almacenamiento del navegador no está disponible.";
}

start();

/* ==========================================================================
   MOTOR DE VOZ BLINDADO: PRIORIZA VOCES REALES FUNCIONALES (SABINA / RAUL)
   Y AUTO-RECUPERACIÓN SI UNA VOZ "ONLINE" FALLA
   ========================================================================== */

(function fixWorkingVoicesOnly() {
  const synth = window.speechSynthesis;
  if (!synth) return;

  const originalSpeak = synth.speak.bind(synth);

  // Obtener las voces que REALMENTE funcionan en este PC (Locales primero)
  function getGuaranteedVoice(preferMale = false) {
    const all = synth.getVoices();
    if (!all.length) return null;

    // Filtrar voces en español
    const esVoices = all.filter(v => v.lang.toLowerCase().startsWith("es"));
    
    // Separar las instaladas en Windows (LocalService = true, como Sabina y Raul) que NUNCA fallan
    const localEs = esVoices.filter(v => v.localService === true || !v.name.toLowerCase().includes("online"));
    const pool = localEs.length > 0 ? localEs : esVoices;

    if (preferMale) {
      return pool.find(v => /raul|raúl|pablo|jorge|gonzalo|alvaro|álvaro|diego/i.test(v.name)) || pool[0];
    } else {
      return pool.find(v => /sabina|helena|paloma|laura|paulina|salome|salomé|dalia/i.test(v.name)) || pool[0];
    }
  }

  function isMaleSelected() {
    const genderEl = document.querySelector("#voice-gender");
    if (!genderEl) return false;
    const val = (genderEl.value + " " + (genderEl.options[genderEl.selectedIndex]?.text || "")).toLowerCase();
    return val.includes("masc") || val.includes("male") || val.includes("hombre");
  }

  // Configurar los menús desplegables para que "Mejor voz española" apunte directo a Sabina o Raul
  function repairVoiceDropdowns() {
    const male = isMaleSelected();
    const bestVoice = getGuaranteedVoice(male);
    if (!bestVoice) return;

    const listEl = document.querySelector("#voice-list");
    if (listEl && listEl.options.length > 0) {
      // Hacer que la opción 0 ("Mejor voz española") tenga el valor exacto de Sabina o Raul
      listEl.options[0].value = bestVoice.name;
      listEl.options[0].textContent = `★ Mejor voz española (${bestVoice.name.replace(/Microsoft /g, "")})`;
      
      // Si estaba seleccionada una voz "Online" que no suena, regresarlo a la funcional
      const currentVal = listEl.value.toLowerCase();
      if (currentVal === "auto" || currentVal === "" || currentVal.includes("online")) {
        listEl.selectedIndex = 0;
        listEl.dispatchEvent(new Event("change"));
      }
    }

    // Asegurar que el tercer selector esté en "Voz local"
    const modeEl = document.querySelector("#voice-engine-mode");
    if (modeEl) {
      for (let i = 0; i < modeEl.options.length; i++) {
        if (modeEl.options[i].text.toLowerCase().includes("local")) {
          modeEl.selectedIndex = i;
          break;
        }
      }
    }
  }

  // Adaptador de pronunciación Sikuani para Sabina y Raul
  function adaptSikuaniText(text) {
    if (!text) return "";
    return text
      .replace(/ë/g, "e")
      .replace(/ü/g, "u")
      .replace(/ts/gi, "t-s")
      .replace(/w/gi, "gu")
      .replace(/k/gi, "c");
  }

  // Interceptar TODA orden de voz de la página
  synth.speak = function(utterance) {
    if (utterance instanceof SpeechSynthesisUtterance) {
      const male = isMaleSelected();
      const safeVoice = getGuaranteedVoice(male);

      // Si no tiene voz asignada, o si tiene asignada una voz "Online" que da error en este PC, usar Sabina/Raul
      if (!utterance.voice || utterance.voice.name.toLowerCase().includes("online")) {
        if (safeVoice) {
          utterance.voice = safeVoice;
          utterance.lang = safeVoice.lang;
        }
      }

      // Mejorar pronunciación si el texto tiene palabras en Sikuani
      if (/detsa|jiwi|juka|kbepona|pexania|xanepana|yabara|neba/i.test(utterance.text)) {
        utterance.text = adaptSikuaniText(utterance.text);
        utterance.rate = 0.88; // Más pausado y claro para Sikuani
      }

      // Si aun así una voz falla, reintentar automáticamente con Sabina/Raul
      utterance.onerror = () => {
        if (safeVoice && utterance.voice !== safeVoice) {
          const fallback = new SpeechSynthesisUtterance(utterance.text);
          fallback.voice = safeVoice;
          fallback.lang = safeVoice.lang;
          fallback.rate = utterance.rate;
          originalSpeak(fallback);
        }
      };

      const statusEl = document.querySelector("#voice-status");
      if (statusEl) {
        utterance.onstart = () => {
          statusEl.textContent = `Audio activo: ${utterance.voice ? utterance.voice.name : "Voz Local"}`;
        };
      }
    }
    return originalSpeak(utterance);
  };

  repairVoiceDropdowns();
  if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = repairVoiceDropdowns;
  }

  const genderEl = document.querySelector("#voice-gender");
  if (genderEl) {
    genderEl.addEventListener("change", () => {
      setTimeout(repairVoiceDropdowns, 50);
    });
  }
})();

// Adaptador fonético avanzado: convierte CUALQUIER texto Sikuani nuevo en fonética exacta
  function adaptSikuaniText(text) {
    if (!text) return "";
    return text
      .toLowerCase()
      // 1. Vocales especiales del Sikuani
      .replace(/ë/g, "e")          // Vocal central no redondeada
      .replace(/ü/g, "u")          // Vocal alta cerrada
      .replace(/ae/g, "a-e")       // Diptongo abierto en Sikuani
      // 2. Consonantes compuestas y oclusivas
      .replace(/ts/g, "t-s")       // Africada alveolar (ej. detsa -> det-sa)
      .replace(/kb/g, "cub")       // Grupo consonántico (ej. kbepona -> cubepona)
      .replace(/kp/g, "cup")       // Oclusiva labial-velar
      .replace(/th/g, "t")         // Dental aspirada
      .replace(/kh/g, "j")         // Velar aspirada
      .replace(/ph/g, "f")         // Bilabial aspirada
      // 3. Adaptación al lector español para que no falle con la K, W, X, J
      .replace(/w/g, "gu")         // w -> gu suave (ej. jiwi -> jlligui)
      .replace(/x/g, "j")          // En ortografía Sikuani la 'x' suena como 'j' suave (ej. pexania -> pejania)
      .replace(/k([ei])/g, "qu$1") // ke, ki -> que, qui
      .replace(/k/g, "c")          // ka, ko, ku -> ca, co, cu
      .replace(/j/g, "j");         // Aspiración glotal
  }