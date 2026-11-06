const productGrid = document.querySelector("#product-grid");
const searchInput = document.querySelector("#product-search");
const collectionCount = document.querySelector("#collection-count");
const noResults = document.querySelector("#no-results");
const themeToggle = document.querySelector("#theme-toggle");
const cartToggle = document.querySelector("#cart-toggle");
const cartCount = document.querySelector("#cart-count");
const cartDialog = document.querySelector("#cart-dialog");
const variantDialog = document.querySelector("#variant-dialog");
const variantList = document.querySelector("#variant-list");
const cartItems = document.querySelector("#cart-items");
const cartEmpty = document.querySelector("#cart-empty");
const cartTotal = document.querySelector("#cart-total");
const checkoutButton = document.querySelector("#checkout-button");
const cartStatus = document.querySelector("#cart-status");
const products = window.HPM_STORE_PRODUCTS;
const filamentOptions = window.HPM_FILAMENT_OPTIONS;
const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const cartStorageKey = "hpm-store-cart";
const productQuantityLimit = 5;
let cart = loadCart();
let pointerFrame = 0;
let lastPointerEvent = null;

function isPriceAvailable(product) {
  return Number.isFinite(product.price) && product.price >= 0;
}

function loadCart() {
  try {
    const savedCart = JSON.parse(localStorage.getItem(cartStorageKey) || "[]");
    if (!Array.isArray(savedCart)) throw new TypeError("Winkelmand moet een lijst zijn");

    const quantitiesByProduct = new Map();
    return savedCart.filter((item) => {
      const product = products.find((entry) => entry.folder === item.productFolder);
      const hasVariant = !item.variantFile
        || product?.variants?.some((variant) => variant.file === item.variantFile);
      if (!product || !hasVariant || !Number.isInteger(item.quantity) || item.quantity <= 0) return false;
      if (!filamentOptions.some((filament) => filament.id === item.filamentId)) item.filamentId = "";

      const alreadyInCart = quantitiesByProduct.get(product.folder) || 0;
      const allowedQuantity = Math.min(item.quantity, productQuantityLimit - alreadyInCart);
      if (allowedQuantity <= 0) return false;

      item.quantity = allowedQuantity;
      quantitiesByProduct.set(product.folder, alreadyInCart + allowedQuantity);
      return true;
    });
  } catch (error) {
    console.warn("De bewaarde winkelmand kon niet worden geladen.", error);
    return [];
  }
}

function persistCart() {
  try {
    localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  } catch (error) {
    console.error("De winkelmand kon niet worden bewaard.", error);
    cartStatus.textContent = "Winkelmand kon niet worden bewaard op dit apparaat.";
  }
}

function setTheme(isDark) {
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute("aria-label", isDark ? "Schakel naar light theme" : "Schakel naar dark theme");
  themeToggle.querySelector(".theme-icon").textContent = isDark ? "☀" : "☾";
  themeToggle.querySelector(".theme-label").textContent = isDark ? "Light theme" : "Dark theme";
  document.querySelector('meta[name="theme-color"]').content = isDark ? "#10172b" : "#f4f6fb";
}

function cartItemKey(productFolder, variantFile = "", filamentId = "") {
  return `${productFolder}::${variantFile}::${filamentId}`;
}

function getProductQuantity(productFolder) {
  return cart.reduce((total, item) => (
    item.productFolder === productFolder ? total + item.quantity : total
  ), 0);
}

function getVariant(product, variantFile) {
  return product.variants?.find((variant) => variant.file === variantFile);
}

function addToCart(product, filamentId, variant = null) {
  if (getProductQuantity(product.folder) >= productQuantityLimit) {
    cartStatus.textContent = `Je kunt maximaal ${productQuantityLimit} ${product.name} bestellen.`;
    return;
  }

  const existing = cart.find((item) => item.productFolder === product.folder
    && item.variantFile === (variant?.file || "")
    && item.filamentId === filamentId);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      productFolder: product.folder,
      variantFile: variant?.file || "",
      filamentId,
      quantity: 1,
    });
  }

  persistCart();
  renderCart();
  renderProducts(searchInput.value);
  cartStatus.textContent = `${product.name}${variant ? ` — ${variant.name}` : ""} toegevoegd aan je winkelmand.`;
}

