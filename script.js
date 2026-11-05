const PRINT_PRICE_PER_GRAM = 0.12;
const SHIPPING_PRICE = 6.95;
const ORDER_EMAIL = "bambulabservice@gmail.com";
const ACCEPTED_EXTENSIONS = new Set(["stl", "3mf", "obj", "stp", "step"]);

const orderForm = document.querySelector("#order-form");
const weightInput = document.querySelector("#weight");
const estimateOutput = document.querySelector("#estimate-total");
const fileInput = document.querySelector("#model-file");
const fileLabel = document.querySelector("#file-label");
const uploadZone = document.querySelector("#upload-zone");
const formStatus = document.querySelector("#form-status");

const euro = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

function getDeliveryPrice() {
  return document.querySelector('input[name="delivery"]:checked').value === "verzenden"
    ? SHIPPING_PRICE
    : 0;
}

function updateEstimate() {
  const weight = Number(weightInput.value);
  const total = (Number.isFinite(weight) && weight > 0 ? weight : 0) * PRINT_PRICE_PER_GRAM
    + getDeliveryPrice();

  estimateOutput.textContent = euro.format(total);
}

function getFileExtension(fileName) {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot < 0 ? "" : fileName.slice(lastDot + 1).toLowerCase();
}

function updateFileLabel(file) {
  if (!file) {
    fileLabel.textContent = "Kies je 3D-bestand";
    return;
  }

  if (!ACCEPTED_EXTENSIONS.has(getFileExtension(file.name))) {
    fileInput.value = "";
    fileLabel.textContent = "Kies je 3D-bestand";
    formStatus.textContent = "Dit bestandstype wordt nog niet ondersteund. Kies een STL-, 3MF-, OBJ- of STEP-bestand.";
    return;
  }

  fileLabel.textContent = file.name;
  formStatus.textContent = "";
}

weightInput.addEventListener("input", updateEstimate);
document.querySelectorAll('input[name="delivery"]').forEach((input) => {
  input.addEventListener("change", updateEstimate);
});

fileInput.addEventListener("change", () => {
  updateFileLabel(fileInput.files[0]);
});

["dragenter", "dragover"].forEach((eventName) => {
  uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadZone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadZone.classList.remove("is-dragging");
  });
});

uploadZone.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer.files;
  if (!file) return;

  const transfer = new DataTransfer();
  transfer.items.add(file);
  fileInput.files = transfer.files;
  updateFileLabel(file);
});

orderForm.addEventListener("submit", (event) => {
  event.preventDefault();
  formStatus.textContent = "";

  const file = fileInput.files[0];
  if (!file || !ACCEPTED_EXTENSIONS.has(getFileExtension(file.name))) {
    formStatus.textContent = "Kies eerst een geldig 3D-bestand om je aanvraag te versturen.";
    fileInput.focus();
    return;
  }

  const formData = new FormData(orderForm);
  const weight = Number(formData.get("weight"));
  const delivery = formData.get("delivery");
  const deliveryPrice = delivery === "verzenden" ? SHIPPING_PRICE : 0;
  const total = weight * PRINT_PRICE_PER_GRAM + deliveryPrice;
  const body = [
    "Hoi Holy Print Moly,",
    "",
    "Ik wil graag een 3D-print aanvragen.",
    "",
    `Naam: ${formData.get("name")}`,
    `E-mailadres: ${formData.get("email")}`,
    `Modelbestand: ${file.name}`,
    `Geschat gewicht: ${weight} gram`,
    `Ontvangst: ${delivery === "verzenden" ? "Verzenden (€ 6,95)" : "Ophalen (gratis)"}`,
    `Indicatie totaal: ${euro.format(total)}`,
    "",
    "Ik voeg mijn 3D-model toe als bijlage.",
  ].join("\n");
  const subject = `3D-printaanvraag — ${formData.get("name")}`;
  const mailto = `mailto:${ORDER_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  formStatus.innerHTML = `Je e-mailprogramma wordt geopend. Voeg <strong>${file.name.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character])}</strong> toe als bijlage en verstuur je aanvraag. Werkt dat niet? <a href="${mailto}">Open je e-mail opnieuw</a>.`;
  window.location.href = mailto;
});

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

updateEstimate();
