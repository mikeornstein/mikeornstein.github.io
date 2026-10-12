import { COMPARE_URL, PRESETS } from "./presets.js";
import {
  buildDesign,
  decodeShare,
  limitNumber,
  repeatScale,
  shareHref,
  formatPalette,
  formatThreadcount,
  moveToken,
  parsePalette,
  parseThreadcount,
  settSvg,
  warpShows,
  withCount,
} from "./tartan.js";

const paletteBox = document.querySelector("#palette");
const threadBox = document.querySelector("#threadcount");
const swatchList = document.querySelector("#swatches");
const stripeList = document.querySelector("#stripes");
const hintsList = document.querySelector("#hints");
const totals = document.querySelector("#totals");
const title = document.querySelector("#title");
const story = document.querySelector("#story");
const presetRow = document.querySelector("#presets");
const missingList = document.querySelector("#missing");
const canvas = document.querySelector("#cloth");
const sheet = document.querySelector("#sheet");
const handle = document.querySelector("#handle");
const zoom = document.querySelector("#zoom");
const zoomVal = document.querySelector("#zoom-val");
const textureButton = document.querySelector("#texture");
const themeButton = document.querySelector("#theme");
const shareButton = document.querySelector("#share");

const state = {
  paletteText: "",
  threadcountText: "",
  threadPx: 2,
  texture: true,
};

let paintQueued = false;

function currentDesign() {
  return buildDesign(state.paletteText, state.threadcountText);
}

function activePreset() {
  return PRESETS.find(
    (preset) =>
      preset.available &&
      preset.palette === state.paletteText &&
      preset.threadcount === state.threadcountText,
  );
}

function syncHash() {
  const palette = paletteBox.value;
  const threadcount = threadBox.value;
  const current = decodeShare(location.hash);
  if (current && current.palette === palette && current.threadcount === threadcount) return;
  history.replaceState(null, "", shareHref(location.href, palette, threadcount));
}

function placeHeader() {
  const block = Math.ceil(document.querySelector(".top").getBoundingClientRect().height);
  document.documentElement.style.setProperty("--header-block", `${block}px`);
}

function renderMeta() {
  const design = currentDesign();
  const preset = activePreset();
  title.textContent = preset ? preset.name : "Custom";
  title.title = title.textContent;
  placeHeader();
  canvas.setAttribute(
    "aria-label",
    design.total
      ? `${title.textContent}, ${design.total} threads in 2/2 twill`
      : "Empty cloth",
  );

  if (!design.total) {
    totals.textContent = "Nothing to weave yet.";
  } else if (design.thread.mode === "symmetric") {
    totals.textContent = `Full sett ${design.total} threads. Written count ${design.written}, pivots included once.`;
  } else if (design.thread.mode === "asymmetric" || design.thread.mode === "mixed") {
    totals.textContent = `Full sett ${design.total} threads. Repeats with no mirror.`;
  } else {
    totals.textContent = `Full sett ${design.total} threads.`;
  }

  hintsList.replaceChildren();
  for (const hint of design.hints) {
    const item = document.createElement("li");
    item.textContent = hint.message;
    hintsList.append(item);
  }

  story.replaceChildren();
  if (preset) {
    const name = document.createElement("p");
    name.className = "story-name";
    name.textContent = preset.name;
    const line = document.createElement("p");
    line.textContent = preset.story;
    story.append(name, line);
    if (preset.countNote) story.append(note(preset.countNote));
    if (preset.yarnNote) story.append(note(preset.yarnNote));
    if (preset.shadeNote) story.append(note(preset.shadeNote));
    const links = document.createElement("p");
    links.className = "story-links";
    links.append(anchor(preset.sourceUrl, preset.sourceLabel));
    links.append(anchor(preset.registerUrl, "Register record"));
    story.append(links);
  }

  for (const button of presetRow.querySelectorAll("button")) {
    const on = preset && button.dataset.id === preset.id;
    button.classList.toggle("is-active", Boolean(on));
    button.setAttribute("aria-pressed", on ? "true" : "false");
  }
}