function openVariantPicker(product, filamentId) {
  document.querySelector("#variant-dialog-title").textContent = `Kies een ${product.name}`;
  document.querySelector("#variant-dialog-description").textContent =
    "Kies hieronder de uitvoering die je aan je winkelmand wilt toevoegen.";
  variantList.replaceChildren();

  product.variants.forEach((variant) => {
    const option = document.createElement("button");
    option.className = "variant-option";
    option.type = "button";
    option.disabled = getProductQuantity(product.folder) >= productQuantityLimit;

    const name = document.createElement("span");
    name.textContent = variant.name;

    const addLabel = document.createElement("span");
    addLabel.className = "variant-option-add";
    addLabel.textContent = "Toevoegen +";

    option.append(name, addLabel);
    option.addEventListener("click", () => {
      addToCart(product, filamentId, variant);
      variantDialog.close();
    });
    variantList.append(option);
  });

  variantDialog.showModal();
}

function createFilamentSelect(value, label) {
  const select = document.createElement("select");
  select.className = "filament-select";
  select.setAttribute("aria-label", label);

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Kies een kleur";
  select.append(placeholder);

  filamentOptions.forEach((filament) => {
    const option = document.createElement("option");
    option.value = filament.id;
    option.textContent = filament.label;
    select.append(option);
  });
  select.value = value || "";
  return select;
}

function setCartItemFilament(item, filamentId) {
  item.filamentId = filamentId;
  const duplicate = cart.find((entry) => entry !== item
    && entry.productFolder === item.productFolder
    && entry.variantFile === item.variantFile
    && entry.filamentId === filamentId);
  if (duplicate) {
    duplicate.quantity += item.quantity;
    cart = cart.filter((entry) => entry !== item);
  }
  persistCart();
  renderCart();
  renderProducts(searchInput.value);
}

function renderCart() {
  const quantity = cart.reduce((total, item) => total + item.quantity, 0);
  cartCount.textContent = quantity.toString();
  cartToggle.setAttribute("aria-label", `Winkelmand, ${quantity} ${quantity === 1 ? "artikel" : "artikelen"}`);
  cartItems.replaceChildren();
  cartEmpty.hidden = cart.length > 0;
  checkoutButton.disabled = cart.length === 0 || cart.some((item) => !item.filamentId);

  let total = 0;
  let hasUnknownPrice = false;

  cart.forEach((item) => {
    const product = products.find((entry) => entry.folder === item.productFolder);
    if (!product) return;
    const variant = getVariant(product, item.variantFile);
    const row = document.createElement("article");
    row.className = "cart-item";
    row.dataset.key = cartItemKey(item.productFolder, item.variantFile, item.filamentId);

    const details = document.createElement("div");
    details.className = "cart-item-details";
    const title = document.createElement("h3");
    title.textContent = product.name;
    details.append(title);

    if (variant) {
      const variantName = document.createElement("p");
      variantName.className = "cart-item-variant";
      variantName.textContent = variant.name;
      details.append(variantName);
    }

    const filamentSelect = createFilamentSelect(item.filamentId, `Filamentkleur voor ${product.name}`);
    filamentSelect.addEventListener("change", () => setCartItemFilament(item, filamentSelect.value));
    details.append(filamentSelect);

    const linePrice = document.createElement("p");
    linePrice.className = "cart-item-price";
    if (isPriceAvailable(product)) {
      linePrice.textContent = `${euro.format(product.price)} per stuk`;
      total += product.price * item.quantity;
    } else {
      linePrice.textContent = "Prijs volgt";
      hasUnknownPrice = true;
    }
    details.append(linePrice);

    const controls = document.createElement("div");
    controls.className = "cart-item-controls";
    const decrease = document.createElement("button");
    decrease.type = "button";
    decrease.textContent = "−";
    decrease.setAttribute("aria-label", `Een ${product.name} minder`);
    decrease.addEventListener("click", () => changeQuantity(item, -1));

    const quantityLabel = document.createElement("span");
    quantityLabel.textContent = item.quantity.toString();
    quantityLabel.setAttribute("aria-label", `Aantal: ${item.quantity}`);

    const increase = document.createElement("button");
    increase.type = "button";
    increase.textContent = "+";
    increase.setAttribute("aria-label", `Een ${product.name} meer`);
    increase.disabled = getProductQuantity(product.folder) >= productQuantityLimit;
    increase.addEventListener("click", () => changeQuantity(item, 1));

    const remove = document.createElement("button");
    remove.className = "cart-item-remove";
    remove.type = "button";
    remove.textContent = "Verwijder";
    remove.setAttribute("aria-label", `${product.name} verwijderen`);
    remove.addEventListener("click", () => removeFromCart(item));

    controls.append(decrease, quantityLabel, increase, remove);
    row.append(details, controls);
    cartItems.append(row);
  });

  cartTotal.textContent = cart.length === 0
    ? "—"
    : hasUnknownPrice
      ? "Prijs volgt"
      : euro.format(total);
}

