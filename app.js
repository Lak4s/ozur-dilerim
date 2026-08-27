const PHOTO_IDS = ["1", "2", "3", "4", "letter"];
const DB_NAME = "kalp-photos";
const STORE = "photos";
const DIM_KEY = "kalp-dim";
const DIM_DEFAULT = 50;

function clampDim(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DIM_DEFAULT;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function getDim() {
  return clampDim(localStorage.getItem(DIM_KEY) ?? DIM_DEFAULT);
}

function applyDim(value) {
  const n = clampDim(value);
  document.documentElement.style.setProperty("--scene-dim", String(n / 100));
  const output = document.getElementById("dim-value");
  const input = document.getElementById("dim-input");
  if (output) output.textContent = `${n}%`;
  if (input) input.value = String(n);
}

function setDim(value) {
  const n = clampDim(value);
  localStorage.setItem(DIM_KEY, String(n));
  applyDim(n);
}
const LETTER_KEY = "kalp-letter";
const GREETING_KEY = "kalp-greeting";
const STICKER_KEY = "kalp-sticker";
const objectUrls = new Map();

const viewHome = document.getElementById("view-home");
const viewInbox = document.getElementById("view-inbox");
const btnYes = document.getElementById("btn-yes");
const btnNo = document.getElementById("btn-no");
const mailToast = document.getElementById("mail-toast");
const letterBody = document.getElementById("letter-body");
const letterGreet = document.getElementById("letter-greet");
const heartSticker = document.getElementById("heart-sticker");
const envelope = document.getElementById("envelope");
const envelopeOpen = document.getElementById("envelope-open");
let envelopeTimer = 0;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(id, blob) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).put(blob, id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbClear() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function bindFallback(img, id) {
  if (img.dataset.bound === "1") return;
  img.dataset.bound = "1";
  img.addEventListener("error", () => {
    if (img.dataset.fallback === "1") return;
    img.dataset.fallback = "1";
    img.src = `./photos/${id}.svg`;
  });
}

const PHOTO_MAX = 1400;

async function decodePhoto(source) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(source, { imageOrientation: "from-image" });
    } catch {
      try {
        return await createImageBitmap(source);
      } catch {
        /* tarayıcı bitmap desteklemiyorsa Image ile dene */
      }
    }
  }

  const url = URL.createObjectURL(source);
  try {
    const image = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Fotoğraf okunamadı"));
      el.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function preparePhoto(file) {
  try {
    const image = await decodePhoto(file);
    const srcW = image.width;
    const srcH = image.height;
    const longest = Math.max(srcW, srcH) || 1;
    const scale = longest > PHOTO_MAX ? PHOTO_MAX / longest : 1;
    const width = Math.max(1, Math.round(srcW * scale));
    const height = Math.max(1, Math.round(srcH * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, width, height);
    if (typeof image.close === "function") image.close();
    const blob = await new Promise((resolve) => {
      canvas.toBlob((next) => resolve(next), "image/jpeg", 0.9);
    });
    return blob || file;
  } catch {
    return file;
  }
}

async function applyPhoto(img, id) {
  const blob = await idbGet(id).catch(() => null);
  if (objectUrls.has(id)) URL.revokeObjectURL(objectUrls.get(id));
  img.dataset.fallback = "";
  if (blob) {
    const ready =
      blob.type === "image/jpeg" && blob.size < 900000 ? blob : await preparePhoto(blob);
    if (ready !== blob) await idbSet(id, ready).catch(() => {});
    const url = URL.createObjectURL(ready);
    objectUrls.set(id, url);
    img.src = url;
    return;
  }
  img.src = `./photos/${id}.jpg`;
}

async function loadAllPhotos() {
  const imgs = document.querySelectorAll("[data-photo]");
  await Promise.all(
    [...imgs].map((img) => {
      bindFallback(img, img.dataset.photo);
      return applyPhoto(img, img.dataset.photo);
    })
  );
}

function getStoredOrDefault(key, fallback) {
  const stored = localStorage.getItem(key);
  if (stored !== null) return stored;
  return fallback;
}

function getGreetingText() {
  return getStoredOrDefault(GREETING_KEY, window.DEFAULT_CONTENT?.greeting || "Sana,");
}

function getLetterText() {
  return getStoredOrDefault(LETTER_KEY, window.DEFAULT_CONTENT?.letter || "");
}

function getStickerText() {
  return getStoredOrDefault(STICKER_KEY, window.DEFAULT_CONTENT?.sticker || "iyi ki varsın <3");
}

function renderLetter() {
  letterGreet.textContent = getGreetingText();
  letterBody.textContent = getLetterText();
  if (heartSticker) heartSticker.textContent = getStickerText();
}

function sealEnvelope() {
  clearTimeout(envelopeTimer);
  envelope.classList.remove("is-open");
  envelope.classList.add("is-closed");
}

function openEnvelope() {
  if (!envelope.classList.contains("is-closed")) return;
  envelope.classList.remove("is-closed");
  const settleDelay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 560;
  envelopeTimer = setTimeout(() => envelope.classList.add("is-open"), settleDelay);
}

function showHome() {
  viewHome.hidden = false;
  viewInbox.hidden = true;
  document.body.classList.remove("is-inbox");
  sealEnvelope();
}

function showInbox() {
  viewHome.hidden = true;
  viewInbox.hidden = false;
  document.body.classList.add("is-inbox");
  mailToast.hidden = true;
  sealEnvelope();
}

function renderRoute() {
  if (location.hash === "#/inbox") showInbox();
  else showHome();
}

function rectsOverlap(a, b, pad = 12) {
  return !(
    a.right + pad < b.left ||
    a.left - pad > b.right ||
    a.bottom + pad < b.top ||
    a.top - pad > b.bottom
  );
}

let lastTeleport = 0;

function teleportNo() {
  const now = Date.now();
  if (now - lastTeleport < 160) return;
  lastTeleport = now;
  const btn = btnNo;
  const pad = 12;
  const w = btn.offsetWidth;
  const h = btn.offsetHeight;
  const vw = window.visualViewport?.width || window.innerWidth;
  const vh = window.visualViewport?.height || window.innerHeight;
  const maxX = Math.max(pad, vw - w - pad);
  const maxY = Math.max(pad, vh - h - pad);
  const hero = document.querySelector(".hero").getBoundingClientRect();
  const yes = btnYes.getBoundingClientRect();
  const settings = document.getElementById("btn-settings")?.getBoundingClientRect();
  const toastBox = mailToast.hidden ? null : mailToast.getBoundingClientRect();

  let x = pad;
  let y = pad;
  for (let i = 0; i < 24; i += 1) {
    x = pad + Math.random() * (maxX - pad);
    y = pad + Math.random() * (maxY - pad);
    const next = { left: x, top: y, right: x + w, bottom: y + h };
    const hitsHero = rectsOverlap(next, hero, 8);
    const hitsYes = rectsOverlap(next, yes, 16);
    const hitsSettings = settings ? rectsOverlap(next, settings, 8) : false;
    const hitsToast = toastBox ? rectsOverlap(next, toastBox, 8) : false;
    if (!hitsHero && !hitsYes && !hitsSettings && !hitsToast) break;
    if (i > 12 && !hitsYes) break;
  }

  btn.classList.add("is-teleporting");
  btn.style.left = `${Math.round(x)}px`;
  btn.style.top = `${Math.round(y)}px`;
}

function onNoPointer(event) {
  event.preventDefault();
  event.stopPropagation();
  teleportNo();
}

btnNo.addEventListener("pointerenter", teleportNo);
btnNo.addEventListener("pointerdown", onNoPointer);
btnNo.addEventListener("click", onNoPointer);

btnYes.addEventListener("click", () => {
  mailToast.hidden = false;
});

mailToast.addEventListener("click", () => {
  location.hash = "#/inbox";
});

envelopeOpen.addEventListener("click", openEnvelope);

window.addEventListener("hashchange", renderRoute);
window.addEventListener("resize", () => {
  if (!btnNo.classList.contains("is-teleporting")) return;
  teleportNo();
});

function initSettings() {
  const dialog = document.getElementById("settings-dialog");
  const openBtn = document.getElementById("btn-settings");
  const grid = document.getElementById("settings-photos");
  const greetingInput = document.getElementById("greeting-input");
  const letterInput = document.getElementById("letter-input");
  const stickerInput = document.getElementById("sticker-input");
  const dimInput = document.getElementById("dim-input");
  const resetBtn = document.getElementById("btn-reset-settings");
  if (!dialog || !openBtn) return;

  const labels = {
    1: "Polaroid 1",
    2: "Polaroid 2",
    3: "Polaroid 3",
    4: "Polaroid 4",
    letter: "Mektup polaroidi",
  };

  PHOTO_IDS.forEach((id) => {
    const item = document.createElement("label");
    item.className = "settings-item";
    item.innerHTML = `
      <span>${labels[id]}</span>
      <img data-photo="${id}" alt="" />
      <input type="file" accept="image/*" data-upload="${id}" />
    `;
    grid.appendChild(item);
  });

  grid.querySelectorAll("[data-photo]").forEach((img) => bindFallback(img, img.dataset.photo));

  const fillNoteFields = () => {
    greetingInput.value = getGreetingText();
    letterInput.value = getLetterText();
    stickerInput.value = getStickerText();
    applyDim(getDim());
  };

  openBtn.addEventListener("click", async () => {
    fillNoteFields();
    await loadAllPhotos();
    dialog.showModal();
  });

  grid.addEventListener("change", async (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "file") return;
    const file = input.files?.[0];
    const id = input.dataset.upload;
    if (!file || !id) return;
    const photo = await preparePhoto(file);
    await idbSet(id, photo);
    await loadAllPhotos();
  });

  greetingInput.addEventListener("input", () => {
    localStorage.setItem(GREETING_KEY, greetingInput.value);
    renderLetter();
  });

  letterInput.addEventListener("input", () => {
    localStorage.setItem(LETTER_KEY, letterInput.value);
    renderLetter();
  });

  stickerInput.addEventListener("input", () => {
    localStorage.setItem(STICKER_KEY, stickerInput.value);
    renderLetter();
  });

  dimInput?.addEventListener("input", () => {
    setDim(dimInput.value);
  });

  resetBtn.addEventListener("click", async () => {
    localStorage.removeItem(GREETING_KEY);
    localStorage.removeItem(LETTER_KEY);
    localStorage.removeItem(STICKER_KEY);
    localStorage.removeItem(DIM_KEY);
    await idbClear();
    fillNoteFields();
    renderLetter();
    await loadAllPhotos();
  });
}

renderRoute();
renderLetter();
applyDim(getDim());
initSettings();
loadAllPhotos();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