function note(text) {
  const p = document.createElement("p");
  p.className = "story-note";
  p.textContent = text;
  return p;
}

function anchor(href, label) {
  const a = document.createElement("a");
  a.href = href;
  a.textContent = label;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}

function renderSwatches() {
  const { entries } = parsePalette(state.paletteText);
  swatchList.replaceChildren();
  entries.forEach((entry, index) => {
    const row = document.createElement("label");
    row.className = "swatch-row";
    const chip = document.createElement("span");
    chip.className = "chip";
    const hex = entry.hex || "B9B2A9";
    chip.style.background = `#${hex}`;
    const input = document.createElement("input");
    input.type = "color";
    input.className = "chip-input";
    input.value = `#${hex.toLowerCase()}`;
    input.setAttribute("aria-label", `Colour for ${entry.code}`);
    input.addEventListener("input", () => {
      const parsed = parsePalette(state.paletteText);
      const explicitHex = input.value.slice(1).toUpperCase();
      const next = parsed.entries.map((item, i) =>
        i === index ? { ...item, explicitHex } : item,
      );
      state.paletteText = formatPalette(next);
      paletteBox.value = state.paletteText;
      chip.style.background = input.value;
      const name = row.querySelector(".swatch-meta");
      if (name) name.textContent = `#${explicitHex}`;
      renderMeta();
      schedulePaint();
      syncHash();
    });
    const text = document.createElement("span");
    text.className = "swatch-copy";
    const code = document.createElement("span");
    code.className = "code";
    code.textContent = entry.code;
    const label = document.createElement("span");
    label.textContent = entry.name || "Unnamed";
    const meta = document.createElement("span");
    meta.className = "swatch-meta";
    meta.textContent = entry.explicitHex ? `#${entry.explicitHex}` : `#${hex} default`;
    text.append(code, label, meta);
    row.append(chip, input, text);
    swatchList.append(row);
  });
}

function renderStripes() {
  const parsed = parseThreadcount(state.threadcountText);
  const design = currentDesign();
  const byCode = new Map(design.runs.map((run) => [run.code, run.hex]));
  stripeList.replaceChildren();
  parsed.tokens.forEach((token, index) => {
    const row = document.createElement("li");
    row.className = "stripe";
    row.dataset.index = String(index);

    const grip = document.createElement("button");
    grip.type = "button";
    grip.className = "grip";
    grip.setAttribute("aria-label", `Reorder ${token.code}`);
    grip.innerHTML =
      '<span></span><span></span><span></span>';
    grip.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      const to = event.key === "ArrowUp" ? index - 1 : index + 1;
      if (to < 0 || to >= parsed.tokens.length) return;
      commitThread(moveToken(parseThreadcount(state.threadcountText), index, to));
      const next = stripeList.querySelectorAll(".grip")[to];
      next?.focus();
    });
    grip.addEventListener("pointerdown", (event) => startDrag(event, grip, row, index));

    const chip = document.createElement("span");
    chip.className = "chip";
    chip.style.background = `#${byCode.get(token.code) || "B9B2A9"}`;
    chip.title = token.code;

    const code = document.createElement("span");
    code.className = "code";
    code.textContent = token.pivot ? `${token.code}/` : token.code;

    const minus = stepper("Decrease count", () => stepCount(index, -1));
    minus.textContent = "−";
    const field = document.createElement("input");
    field.type = "number";
    field.min = "1";
    field.max = "9999";
    field.inputMode = "numeric";
    field.value = String(token.count);
    field.setAttribute("aria-label", `${token.code} thread count`);
    field.addEventListener("input", () => {
      const value = Number(field.value);
      if (!Number.isInteger(value) || value < 1) return;
      setCount(index, value, false);
    });
    const plus = stepper("Increase count", () => stepCount(index, 1));
    plus.textContent = "+";

    row.append(grip, chip, code, minus, field, plus);
    stripeList.append(row);
  });
}