function changeQuantity(item, amount) {
  if (amount > 0 && getProductQuantity(item.productFolder) >= productQuantityLimit) {
    const product = products.find((entry) => entry.folder === item.productFolder);
    cartStatus.textContent = `Je kunt maximaal ${productQuantityLimit} ${product.name} bestellen.`;
    return;
  }

  item.quantity += amount;
  if (item.quantity <= 0) {
    cart = cart.filter((entry) => entry !== item);
  }
  persistCart();
  renderCart();
  renderProducts(searchInput.value);
}

function removeFromCart(item) {
  cart = cart.filter((entry) => entry !== item);
  persistCart();
  renderCart();
  renderProducts(searchInput.value);
}

function buildCheckoutMailto() {
  const lines = cart.map((item) => {
    const product = products.find((entry) => entry.folder === item.productFolder);
    const variant = getVariant(product, item.variantFile);
    const selection = variant ? ` — ${variant.name}` : "";
    const filament = filamentOptions.find((entry) => entry.id === item.filamentId);
    const price = isPriceAvailable(product) ? ` (${euro.format(product.price)} per stuk)` : " (prijs volgt)";
    return `- ${product.name}${selection} — ${filament?.label || "kleur nog te kiezen"} × ${item.quantity}${price}`;
  });
  const body = [
    "Hoi Thomas en Joel,",
    "",
    "Ik wil graag de volgende modellen bestellen:",
    ...lines,
    "",
    "Ik haal de bestelling graag op bij Kareldoormanweg 27, Tollebeek.",
    "Ik betaal bij ophalen, liefst contant; betalen via Tikkie kan ook.",
    "Willen jullie de bestelling, prijs en verdere details met mij bevestigen?",
    "",
    "Alvast bedankt!",
  ].join("\n");
  const subject = encodeURIComponent("Bestelling — Holy Print Moly Store");
  return `mailto:bambulabservice@gmail.com?subject=${subject}&body=${encodeURIComponent(body)}`;
}

function checkout() {
  if (cart.length === 0) return;
  window.location.href = buildCheckoutMailto();
}

