const PRINT_PRICE_PER_GRAM = 0.12;
const CUSTOM_MODEL_PROCESSING_FEE = 2;
const ORDER_EMAIL = "bambulabservice@gmail.com";
const MAX_STL_BYTES = 25 * 1024 * 1024;
const MAX_STL_TRIANGLES = 25000;

const weightInput = document.querySelector("#weight");
const estimateOutput = document.querySelector("#estimate-total");
const emailLink = document.querySelector("#email-link");
const filamentChoice = document.querySelector("#filament-choice");
const filamentOptions = window.HPM_FILAMENT_OPTIONS;
const themeToggle = document.querySelector("#theme-toggle");
const stlInput = document.querySelector("#stl-file");
const canvas = document.querySelector("#model-canvas");
const previewStage = document.querySelector("#preview-stage");
const previewEmpty = document.querySelector("#preview-empty");
const previewStatus = document.querySelector("#preview-status");
const previewFile = document.querySelector("#preview-file");
const previewReset = document.querySelector("#preview-reset");
const typedPhrase = document.querySelector("#typed-phrase");
const context = canvas.getContext("2d");
const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const heroPhrases = [
  "Laag voor laag.",
  "Van idee naar echt.",
  "Met aandacht gemaakt.",
  "Samen maken we meer.",
  "Klein idee. Groot gemaakt.",
  "Ontworpen door jou.",
];
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

filamentOptions.forEach((filament) => {
  const option = document.createElement("option");
  option.value = filament.id;
  option.textContent = filament.label;
  filamentChoice.append(option);
});

let triangles = [];
let modelScale = 1;
let rotationX = -0.48;
let rotationY = 0.55;
let zoom = 1;
let isDragging = false;
let dragPosition = null;
let animationFrame = 0;
let lastFrame = 0;
let pointerFrame = 0;
let lastPointerEvent = null;

function updateEstimate() {
  const weight = Number(weightInput.value);
  const hasWeight = weightInput.value !== "" && Number.isFinite(weight) && weight > 0;
  const printPrice = hasWeight ? weight * PRINT_PRICE_PER_GRAM : null;
  const total = hasWeight ? printPrice + CUSTOM_MODEL_PROCESSING_FEE : null;

  estimateOutput.textContent = total === null ? "Vul gewicht in" : euro.format(total);

  const body = [
    "Hoi Thomas en Joel,",
    "",
    "Ik wil graag informeren naar een 3D-print op jullie Bambu Lab P1S.",
    "",
    `Filamentgewicht volgens Bambu Studio: ${hasWeight ? `${weight} gram` : "nog niet bekend"}`,
    `Filamentkleur: ${filamentOptions.find((filament) => filament.id === filamentChoice.value)?.label || "nog niet gekozen"}`,
    `Verwerkingskosten eigen model: ${euro.format(CUSTOM_MODEL_PROCESSING_FEE)}`,
    "Ophalen: gratis bij Kareldoormanweg 27, Tollebeek (op afspraak)",
    `Prijsindicatie: ${total === null ? "nog niet bekend" : euro.format(total)}`,
    "Betalen kan bij ophalen, liefst contant; Tikkie kan ook.",
    "",
    "Ik voeg mijn geslicete bestand uit Bambu Studio (.3mf of .gcode.3mf) zelf als bijlage toe.",
  ].join("\n");
  emailLink.href = `mailto:${ORDER_EMAIL}?subject=${encodeURIComponent("3D-printaanvraag — Holy Print Moly")}&body=${encodeURIComponent(body)}`;
}

function setTheme(isDark) {
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute("aria-label", isDark ? "Schakel naar light theme" : "Schakel naar dark theme");
  themeToggle.querySelector(".theme-icon").textContent = isDark ? "☀" : "☾";
  themeToggle.querySelector(".theme-label").textContent = isDark ? "Light theme" : "Dark theme";
  document.querySelector('meta[name="theme-color"]').content = isDark ? "#10172b" : "#f4f6fb";
  if (triangles.length) drawModel();
}