function stepper(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "step";
  button.setAttribute("aria-label", label);
  button.addEventListener("click", onClick);
  return button;
}

function stepCount(index, delta) {
  const current = parseThreadcount(state.threadcountText).tokens[index]?.count ?? 1;
  setCount(index, current + delta, false);
}

function setCount(index, count, rebuild = true) {
  const next = Math.max(1, Math.min(9999, count));
  const parsed = withCount(parseThreadcount(state.threadcountText), index, next);
  state.threadcountText = formatThreadcount(parsed);
  threadBox.value = state.threadcountText;
  if (rebuild) renderStripes();
  else {
    const field = stripeList.querySelectorAll("input[type='number']")[index];
    if (field && document.activeElement !== field) field.value = String(next);
  }
  renderMeta();
  schedulePaint();
  syncHash();
}

function commitThread(parsed) {
  state.threadcountText = formatThreadcount(parsed);
  threadBox.value = state.threadcountText;
  renderStripes();
  renderMeta();
  schedulePaint();
  syncHash();
}

function startDrag(event, grip, row, from) {
  event.preventDefault();
  grip.setPointerCapture(event.pointerId);
  row.classList.add("is-dragging");
  let current = from;

  function place(clientY) {
    const rows = [...stripeList.querySelectorAll(".stripe")];
    let target = 0;
    for (const other of rows) {
      if (other === row) continue;
      const box = other.getBoundingClientRect();
      if (clientY > box.top + box.height / 2) target += 1;
    }
    const clamped = Math.max(0, Math.min(rows.length - 1, target));
    if (clamped === current) return;
    const sibling = stripeList.querySelectorAll(".stripe")[clamped];
    if (clamped > current) sibling.after(row);
    else sibling.before(row);
    current = clamped;
  }

  function onMove(ev) {
    place(ev.clientY);
  }
  function finish() {
    grip.removeEventListener("pointermove", onMove);
    grip.removeEventListener("pointerup", finish);
    grip.removeEventListener("pointercancel", finish);
    row.classList.remove("is-dragging");
    if (current !== from) {
      commitThread(moveToken(parseThreadcount(state.threadcountText), from, current));
    }
  }
  grip.addEventListener("pointermove", onMove);
  grip.addEventListener("pointerup", finish);
  grip.addEventListener("pointercancel", finish);
}

function schedulePaint() {
  if (paintQueued) return;
  paintQueued = true;
  requestAnimationFrame(() => {
    paintQueued = false;
    paint();
  });
}

function paint() {
  const design = currentDesign();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = Math.max(1, Math.floor(height * dpr));
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  paintCloth(ctx, width, height, design.flat.map((thread) => thread.hex), state.threadPx, state.texture);
}

function paintCloth(ctx, width, height, colours, threadPx, texture) {
  ctx.fillStyle = "#cfc8bf";
  ctx.fillRect(0, 0, width, height);
  const count = colours.length;
  if (!count) return;
  const cols = Math.ceil(width / threadPx);
  const rows = Math.ceil(height / threadPx);
  for (let ty = 0; ty < rows; ty += 1) {
    const y = ty * threadPx;
    const band = Math.min(threadPx, height - y);
    ctx.fillStyle = `#${colours[ty % count]}`;
    ctx.fillRect(0, y, width, band);
    let tx = 0;
    while (tx < cols) {
      if (!warpShows(tx, ty)) {
        tx += 1;
        continue;
      }
      const hex = colours[tx % count];
      let end = tx + 1;
      while (end < cols && warpShows(end, ty) && colours[end % count] === hex) end += 1;
      const x = tx * threadPx;
      ctx.fillStyle = `#${hex}`;
      ctx.fillRect(x, y, Math.min((end - tx) * threadPx, width - x), band);
      tx = end;
    }
    if (texture && threadPx >= 2) {
      ctx.fillStyle = "rgba(0,0,0,0.07)";
      ctx.fillRect(0, y + band - 1, width, 1);
    }
  }
  if (texture && threadPx >= 2) {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    for (let tx = 0; tx < cols; tx += 1) ctx.fillRect(tx * threadPx, 0, 1, height);
  }
}