function renderProducts(query = "") {
  const searchTerm = query.trim().toLocaleLowerCase("nl");
  const matches = products.filter((product) => product.name.toLocaleLowerCase("nl").includes(searchTerm)
    || product.variants?.some((variant) => variant.name.toLocaleLowerCase("nl").includes(searchTerm)));

  collectionCount.textContent = matches.length.toString().padStart(2, "0");
  noResults.hidden = matches.length !== 0;
  productGrid.replaceChildren();

  matches.forEach((product, index) => {
    const card = document.createElement("article");
    card.className = "product-card reveal-card";
    card.style.setProperty("--card-index", index);

    const imageFrame = document.createElement("div");
    imageFrame.className = "product-image-frame";

    const productImages = product.images || [product.image];
    const imageContainer = productImages.length > 1
      ? document.createElement("div")
      : imageFrame;
    if (imageContainer !== imageFrame) {
      imageContainer.className = "product-image-gallery";
      imageContainer.setAttribute("role", "group");
      imageContainer.setAttribute("aria-label", `Foto's van ${product.name}`);
      imageFrame.append(imageContainer);
    }

    productImages.forEach((imageFile, imageNumber) => {
      const image = document.createElement("img");
      image.className = "product-image";
      image.src = `./modelen/${encodeURIComponent(product.folder)}/${encodeURIComponent(imageFile)}`;
      image.alt = productImages.length > 1
        ? `Voorbeeld ${imageNumber + 1} van ${product.name}`
        : `Voorbeeld van ${product.name}`;
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", () => {
        image.remove();
        if (!imageFrame.querySelector(".product-image")) {
          imageFrame.classList.add("image-unavailable");
        }
      }, { once: true });
      imageContainer.append(image);
    });

    const imageIndex = document.createElement("span");
    imageIndex.className = "product-index";
    imageIndex.textContent = `HPM / ${String(products.indexOf(product) + 1).padStart(2, "0")}`;

    const imageLabel = document.createElement("span");
    imageLabel.className = "product-image-label";
    imageLabel.textContent = "3D PRINT · P1S";
    imageFrame.append(imageIndex, imageLabel);

    const details = document.createElement("div");
    details.className = "product-details";
    const filamentSelect = createFilamentSelect("", `Filamentkleur voor ${product.name}`);
    filamentSelect.classList.add("product-filament-select");

    const category = document.createElement("p");
    category.className = "product-category";
    category.textContent = product.category || "FIDGETS · OP AANVRAAG";

    const title = document.createElement("h3");
    title.textContent = product.name;

    const price = document.createElement("p");
    price.className = `product-price${isPriceAvailable(product) ? "" : " is-pending"}`;
    price.textContent = isPriceAvailable(product) ? euro.format(product.price) : "Prijs volgt";

    const addButton = document.createElement("button");
    addButton.className = "product-order";
    addButton.type = "button";
    const atLimit = getProductQuantity(product.folder) >= productQuantityLimit;
    addButton.disabled = atLimit || !filamentSelect.value;
    addButton.innerHTML = atLimit
      ? 'Limiet bereikt <span aria-hidden="true">✓</span>'
      : !filamentSelect.value
        ? 'Kies een kleur <span aria-hidden="true">⌄</span>'
      : product.variants?.length > 1
        ? 'Kies model <span aria-hidden="true">⌄</span>'
        : 'In winkelmand <span aria-hidden="true">+</span>';
    addButton.setAttribute("aria-label", product.variants?.length > 1
      ? `Kies een model van ${product.name}`
      : `${product.name} in winkelmand doen`);
    addButton.addEventListener("click", () => {
      if (!filamentSelect.value) return;
      if (product.variants?.length > 1) {
        openVariantPicker(product, filamentSelect.value);
      } else {
        addToCart(product, filamentSelect.value);
      }
    });
    filamentSelect.addEventListener("change", () => {
      const selected = filamentSelect.value;
      addButton.disabled = atLimit || !selected;
      addButton.innerHTML = atLimit
        ? 'Limiet bereikt <span aria-hidden="true">✓</span>'
        : product.variants?.length > 1
          ? 'Kies model <span aria-hidden="true">⌄</span>'
          : 'In winkelmand <span aria-hidden="true">+</span>';
    });

    const bottomRow = document.createElement("div");
    bottomRow.className = "product-bottom-row";
    bottomRow.append(price, addButton);
    details.append(category, title, filamentSelect);
    if (product.variants?.length > 1) {
      const variantHint = document.createElement("p");
      variantHint.className = "product-variant-hint";
      variantHint.textContent = `${product.variants.length} uitvoeringen`;
      details.append(variantHint);
    }
    details.append(bottomRow);
    card.append(imageFrame, details);
    productGrid.append(card);
  });
}

themeToggle.addEventListener("click", () => {
  const isDark = document.documentElement.dataset.theme !== "dark";
  setTheme(isDark);
  localStorage.setItem("hpm-theme", isDark ? "dark" : "light");
});

searchInput.addEventListener("input", () => renderProducts(searchInput.value));
cartToggle.addEventListener("click", () => {
  renderCart();
  cartDialog.showModal();
});
checkoutButton.addEventListener("click", checkout);
document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});
document.querySelectorAll(".store-dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

function updateAmbientLight(event) {
  lastPointerEvent = event;
  if (pointerFrame) return;

  pointerFrame = requestAnimationFrame(() => {
    pointerFrame = 0;
    const pointer = lastPointerEvent;
    if (!pointer) return;

    document.documentElement.style.setProperty("--glow-x", `${pointer.clientX}px`);
    document.documentElement.style.setProperty("--glow-y", `${pointer.clientY}px`);

    const target = pointer.target instanceof Element ? pointer.target : null;
    const surface = target?.closest(".store-hero-art, .product-card");
    document.querySelectorAll(".store-hero-art, .product-card").forEach((element) => {
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

if (window.matchMedia("(hover: hover) and (pointer: fine)").matches
  && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.addEventListener("pointermove", updateAmbientLight, { passive: true });
}

const savedTheme = localStorage.getItem("hpm-theme");
setTheme(savedTheme === "dark");
renderProducts();
renderCart();