function startHeroTyping() {
  const previousIndex = Number(localStorage.getItem("hpm-hero-phrase-index"));
  const nextIndex = Number.isInteger(previousIndex)
    ? (previousIndex + 1) % heroPhrases.length
    : Math.floor(Math.random() * heroPhrases.length);
  localStorage.setItem("hpm-hero-phrase-index", String(nextIndex));

  const selectedPhrase = heroPhrases[nextIndex];
  if (prefersReducedMotion.matches) {
    typedPhrase.textContent = selectedPhrase;
    return;
  }

  let phraseIndex = nextIndex;
  let characterIndex = selectedPhrase.length;
  let deleting = true;

  const typeStep = () => {
    const phrase = heroPhrases[phraseIndex];

    if (deleting) {
      characterIndex -= 1;
    } else {
      characterIndex += 1;
    }

    typedPhrase.textContent = phrase.slice(0, characterIndex);

    if (deleting && characterIndex === 0) {
      deleting = false;
      phraseIndex = (phraseIndex + 1) % heroPhrases.length;
    } else if (!deleting && characterIndex === phrase.length) {
      deleting = true;
      window.setTimeout(typeStep, 2300);
      return;
    }

    window.setTimeout(typeStep, deleting ? 48 : 78);
  };

  window.setTimeout(typeStep, 2300);
}

function trackAmbientLight(event) {
  lastPointerEvent = event;
  if (pointerFrame) return;

  pointerFrame = requestAnimationFrame(() => {
    pointerFrame = 0;
    const pointer = lastPointerEvent;
    if (!pointer) return;

    document.documentElement.style.setProperty("--glow-x", `${pointer.clientX}px`);
    document.documentElement.style.setProperty("--glow-y", `${pointer.clientY}px`);

    const target = pointer.target instanceof Element ? pointer.target : null;
    const surface = target?.closest(".hero-art, .glass-card, .order-card, .step");
    document.querySelectorAll(".hero-art, .glass-card, .order-card, .step").forEach((element) => {
      if (element === surface) {
        const bounds = element.getBoundingClientRect();
        element.style.setProperty("--surface-x", `${pointer.clientX - bounds.left}px`);
        element.style.setProperty("--surface-y", `${pointer.clientY - bounds.top}px`);
      } else {
        element.style.removeProperty("--surface-x");
        element.style.removeProperty("--surface-y");
      }
    });
  });
}

function parseBinarySTL(buffer) {
  const view = new DataView(buffer);
  const count = view.getUint32(80, true);
  const expectedSize = 84 + count * 50;

  if (expectedSize > buffer.byteLength || count === 0) return null;
  if (count > MAX_STL_TRIANGLES) {
    throw new Error(`Dit model bevat ${count.toLocaleString("nl-NL")} vlakken. De preview ondersteunt maximaal ${MAX_STL_TRIANGLES.toLocaleString("nl-NL")} vlakken.`);
  }

  const points = new Float32Array(count * 9);
  let offset = 84;
  for (let triangle = 0; triangle < count; triangle += 1) {
    offset += 12;
    for (let vertex = 0; vertex < 9; vertex += 1) {
      points[triangle * 9 + vertex] = view.getFloat32(offset, true);
      offset += 4;
    }
    offset += 2;
  }
  return points;
}

function parseAsciiSTL(buffer) {
  const source = new TextDecoder().decode(buffer);
  const vertexPattern = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/gi;
  const vertices = [];
  let match;

  while ((match = vertexPattern.exec(source)) !== null) {
    vertices.push(Number(match[1]), Number(match[2]), Number(match[3]));
    if (vertices.length / 9 > MAX_STL_TRIANGLES) {
      throw new Error(`Dit model bevat meer dan ${MAX_STL_TRIANGLES.toLocaleString("nl-NL")} vlakken. De preview ondersteunt kleinere STL-bestanden.`);
    }
  }

  if (vertices.length === 0 || vertices.length % 9 !== 0) {
    throw new Error("Dit bestand lijkt geen geldig STL-model. Exporteer het opnieuw als STL en probeer het nog eens.");
  }
  return new Float32Array(vertices);
}