function applyTexts(palette, threadcount) {
  state.paletteText = palette;
  state.threadcountText = threadcount;
  paletteBox.value = palette;
  threadBox.value = threadcount;
  renderSwatches();
  renderStripes();
  renderMeta();
  schedulePaint();
  syncHash();
}

function loadPreset(preset) {
  if (!preset.available) return;
  applyTexts(preset.palette, preset.threadcount);
}

function renderPresets() {
  for (const preset of PRESETS) {
    if (!preset.available) {
      const item = document.createElement("li");
      const name = document.createElement("span");
      name.className = "missing-name";
      name.textContent = preset.name;
      const line = document.createElement("span");
      line.className = "missing-story";
      line.textContent = preset.story;
      item.append(name, line);
      if (preset.registerUrl) item.append(anchor(preset.registerUrl, "Register"));
      missingList.append(item);
      continue;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset";
    button.dataset.id = preset.id;
    button.textContent = preset.name;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => loadPreset(preset));
    presetRow.append(button);
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function fileStem() {
  return (activePreset()?.id || "tartan").replace(/[^a-z0-9-]+/gi, "-");
}

function exportCanvas(width, height, threadPx) {
  const design = currentDesign();
  const colours = design.flat.map((thread) => thread.hex);
  const out = document.createElement("canvas");
  out.width = Math.max(1, width);
  out.height = Math.max(1, height);
  const ctx = out.getContext("2d", { alpha: false });
  paintCloth(ctx, out.width, out.height, colours, threadPx, false);
  return out;
}

function bindLimit(input, note, min, max, label) {
  const apply = () => {
    const result = limitNumber(input.value, min, max, label);
    note.textContent = result.note;
    if (result.value != null && result.note) input.value = String(result.value);
    return result;
  };
  input.addEventListener("input", apply);
  input.addEventListener("blur", apply);
}

function exportRepeat() {
  const design = currentDesign();
  const input = document.querySelector("#png-scale");
  const note = document.querySelector("#png-scale-note");
  const result = repeatScale(input.value, design.total);
  note.textContent = result.note;
  if (result.value == null || !design.total) return;
  input.value = String(result.value);
  const size = design.total * result.value;
  exportCanvas(size, size, result.value).toBlob((blob) => {
    if (blob) downloadBlob(blob, `${fileStem()}-repeat.png`);
  }, "image/png");
}

function exportTile() {
  const design = currentDesign();
  if (!design.total) return;
  const width = commitLimit("#tile-w", "#tile-w-note", 16, 4096, "Tile width");
  const height = commitLimit("#tile-h", "#tile-h-note", 16, 4096, "Tile height");
  const scale = limitNumber(document.querySelector("#png-scale").value, 1, 8, "Repeat size");
  document.querySelector("#png-scale-note").textContent = scale.note;
  if (width == null || height == null || scale.value == null) return;
  const threadPx = scale.value;
  exportCanvas(width, height, threadPx).toBlob((blob) => {
    if (blob) downloadBlob(blob, `${fileStem()}-tile.png`);
  }, "image/png");
}

function commitLimit(selector, noteSelector, min, max, label) {
  const input = document.querySelector(selector);
  const note = document.querySelector(noteSelector);
  const result = limitNumber(input.value, min, max, label);
  note.textContent = result.note;
  if (result.value == null) return null;
  input.value = String(result.value);
  return result.value;
}

function exportSvg() {
  const design = currentDesign();
  if (!design.total) return;
  const svg = settSvg(design, title.textContent);
  downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${fileStem()}.svg`);
}

async function copyText(text, button) {
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  button.textContent = "Copied";
  setTimeout(() => {
    button.textContent = original;
  }, 1200);
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("tartan-theme", theme);
  } catch {
    /* private mode */
  }
  themeButton.textContent = theme === "dark" ? "Light" : "Dark";
  themeButton.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
}

function setSheet(open) {
  sheet.classList.toggle("is-open", open);
  handle.setAttribute("aria-expanded", open ? "true" : "false");
}

function wireSheet() {
  let startY = 0;
  let usedPointer = false;
  handle.addEventListener("pointerdown", (event) => {
    startY = event.clientY;
    usedPointer = false;
  });
  handle.addEventListener("pointerup", (event) => {
    usedPointer = true;
    const delta = startY - event.clientY;
    if (delta > 28) setSheet(true);
    else if (delta < -28) setSheet(false);
    else setSheet(!sheet.classList.contains("is-open"));
  });
  handle.addEventListener("click", (event) => {
    if (usedPointer) {
      usedPointer = false;
      event.preventDefault();
      return;
    }
    setSheet(!sheet.classList.contains("is-open"));
  });
}

function wire() {
  paletteBox.addEventListener("input", () => {
    state.paletteText = paletteBox.value;
    renderSwatches();
    renderMeta();
    schedulePaint();
    syncHash();
  });
  threadBox.addEventListener("input", () => {
    state.threadcountText = threadBox.value;
    renderStripes();
    renderMeta();
    schedulePaint();
    syncHash();
  });
  zoom.addEventListener("input", () => {
    state.threadPx = Number(zoom.value);
    zoomVal.textContent = zoom.value;
    schedulePaint();
  });
  textureButton.addEventListener("click", () => {
    state.texture = !state.texture;
    textureButton.setAttribute("aria-pressed", state.texture ? "true" : "false");
    schedulePaint();
  });
  themeButton.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next);
  });
  shareButton.addEventListener("click", () => {
    state.paletteText = paletteBox.value;
    state.threadcountText = threadBox.value;
    const href = shareHref(location.href, state.paletteText, state.threadcountText);
    history.replaceState(null, "", href);
    copyText(href, shareButton);
  });
  bindLimit(document.querySelector("#png-scale"), document.querySelector("#png-scale-note"), 1, 8, "Repeat size");
  bindLimit(document.querySelector("#tile-w"), document.querySelector("#tile-w-note"), 16, 4096, "Tile width");
  bindLimit(document.querySelector("#tile-h"), document.querySelector("#tile-h-note"), 16, 4096, "Tile height");
  document.querySelector("#copy-palette").addEventListener("click", (event) => {
    copyText(state.paletteText, event.currentTarget);
  });
  document.querySelector("#copy-count").addEventListener("click", (event) => {
    copyText(state.threadcountText, event.currentTarget);
  });
  document.querySelector("#png-repeat").addEventListener("click", exportRepeat);
  document.querySelector("#png-tile").addEventListener("click", exportTile);
  document.querySelector("#svg").addEventListener("click", exportSvg);
  document.querySelector("#compare").href = COMPARE_URL;
  window.addEventListener("resize", () => {
    placeHeader();
    schedulePaint();
  });
  window.addEventListener("hashchange", () => {
    const shared = decodeShare(location.hash);
    if (!shared) return;
    if (shared.palette === state.paletteText && shared.threadcount === state.threadcountText) return;
    applyTexts(shared.palette, shared.threadcount);
  });
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(() => schedulePaint());
    observer.observe(canvas);
  }
  wireSheet();
}

function boot() {
  renderPresets();
  wire();
  setTheme(document.documentElement.dataset.theme || "light");
  const shared = decodeShare(location.hash);
  if (shared && (shared.palette || shared.threadcount)) {
    applyTexts(shared.palette, shared.threadcount);
  } else {
    loadPreset(PRESETS[0]);
  }
  if (window.matchMedia("(min-width: 960px)").matches) setSheet(true);
  placeHeader();
}

boot();
