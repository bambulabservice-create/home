const PRINT_PRICE_PER_GRAM = 0.12;
const SHIPPING_PRICE = 6.95;
const ORDER_EMAIL = "bambulabservice@gmail.com";

const weightInput = document.querySelector("#weight");
const estimateOutput = document.querySelector("#estimate-total");
const emailLink = document.querySelector("#email-link");

const euro = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

function getDeliveryDetails() {
  const delivery = document.querySelector('input[name="delivery"]:checked').value;
  return {
    label: delivery === "verzenden" ? "Verzenden" : "Ophalen bij Kareldoormanweg 27, Tollebeek",
    price: delivery === "verzenden" ? SHIPPING_PRICE : 0,
  };
}

function updateEstimate() {
  const weight = Number(weightInput.value);
  const hasWeight = weightInput.value !== "" && Number.isFinite(weight) && weight > 0;
  const delivery = getDeliveryDetails();
  const total = hasWeight ? weight * PRINT_PRICE_PER_GRAM + delivery.price : null;

  estimateOutput.textContent = total === null ? "Vul gewicht in" : euro.format(total);

  const body = [
    "Hoi Thomas en Joel,",
    "",
    "Ik wil graag informeren naar een 3D-print op jullie Bambu Lab P1S.",
    "",
    `Filamentgewicht volgens Bambu Studio: ${hasWeight ? `${weight} gram` : "nog niet bekend"}`,
    `Ontvangst: ${delivery.label}${delivery.price ? ` (${euro.format(delivery.price)})` : " (gratis)"}`,
    `Prijsindicatie: ${total === null ? "nog niet bekend" : euro.format(total)}`,
    "",
    "Ik voeg mijn geslicete bestand uit Bambu Studio (.3mf of .gcode.3mf) zelf als bijlage toe.",
  ].join("\n");
  const subject = "3D-printaanvraag — Holy Print Moly";

  emailLink.href = `mailto:${ORDER_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

weightInput.addEventListener("input", updateEstimate);
document.querySelectorAll('input[name="delivery"]').forEach((input) => {
  input.addEventListener("change", updateEstimate);
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