function prepareModel(points) {
  const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let index = 0; index < points.length; index += 3) {
    bounds[0] = Math.min(bounds[0], points[index]);
    bounds[1] = Math.min(bounds[1], points[index + 1]);
    bounds[2] = Math.min(bounds[2], points[index + 2]);
    bounds[3] = Math.max(bounds[3], points[index]);
    bounds[4] = Math.max(bounds[4], points[index + 1]);
    bounds[5] = Math.max(bounds[5], points[index + 2]);
  }

  const center = [
    (bounds[0] + bounds[3]) / 2,
    (bounds[1] + bounds[4]) / 2,
    (bounds[2] + bounds[5]) / 2,
  ];
  const largestDimension = Math.max(bounds[3] - bounds[0], bounds[4] - bounds[1], bounds[5] - bounds[2]);
  if (!Number.isFinite(largestDimension) || largestDimension === 0) {
    throw new Error("Dit STL-bestand bevat geen bruikbaar 3D-model.");
  }
  modelScale = 2 / largestDimension;

  const nextTriangles = [];
  for (let index = 0; index < points.length; index += 9) {
    const vertices = [];
    for (let vertex = 0; vertex < 9; vertex += 3) {
      vertices.push([
        (points[index + vertex] - center[0]) * modelScale,
        (points[index + vertex + 1] - center[1]) * modelScale,
        (points[index + vertex + 2] - center[2]) * modelScale,
      ]);
    }
    const [a, b, c] = vertices;
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const normal = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    const normalLength = Math.hypot(...normal) || 1;

    nextTriangles.push({
      vertices,
      normal: normal.map((component) => component / normalLength),
      depth: 0,
    });
  }

  triangles = nextTriangles;
  rotationX = -0.48;
  rotationY = 0.55;
  zoom = 1;
}

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rotatePoint([x, y, z], cosineY, sineY, cosineX, sineX) {
  const rotatedX = x * cosineY + z * sineY;
  const rotatedZ = -x * sineY + z * cosineY;
  return [
    rotatedX,
    y * cosineX - rotatedZ * sineX,
    y * sineX + rotatedZ * cosineX,
  ];
}

function drawModel() {
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(bounds.width * pixelRatio);
  canvas.height = Math.round(bounds.height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const width = bounds.width;
  const height = bounds.height;
  const cosineY = Math.cos(rotationY);
  const sineY = Math.sin(rotationY);
  const cosineX = Math.cos(rotationX);
  const sineX = Math.sin(rotationX);
  const projected = triangles.map((triangle) => {
    const vertices = triangle.vertices.map((vertex) => rotatePoint(vertex, cosineY, sineY, cosineX, sineX));
    const normal = rotatePoint(triangle.normal, cosineY, sineY, cosineX, sineX);
    triangle.depth = (vertices[0][2] + vertices[1][2] + vertices[2][2]) / 3;
    return { vertices, normal, depth: triangle.depth };
  });
  projected.sort((a, b) => a.depth - b.depth);

  const rootStyle = getComputedStyle(document.documentElement);
  const blue = hexToRgb(rootStyle.getPropertyValue("--blue").trim());
  const red = hexToRgb(rootStyle.getPropertyValue("--red").trim());
  const centerX = width / 2;
  const centerY = height / 2;
  const perspective = Math.min(width, height) * 0.56 * zoom;
  const light = [-0.38, 0.58, 0.72];
  const edgeColor = document.documentElement.dataset.theme === "dark"
    ? "rgba(255,255,255,.2)"
    : "rgba(16,35,79,.2)";

  context.clearRect(0, 0, width, height);
  projected.forEach(({ vertices, normal, depth }) => {
    const lightAmount = Math.max(0, normal[0] * light[0] + normal[1] * light[1] + normal[2] * light[2]);
    const shade = 0.42 + lightAmount * 0.58;
    const base = normal[0] > 0.35 ? red : blue;
    const color = base.map((channel) => Math.round(channel * shade));
    context.beginPath();
    vertices.forEach(([x, y, z], index) => {
      const factor = perspective / (3.4 - z);
      const screenX = centerX + x * factor;
      const screenY = centerY - y * factor;
      if (index === 0) context.moveTo(screenX, screenY);
      else context.lineTo(screenX, screenY);
    });
    context.closePath();
    context.fillStyle = `rgb(${color.join(" ")})`;
    context.fill();
    context.strokeStyle = edgeColor;
    context.lineWidth = 0.7;
    context.stroke();
  });
}

function animateModel(timestamp) {
  animationFrame = 0;
  if (timestamp - lastFrame < 40) {
    animationFrame = requestAnimationFrame(animateModel);
    return;
  }
  lastFrame = timestamp;
  rotationY += 0.009;
  drawModel();
  animationFrame = requestAnimationFrame(animateModel);
}

function startModelAnimation() {
  if (triangles.length && !animationFrame && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    animationFrame = requestAnimationFrame(animateModel);
  }
}

function stopModelAnimation() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = 0;
}

async function loadSTL(file) {
  if (!file.name.toLowerCase().endsWith(".stl")) {
    previewStatus.textContent = "Kies een STL-bestand voor de 3D-preview.";
    return;
  }
  if (file.size > MAX_STL_BYTES) {
    previewStatus.textContent = "Dit bestand is groter dan 25 MB. Exporteer een kleinere STL voor de preview.";
    return;
  }

  previewStatus.textContent = "STL wordt lokaal ingelezen…";
  try {
    const buffer = await file.arrayBuffer();
    const points = buffer.byteLength >= 84 ? parseBinarySTL(buffer) ?? parseAsciiSTL(buffer) : parseAsciiSTL(buffer);
    prepareModel(points);
    previewEmpty.hidden = true;
    canvas.classList.add("is-visible");
    previewFile.textContent = `${file.name} · ${triangles.length.toLocaleString("nl-NL")} VLAKKEN`;
    previewReset.disabled = false;
    previewStatus.textContent = "Model geladen. Sleep om te draaien en scroll om in of uit te zoomen. Het bestand is niet geüpload.";
    drawModel();
    startModelAnimation();
  } catch (error) {
    triangles = [];
    stopModelAnimation();
    canvas.classList.remove("is-visible");
    previewEmpty.hidden = false;
    previewFile.textContent = "GEEN MODEL GEOPEND";
    previewReset.disabled = true;
    previewStatus.textContent = error instanceof Error ? error.message : "Het STL-bestand kon niet worden geopend.";
  }
}

function resizeCanvas() {
  if (triangles.length) drawModel();
}

weightInput.addEventListener("input", updateEstimate);
filamentChoice.addEventListener("change", updateEstimate);

themeToggle.addEventListener("click", () => {
  const isDark = document.documentElement.dataset.theme !== "dark";
  setTheme(isDark);
  localStorage.setItem("hpm-theme", isDark ? "dark" : "light");
});

const savedTheme = localStorage.getItem("hpm-theme");
setTheme(savedTheme === "dark");

stlInput.addEventListener("change", () => {
  const [file] = stlInput.files;
  if (file) loadSTL(file);
});

previewStage.addEventListener("dragover", (event) => {
  event.preventDefault();
  previewStage.classList.add("is-dragging");
});

previewStage.addEventListener("dragleave", (event) => {
  if (!previewStage.contains(event.relatedTarget)) previewStage.classList.remove("is-dragging");
});

previewStage.addEventListener("drop", (event) => {
  event.preventDefault();
  previewStage.classList.remove("is-dragging");
  const [file] = event.dataTransfer.files;
  if (file) loadSTL(file);
});

previewStage.addEventListener("pointerdown", (event) => {
  if (!triangles.length) return;
  isDragging = true;
  dragPosition = [event.clientX, event.clientY];
  previewStage.setPointerCapture(event.pointerId);
  stopModelAnimation();
});

previewStage.addEventListener("pointermove", (event) => {
  if (!isDragging || !dragPosition) return;
  rotationY += (event.clientX - dragPosition[0]) * 0.012;
  rotationX = Math.max(-1.5, Math.min(1.5, rotationX + (event.clientY - dragPosition[1]) * 0.012));
  dragPosition = [event.clientX, event.clientY];
  drawModel();
});

previewStage.addEventListener("pointerup", () => {
  if (!isDragging) return;
  isDragging = false;
  dragPosition = null;
  startModelAnimation();
});

previewStage.addEventListener("pointercancel", () => {
  isDragging = false;
  dragPosition = null;
  startModelAnimation();
});

previewStage.addEventListener("wheel", (event) => {
  if (!triangles.length) return;
  event.preventDefault();
  zoom = Math.max(0.55, Math.min(2.5, zoom * (event.deltaY < 0 ? 1.08 : 0.92)));
  drawModel();
}, { passive: false });

previewReset.addEventListener("click", () => {
  rotationX = -0.48;
  rotationY = 0.55;
  zoom = 1;
  drawModel();
});

new ResizeObserver(resizeCanvas).observe(previewStage);

if ("IntersectionObserver" in window) {
  document.documentElement.classList.add("has-motion");
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
}

if (window.matchMedia("(hover: hover) and (pointer: fine)").matches && !prefersReducedMotion.matches) {
  document.addEventListener("pointermove", trackAmbientLight, { passive: true });
}

startHeroTyping();
updateEstimate();
