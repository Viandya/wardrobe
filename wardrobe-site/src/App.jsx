import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase } from "./supabase";
import { api } from "./api";

/* ─────────────────────────  ПАЛИТРА И ТОКЕНЫ  ───────────────────────── */
const C = {
  paper: "#EDE7DB",
  paper2: "#E3DCCC",
  card: "#F6F2E9",
  ink: "#241F1A",
  ink60: "#6B6157",
  line: "#CFC5B2",
  olive: "#6E7350",
  chestnut: "#5A4436",
  rust: "#8C4A32",
};

const S = {
  label: {
    fontSize: 10,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: C.ink60,
    fontWeight: 600,
  },
  serif: { fontFamily: "Georgia, 'Times New Roman', serif" },
};

/* ─────────────────────────  СПРАВОЧНИКИ  ───────────────────────── */
const CATS = [
  { id: "outerwear", ru: "Верхняя одежда", slot: 0, form: 3 },
  { id: "top", ru: "Верх", slot: 1, form: 2 },
  { id: "bottom", ru: "Низ", slot: 2, form: 2 },
  { id: "dress", ru: "Платье / комплект", slot: 3, form: 3 },
  { id: "shoes", ru: "Обувь", slot: 4, form: 2 },
  { id: "bag", ru: "Сумка", slot: 5, form: 2 },
  { id: "accessory", ru: "Аксессуар", slot: 6, form: 2 },
  { id: "jewelry", ru: "Украшение", slot: 7, form: 3 },
];
const catRu = (id) => CATS.find((c) => c.id === id)?.ru || id;

const SEASONS = [
  { id: "winter", ru: "Зима" },
  { id: "demi", ru: "Демисезон" },
  { id: "summer", ru: "Лето" },
];
const OCCASIONS = [
  { id: "daily", ru: "Каждый день" },
  { id: "study", ru: "Учёба" },
  { id: "work", ru: "Работа", form: 4 },
  { id: "walk", ru: "Прогулка", form: 1 },
  { id: "evening", ru: "Выход", form: 5 },
];

/* Минимумы для отчёта о дырах в гардеробе */
const MINIMUMS = { top: 5, bottom: 3, shoes: 2, outerwear: 1, bag: 1 };

/* ─────────────────────────  ЦВЕТ  ───────────────────────── */
function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}
/* Название цвета в духе плашек Pantone */
function colorName(hex) {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  if (l > 88) return "Молоко";
  if (l < 12) return "Уголь";
  if (s < 10) return l > 60 ? "Тёплый серый" : l > 35 ? "Пепел" : "Графит";
  if (s < 24 && h >= 20 && h <= 55) return l > 70 ? "Овсяный" : l > 45 ? "Лён" : "Кофейное зерно";
  if (h < 15 || h >= 345) return l < 35 ? "Бордо" : "Кирпич";
  if (h < 40) return l < 30 ? "Шоколад" : l < 55 ? "Коньяк" : "Песок";
  if (h < 62) return l < 45 ? "Хаки" : "Охра";
  if (h < 95) return l < 45 ? "Оливковое масло" : "Шалфей";
  if (h < 160) return "Зелёный лес";
  if (h < 200) return "Морская волна";
  if (h < 250) return l < 40 ? "Чернильный" : "Деним";
  if (h < 290) return "Слива";
  return "Пыльная роза";
}
/* Семейство цвета — для проверки сочетаемости */
function family(hex) {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  if (l > 86) return "light";
  if (l < 14) return "dark";
  if (s < 16) return "neutral";
  if (s < 30 && h >= 15 && h <= 60) return "neutral";
  if (h < 20 || h >= 345) return "red";
  if (h < 45) return "brown";
  if (h < 70) return "gold";
  if (h < 160) return "green";
  if (h < 250) return "blue";
  return "purple";
}
const isNeutralFam = (f) => ["light", "dark", "neutral", "brown"].includes(f);

/* Тёплые/холодные — чтобы не мешать холодный серый с тёплым бежем */
function temp(hex) {
  const [h, s] = rgbToHsl(...hexToRgb(hex));
  if (s < 12) return "n";
  return (h < 75 || h > 330) ? "w" : "c";
}

/* ─────────────────────────  ОБРАБОТКА ФОТО  ───────────────────────── */
async function processFile(file, tol = 30, maxSize = 460) {
  const url = URL.createObjectURL(file);
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i); i.onerror = rej; i.src = url;
  });
  const sc = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(url);
  const data = ctx.getImageData(0, 0, w, h);
  if (tol > 0) cutBackground(data, w, h, tol);
  ctx.putImageData(data, 0, 0);
  const cropped = tol > 0 ? trim(cv) : cv;
  const blob = await new Promise((r) => cropped.toBlob(r, "image/webp", 0.82));
  return { blob, dataUrl: cropped.toDataURL("image/webp", 0.82), colors: pickColors(cropped) };
}

/* Заливка от краёв. Цвет фона берём с рамки кадра, а не считаем белым,
   и шагаем только между соседями похожего цвета — тогда край вещи
   останавливает заливку и белая рубашка на светлой стене уцелеет. */
function cutBackground(imgData, w, h, tol = 30) {
  const d = imgData.data;
  const px = [];
  const grab = (i) => px.push([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
  for (let x = 0; x < w; x += 2) { grab(x); grab((h - 1) * w + x); }
  for (let y = 0; y < h; y += 2) { grab(y * w); grab(y * w + w - 1); }
  const med = (k) => { const a = px.map((p) => p[k]).sort((m, n) => m - n); return a[a.length >> 1]; };
  const bg = [med(0), med(1), med(2)];

  const toBg = (i) => Math.abs(d[i * 4] - bg[0]) + Math.abs(d[i * 4 + 1] - bg[1]) + Math.abs(d[i * 4 + 2] - bg[2]);
  const between = (i, j) =>
    Math.abs(d[i * 4] - d[j * 4]) + Math.abs(d[i * 4 + 1] - d[j * 4 + 1]) + Math.abs(d[i * 4 + 2] - d[j * 4 + 2]);

  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  const seed = (i) => { if (!seen[i] && toBg(i) < tol * 3) { seen[i] = 1; queue[tail++] = i; } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }

  while (head < tail) {
    const i = queue[head++];
    d[i * 4 + 3] = 0;
    const x = i % w, y = (i / w) | 0;
    const step = (j) => {
      if (!seen[j] && between(i, j) < tol && toBg(j) < tol * 4) { seen[j] = 1; queue[tail++] = j; }
    };
    if (x > 0) step(i - 1);
    if (x < w - 1) step(i + 1);
    if (y > 0) step(i - w);
    if (y < h - 1) step(i + w);
  }

  /* мягкий край */
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] === 0) continue;
      let n = 0;
      if (d[i - 4 + 3] === 0) n++;
      if (d[i + 4 + 3] === 0) n++;
      if (d[i - w * 4 + 3] === 0) n++;
      if (d[i + w * 4 + 3] === 0) n++;
      if (n >= 2) d[i + 3] = 120;
    }
  }
}

function trim(cv) {
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const { data } = ctx.getImageData(0, 0, cv.width, cv.height);
  let x0 = cv.width, y0 = cv.height, x1 = 0, y1 = 0, found = false;
  for (let y = 0; y < cv.height; y++)
    for (let x = 0; x < cv.width; x++)
      if (data[(y * cv.width + x) * 4 + 3] > 24) {
        found = true;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
  if (!found) return cv;
  const p = 4;
  x0 = Math.max(0, x0 - p); y0 = Math.max(0, y0 - p);
  x1 = Math.min(cv.width - 1, x1 + p); y1 = Math.min(cv.height - 1, y1 + p);
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext("2d").drawImage(cv, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

function pickColors(cv) {
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const { data } = ctx.getImageData(0, 0, cv.width, cv.height);
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 16) {
    if (data[i + 3] < 200) continue;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const b = buckets.get(key) || [0, 0, 0, 0];
    b[0] += data[i]; b[1] += data[i + 1]; b[2] += data[i + 2]; b[3]++;
    buckets.set(key, b);
  }
  const sorted = [...buckets.values()].sort((a, b) => b[3] - a[3]);
  const out = [];
  for (const b of sorted) {
    const hex = rgbToHex(b[0] / b[3], b[1] / b[3], b[2] / b[3]);
    if (out.every((o) => dist(o, hex) > 60)) out.push(hex);
    if (out.length === 3) break;
  }
  return out.length ? out : ["#8a8078"];
}
function dist(a, b) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

/* ─────────────────────────  РАСКЛАДКА КОЛЛАЖА  ───────────────────────── */
const TEMPLATES = {
  classic: {
    ru: "Классическая",
    slots: {
      outerwear: { x: 3, y: 5, w: 33 },
      dress: { x: 30, y: 14, w: 40 },
      top: { x: 36, y: 8, w: 40 },
      bottom: { x: 9, y: 44, w: 33 },
      shoes: { x: 44, y: 72, w: 26 },
      bag: { x: 62, y: 46, w: 32 },
      accessory: [{ x: 72, y: 2, w: 22 }, { x: 4, y: 78, w: 18 }],
      jewelry: [{ x: 76, y: 22, w: 17 }, { x: 26, y: 88, w: 14 }],
    },
  },
  column: {
    ru: "Столбцом",
    slots: {
      outerwear: { x: 4, y: 3, w: 36 },
      dress: { x: 26, y: 20, w: 44 },
      top: { x: 30, y: 4, w: 44 },
      bottom: { x: 24, y: 38, w: 44 },
      shoes: { x: 20, y: 76, w: 30 },
      bag: { x: 58, y: 62, w: 34 },
      accessory: [{ x: 70, y: 6, w: 24 }, { x: 4, y: 60, w: 18 }],
      jewelry: [{ x: 72, y: 30, w: 18 }, { x: 6, y: 44, w: 14 }],
    },
  },
  scatter: {
    ru: "Свободная",
    slots: {
      outerwear: { x: 46, y: 34, w: 34 },
      dress: { x: 20, y: 26, w: 42 },
      top: { x: 6, y: 6, w: 42 },
      bottom: { x: 40, y: 52, w: 36 },
      shoes: { x: 6, y: 70, w: 30 },
      bag: { x: 4, y: 40, w: 28 },
      accessory: [{ x: 58, y: 4, w: 24 }, { x: 74, y: 76, w: 20 }],
      jewelry: [{ x: 54, y: 18, w: 16 }, { x: 30, y: 86, w: 14 }],
    },
  },
};

function layout(items, tpl = "classic") {
  const slots = TEMPLATES[tpl].slots;
  const used = {};
  return items.map((it, idx) => {
    const raw = slots[it.category] || slots.accessory;
    let pos;
    if (Array.isArray(raw)) {
      const n = used[it.category] || 0;
      used[it.category] = n + 1;
      pos = raw[n % raw.length];
    } else pos = raw;
    return {
      itemId: it.id,
      x: pos.x + (Math.random() * 4 - 2),
      y: pos.y + (Math.random() * 4 - 2),
      w: pos.w,
      rot: (Math.random() * 6 - 3),
      z: idx,
    };
  });
}

/* ─────────────────────────  ГЕНЕРАТОР  ───────────────────────── */
function scoreLook(items) {
  const fams = new Set();
  const temps = new Set();
  let forms = [];
  items.forEach((it) => {
    it.colors.slice(0, 2).forEach((c) => fams.add(family(c)));
    temps.add(temp(it.colors[0]));
    forms.push(it.formality);
  });
  let s = 100;
  const accents = [...fams].filter((f) => !isNeutralFam(f));
  if (accents.length > 2) s -= (accents.length - 2) * 22;
  if (fams.size > 4) s -= (fams.size - 4) * 10;
  if (accents.length === 1) s += 12;
  temps.delete("n");
  if (temps.size > 1) s -= 14;
  const spread = Math.max(...forms) - Math.min(...forms);
  if (spread > 2) s -= (spread - 2) * 18;
  const wearSum = items.reduce((a, b) => a + (b.wear || 0), 0) / items.length;
  s -= wearSum * 1.5;
  if (items.some((i) => i.fav)) s += 6;
  const sets = items.filter((i) => i.set).map((i) => i.set);
  if (sets.length > 1 && new Set(sets).size < sets.length) s += 18;
  return s;
}

function buildLook(pool, opts) {
  const { season, occasion, pinned, tpl } = opts;
  const ok = (it) =>
    !it.isWish &&
    (season === "any" || !it.seasons?.length || it.seasons.includes(season));
  const by = (c) => pool.filter((i) => i.category === c && ok(i));
  const pick = (arr) => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : null);
  const occ = OCCASIONS.find((o) => o.id === occasion);

  let best = null;
  for (let n = 0; n < 90; n++) {
    const chosen = [];
    const pinnedItem = pinned ? pool.find((i) => i.id === pinned) : null;
    if (pinnedItem) chosen.push(pinnedItem);
    const has = (c) => chosen.some((i) => i.category === c);

    const useDress = !has("top") && !has("bottom") && by("dress").length && Math.random() < 0.3;
    if (useDress && !has("dress")) chosen.push(pick(by("dress")));
    if (!has("dress")) {
      if (!has("top")) { const t = pick(by("top")); if (t) chosen.push(t); }
      if (!has("bottom")) { const b = pick(by("bottom")); if (b) chosen.push(b); }
    }
    if (!has("shoes")) { const sh = pick(by("shoes")); if (sh) chosen.push(sh); }
    if (season === "winter" && !has("outerwear")) { const o = pick(by("outerwear")); if (o) chosen.push(o); }
    else if (season === "demi" && !has("outerwear") && Math.random() < 0.6) { const o = pick(by("outerwear")); if (o) chosen.push(o); }
    if (!has("bag") && Math.random() < 0.85) { const g = pick(by("bag")); if (g) chosen.push(g); }
    const extras = [...by("accessory"), ...by("jewelry")].sort(() => Math.random() - 0.5);
    extras.slice(0, Math.random() < 0.5 ? 1 : 2).forEach((e) => { if (!chosen.includes(e)) chosen.push(e); });

    const clean = chosen.filter(Boolean);
    if (clean.length < 3) continue;
    let sc = scoreLook(clean);
    if (occ?.form) {
      const avg = clean.reduce((a, b) => a + b.formality, 0) / clean.length;
      sc -= Math.abs(avg - occ.form) * 10;
    }
    if (!best || sc > best.score) best = { score: sc, items: clean };
  }
  if (!best) return null;
  const ordered = [...best.items].sort(
    (a, b) => (CATS.find((c) => c.id === a.category)?.slot ?? 9) - (CATS.find((c) => c.id === b.category)?.slot ?? 9)
  );
  return {
    id: "look_" + Date.now() + "_" + Math.floor(Math.random() * 1e4),
    name: "",
    season, occasion, tpl,
    placed: layout(ordered, tpl),
    score: Math.round(best.score),
    createdAt: Date.now(),
    wornDates: [],
  };
}

/* Две плашки-палитры для образа */
function lookPalette(items) {
  const all = items.flatMap((i) => i.colors.slice(0, 2));
  const counted = [];
  all.forEach((c) => {
    const near = counted.find((x) => dist(x.hex, c) < 55);
    if (near) near.n++; else counted.push({ hex: c, n: 1 });
  });
  return counted.sort((a, b) => b.n - a.n).slice(0, 2).map((c) => c.hex);
}

/* ─────────────────────────  ЭКСПОРТ PNG 1080×1920  ───────────────────────── */
async function exportPng(look, itemsById, name) {
  const W = 1080, H = 1920;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);

  const items = look.placed.map((p) => itemsById[p.itemId]).filter(Boolean);
  const pal = lookPalette(items);
  /* верхняя плашка палитры */
  pal.forEach((hex, i) => {
    const x = 64 + i * 150;
    ctx.fillStyle = hex; ctx.fillRect(x, 60, 120, 90);
    ctx.fillStyle = "#fff"; ctx.fillRect(x, 150, 120, 54);
    ctx.fillStyle = C.ink; ctx.font = "bold 17px Georgia";
    ctx.fillText(colorName(hex), x + 10, 182);
  });
  ctx.fillStyle = C.ink;
  ctx.font = "italic 46px Georgia";
  ctx.fillText(name || "Капсула", 64, 268);

  const top = 300, area = H - top - 70;
  const loaded = await Promise.all(
    look.placed.map(
      (p) =>
        new Promise((res) => {
          const it = itemsById[p.itemId];
          if (!it) return res(null);
          const im = new Image();
          im.crossOrigin = "anonymous";
          im.onload = () => res({ im, p });
          im.onerror = () => res(null);
          im.src = it.img;
        })
    )
  );
  loaded.filter(Boolean)
    .sort((a, b) => a.p.z - b.p.z)
    .forEach(({ im, p }) => {
      const w = (p.w / 100) * W;
      const h = w * (im.height / im.width);
      const x = (p.x / 100) * W, y = top + (p.y / 100) * area;
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(((p.rot || 0) * Math.PI) / 180);
      ctx.drawImage(im, -w / 2, -h / 2, w, h);
      ctx.restore();
    });

  const a = document.createElement("a");
  a.download = (name || "капсула") + ".png";
  a.href = cv.toDataURL("image/png");
  a.click();
}

/* ─────────────────────────  UI-ПРИМИТИВЫ  ───────────────────────── */
const Btn = ({ children, onClick, variant = "solid", size = "md", style, disabled }) => {
  const base = {
    borderRadius: 2, cursor: disabled ? "not-allowed" : "pointer",
    letterSpacing: "0.08em", textTransform: "uppercase",
    fontSize: size === "sm" ? 10 : 11, fontWeight: 600,
    padding: size === "sm" ? "6px 10px" : "10px 16px",
    border: `1px solid ${C.ink}`, transition: "all .15s",
    opacity: disabled ? 0.4 : 1,
  };
  const v = variant === "solid"
    ? { background: C.ink, color: C.paper }
    : variant === "ghost"
      ? { background: "transparent", color: C.ink, borderColor: C.line }
      : { background: C.olive, color: "#fff", borderColor: C.olive };
  return <button disabled={disabled} onClick={onClick} style={{ ...base, ...v, ...style }}>{children}</button>;
};

const Chip = ({ active, children, onClick }) => (
  <button onClick={onClick} style={{
    ...S.label, padding: "6px 11px", borderRadius: 999, cursor: "pointer",
    border: `1px solid ${active ? C.ink : C.line}`,
    background: active ? C.ink : "transparent",
    color: active ? C.paper : C.ink60, whiteSpace: "nowrap",
  }}>{children}</button>
);

const Section = ({ eyebrow, title, children, right }) => (
  <div style={{ marginBottom: 26 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 14 }}>
      <div>
        {eyebrow && <div style={S.label}>{eyebrow}</div>}
        <h2 style={{ ...S.serif, fontSize: 24, margin: "4px 0 0", color: C.ink, fontWeight: 400 }}>{title}</h2>
      </div>
      {right}
    </div>
    {children}
  </div>
);

/* ─────────────────────────  ВХОД  ───────────────────────── */
function Auth() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  /* адрес возврата: на GitHub Pages сайт лежит в подпапке */
  const backTo = window.location.origin + import.meta.env.BASE_URL;

  const withPassword = async () => {
    if (!email.includes("@") || pass.length < 6) return setErr("Проверь почту и пароль");
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    setBusy(false);
    if (error) {
      setErr(error.message === "Invalid login credentials"
        ? "Почта или пароль не подходят"
        : error.message);
    }
  };

  const withLink = async () => {
    if (!email.includes("@")) return setErr("Проверь адрес почты");
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithOtp({
      email, options: { emailRedirectTo: backTo },
    });
    setBusy(false);
    if (error) {
      setErr(error.message.includes("rate limit")
        ? "Слишком много писем за час — войди по паролю или подожди"
        : error.message);
    } else setSent(true);
  };

  const field = {
    width: "100%", border: `1px solid ${C.line}`, background: "transparent",
    padding: "12px", fontSize: 15, borderRadius: 2, color: C.ink, marginBottom: 10,
  };

  return (
    <div style={{ minHeight: "100vh", background: C.paper, color: C.ink, display: "grid", placeItems: "center", padding: 20, fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ ...S.serif, fontSize: 30, marginBottom: 6 }}>Гардероб<span style={{ color: C.olive }}>.</span></div>
        <div style={{ fontSize: 13, color: C.ink60, lineHeight: 1.6, marginBottom: 22 }}>
          Войди по паролю или запроси ссылку на почту. Гардероб будет одинаковым на телефоне и на ноутбуке.
        </div>

        {sent ? (
          <div style={{ border: `1px solid ${C.olive}`, background: C.card, padding: 16, fontSize: 13, lineHeight: 1.6 }}>
            Письмо ушло на <b>{email}</b>. Открой ссылку из него на том устройстве, где хочешь войти.
            Если письма нет — проверь папку «Спам».
            <div style={{ marginTop: 12 }}>
              <Btn size="sm" variant="ghost" onClick={() => setSent(false)}>Назад</Btn>
            </div>
          </div>
        ) : (
          <>
            <input value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="почта" type="email" autoComplete="email" style={field} />
            <input value={pass} onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && withPassword()}
              placeholder="пароль" type="password" autoComplete="current-password" style={field} />
            <Btn onClick={withPassword} disabled={busy} style={{ width: "100%" }}>
              {busy ? "Секунду…" : "Войти"}
            </Btn>
            <div style={{ marginTop: 10 }}>
              <Btn variant="ghost" onClick={withLink} disabled={busy} style={{ width: "100%" }}>
                Прислать ссылку на почту
              </Btn>
            </div>
            {err && <div style={{ color: C.rust, fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>{err}</div>}
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────  ПРИЛОЖЕНИЕ  ───────────────────────── */
export default function App() {
  const [session, setSession] = useState(undefined);
  const [tab, setTab] = useState("studio");
  const [items, setItems] = useState([]);
  const [looks, setLooks] = useState([]);
  const [settings, setSettings] = useState({ city: "", lat: null, lon: null, cityLabel: "" });
  const [ready, setReady] = useState(false);
  const [weather, setWeather] = useState(null);
  const [toast, setToast] = useState("");

  const uid = session?.user?.id;
  const itemsById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);
  const say = (t) => { setToast(t); setTimeout(() => setToast(""), 2600); };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!uid) { setReady(false); return; }
    (async () => {
      try {
        const d = await api.loadAll(uid);
        setItems(d.items); setLooks(d.looks); setSettings(d.settings);
      } catch (e) { say("Не удалось загрузить гардероб: " + e.message); }
      setReady(true);
    })();
  }, [uid]);

  /* ── вещи ── */
  const addItems = async (queue) => {
    let n = 0;
    const added = [];
    for (const q of queue) {
      try {
        const { blob, ...meta } = q;
        added.push(await api.addItem(meta, blob, uid));
        n++;
      } catch (e) { console.error(e); }
    }
    setItems((prev) => [...prev, ...added]);
    say(n === queue.length ? `Добавлено вещей: ${n}` : `Добавлено ${n} из ${queue.length} — часть не загрузилась`);
  };

  const updateItem = async (id, patch) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    try { await api.updateItem(id, patch, uid); } catch (e) { say("Не сохранилось: " + e.message); }
  };

  const removeItem = async (id) => {
    const it = itemsById[id];
    setItems((prev) => prev.filter((i) => i.id !== id));
    setLooks((prev) => prev.filter((l) => !l.placed.some((p) => p.itemId === id)));
    try { await api.deleteItem(it, uid); } catch (e) { say("Не удалилось: " + e.message); }
  };

  const wipeAll = async () => {
    try { await api.wipe(items, uid); setItems([]); setLooks([]); say("Гардероб очищен"); }
    catch (e) { say("Не получилось очистить: " + e.message); }
  };

  /* ── капсулы ── */
  const saveLooks = async (list) => {
    const removed = looks.filter((l) => !list.some((x) => x.id === l.id));
    setLooks(list);
    try {
      for (const l of removed) await api.deleteLook(l.id, uid);
      const saved = [];
      for (const l of list) saved.push(await api.saveLook(l, uid));
      setLooks(saved);
    } catch (e) { say("Капсула не сохранилась: " + e.message); }
  };

  const saveSettings = async (s) => {
    setSettings(s);
    try { await api.saveSettings(s, uid); } catch (e) { console.error(e); }
  };

  const markWorn = async (look) => {
    const today = new Date().toISOString().slice(0, 10);
    const ids = look.placed.map((p) => p.itemId);
    setItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, wear: (i.wear || 0) + 1, lastWorn: today } : i)));
    setLooks((prev) => prev.map((l) => (l.id === look.id ? { ...l, wornDates: [...(l.wornDates || []), today] } : l)));
    try {
      for (const id of ids) {
        const it = itemsById[id];
        if (it) await api.updateItem(id, { wear: (it.wear || 0) + 1, lastWorn: today }, uid);
      }
      if (!look.id.startsWith("look_")) {
        await api.saveLook({ ...look, wornDates: [...(look.wornDates || []), today] }, uid);
      }
    } catch (e) { console.error(e); }
    say("Отмечено на сегодня");
  };

  /* ── погода ── */
  useEffect(() => {
    if (!settings.lat) return;
    (async () => {
      try {
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${settings.lat}&longitude=${settings.lon}&current=temperature_2m,precipitation,weather_code&timezone=auto`
        );
        const j = await r.json();
        setWeather({ t: Math.round(j.current.temperature_2m), rain: j.current.precipitation > 0.1 });
      } catch { setWeather({ error: true }); }
    })();
  }, [settings.lat, settings.lon]);

  const suggestedSeason = weather && !weather.error
    ? weather.t >= 20 ? "summer" : weather.t >= 10 ? "demi" : "winter"
    : null;

  const screen = (text) => (
    <div style={{ minHeight: "100vh", background: C.paper, display: "grid", placeItems: "center", ...S.serif, color: C.ink }}>{text}</div>
  );
  if (session === undefined) return screen("…");
  if (!session) return <Auth />;
  if (!ready) return screen("Открываем гардероб…");

  const TABS = [
    { id: "studio", ru: "Студия" },
    { id: "wardrobe", ru: "Гардероб" },
    { id: "capsules", ru: "Капсулы" },
    { id: "insights", ru: "Аналитика" },
    { id: "wish", ru: "Желания" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.paper, color: C.ink, fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <header style={{ borderBottom: `1px solid ${C.line}`, padding: "14px 16px", position: "sticky", top: 0, background: C.paper, zIndex: 40 }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ ...S.serif, fontSize: 19 }}>Гардероб<span style={{ color: C.olive }}>.</span></div>
          <nav style={{ display: "flex", gap: 4, overflowX: "auto" }} className="hide-scroll">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                ...S.label, padding: "8px 10px", cursor: "pointer", background: "none", border: "none",
                color: tab === t.id ? C.ink : C.ink60,
                borderBottom: `2px solid ${tab === t.id ? C.olive : "transparent"}`,
              }}>{t.ru}</button>
            ))}
            <button onClick={() => supabase.auth.signOut()} title={session.user.email}
              style={{ ...S.label, padding: "8px 10px", cursor: "pointer", background: "none", border: "none", color: C.ink60 }}>
              Выйти
            </button>
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 16px 90px" }}>
        {tab === "studio" && (
          <Studio items={items} itemsById={itemsById} looks={looks} saveLooks={saveLooks}
            weather={weather} suggestedSeason={suggestedSeason} settings={settings}
            saveSettings={saveSettings} say={say} markWorn={markWorn} />
        )}
        {tab === "wardrobe" && (
          <Wardrobe items={items} addItems={addItems} updateItem={updateItem}
            removeItem={removeItem} say={say} wipeAll={wipeAll} />
        )}
        {tab === "capsules" && (
          <Capsules looks={looks} itemsById={itemsById} saveLooks={saveLooks} markWorn={markWorn} say={say} />
        )}
        {tab === "insights" && <Insights items={items} looks={looks} />}
        {tab === "wish" && (
          <Wishlist items={items} addItems={addItems} updateItem={updateItem} removeItem={removeItem} say={say} />
        )}
      </main>

      {toast && (
        <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)",
          background: C.ink, color: C.paper, padding: "10px 18px", borderRadius: 2, fontSize: 12, zIndex: 100, maxWidth: "90vw", textAlign: "center" }}>
          {toast}
        </div>
      )}
      <style>{`.hide-scroll::-webkit-scrollbar{display:none}
        input,select,textarea{font-family:inherit}
        *{box-sizing:border-box}
        body{margin:0}`}</style>
    </div>
  );
}

/* ─────────────────────────  СТУДИЯ  ───────────────────────── */
function Studio({ items, itemsById, looks, saveLooks, weather, suggestedSeason, settings, saveSettings, say, markWorn }) {
  const [season, setSeason] = useState("any");
  const [occasion, setOccasion] = useState("daily");
  const [tpl, setTpl] = useState("classic");
  const [pinned, setPinned] = useState(null);
  const [look, setLook] = useState(null);
  const [sel, setSel] = useState(null);
  const [cityInput, setCityInput] = useState(settings.city || "");
  const [manual, setManual] = useState(false);

  useEffect(() => { if (suggestedSeason && season === "any") setSeason(suggestedSeason); }, [suggestedSeason]);

  const gen = () => {
    const l = buildLook(items, { season, occasion, pinned, tpl });
    if (!l) return say("Не хватает вещей — добавь хотя бы верх, низ и обувь");
    setLook(l); setSel(null); setManual(false);
  };

  const genAll = () => {
    const pool = items.filter((i) => !i.isWish);
    const covered = new Set();
    const out = [];
    for (let n = 0; n < 40 && out.length < 12; n++) {
      const uncovered = pool.filter((i) => !covered.has(i.id) && ["top", "bottom", "dress", "outerwear"].includes(i.category));
      const anchor = uncovered.length ? uncovered[0].id : null;
      const l = buildLook(pool, { season, occasion, pinned: anchor, tpl });
      if (!l) break;
      const key = l.placed.map((p) => p.itemId).sort().join("|");
      if (out.some((o) => o.placed.map((p) => p.itemId).sort().join("|") === key)) continue;
      l.placed.forEach((p) => covered.add(p.itemId));
      l.name = `Капсула ${out.length + 1}`;
      out.push(l);
      if (!uncovered.length) break;
    }
    if (!out.length) return say("Сначала добавь вещи в гардероб");
    saveLooks([...out, ...looks]);
    say(`Собрано капсул: ${out.length} — смотри вкладку «Капсулы»`);
  };

  const startManual = () => {
    setLook({ id: "look_" + Date.now(), name: "", season, occasion, tpl, placed: [], createdAt: Date.now(), wornDates: [] });
    setManual(true); setSel(null);
  };

  const findCity = async () => {
    if (!cityInput.trim()) return;
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityInput)}&count=1&language=ru`);
      const j = await r.json();
      if (!j.results?.length) return say("Город не найден — проверь написание");
      const c = j.results[0];
      saveSettings({ ...settings, city: cityInput, lat: c.latitude, lon: c.longitude, cityLabel: `${c.name}, ${c.country_code}` });
      say("Город сохранён");
    } catch { say("Погода недоступна — выбери сезон вручную"); }
  };

  const lookItems = look ? look.placed.map((p) => itemsById[p.itemId]).filter(Boolean) : [];

  const swap = (placedIdx) => {
    const cur = itemsById[look.placed[placedIdx].itemId];
    const alts = items.filter((i) => i.category === cur.category && i.id !== cur.id && !i.isWish);
    if (!alts.length) return say("Нет других вещей этой категории");
    const next = alts[Math.floor(Math.random() * alts.length)];
    const placed = look.placed.map((p, i) => (i === placedIdx ? { ...p, itemId: next.id } : p));
    setLook({ ...look, placed });
  };

  const addToLook = (item) => {
    const p = layout([item], look.tpl)[0];
    p.z = look.placed.length;
    setLook({ ...look, placed: [...look.placed, p] });
  };

  const save = () => {
    if (!look?.placed.length) return say("Сначала собери образ");
    const name = look.name || `Капсула ${looks.length + 1}`;
    saveLooks([{ ...look, name }, ...looks.filter((l) => l.id !== look.id)]);
    say("Капсула сохранена");
  };

  return (
    <>
      {/* погода */}
      <div style={{ border: `1px solid ${C.line}`, background: C.card, padding: 14, marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div>
            <div style={S.label}>Погода</div>
            {weather && !weather.error ? (
              <div style={{ ...S.serif, fontSize: 22, marginTop: 2 }}>
                {weather.t}° <span style={{ fontSize: 13, color: C.ink60 }}>{settings.cityLabel}{weather.rain ? " · осадки" : ""}</span>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: C.ink60, marginTop: 4 }}>
                {settings.lat ? "Данные не загрузились — выбери сезон вручную" : "Укажи город, чтобы подбирать по погоде"}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input value={cityInput} onChange={(e) => setCityInput(e.target.value)}
            placeholder="Город" style={{ border: `1px solid ${C.line}`, background: "transparent", padding: "9px 10px", fontSize: 13, width: 140, borderRadius: 2, color: C.ink }} />
          <Btn variant="ghost" onClick={findCity}>Сохранить</Btn>
        </div>
      </div>

      <Section eyebrow="Собрать образ" title="Студия">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 6, overflowX: "auto" }} className="hide-scroll">
            <Chip active={season === "any"} onClick={() => setSeason("any")}>Любой сезон</Chip>
            {SEASONS.map((s) => (
              <Chip key={s.id} active={season === s.id} onClick={() => setSeason(s.id)}>
                {s.ru}{suggestedSeason === s.id ? " ·" : ""}
              </Chip>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto" }} className="hide-scroll">
            {OCCASIONS.map((o) => (
              <Chip key={o.id} active={occasion === o.id} onClick={() => setOccasion(o.id)}>{o.ru}</Chip>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto" }} className="hide-scroll">
            {Object.entries(TEMPLATES).map(([k, v]) => (
              <Chip key={k} active={tpl === k} onClick={() => { setTpl(k); if (look) setLook({ ...look, tpl: k, placed: layout(look.placed.map(p => itemsById[p.itemId]).filter(Boolean), k) }); }}>{v.ru}</Chip>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <Btn onClick={gen}>Собрать капсулу</Btn>
            <Btn variant="ghost" onClick={genAll}>Собрать из всех вещей</Btn>
            <Btn variant="ghost" onClick={startManual}>Собрать вручную</Btn>
          </div>
          {pinned && itemsById[pinned] && (
            <div style={{ ...S.label, display: "flex", gap: 8, alignItems: "center" }}>
              Закреплено: {itemsById[pinned].name || catRu(itemsById[pinned].category)}
              <button onClick={() => setPinned(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.rust, ...S.label }}>снять</button>
            </div>
          )}
        </div>
      </Section>

      {look && (
        <Canvas
          look={look} setLook={setLook} itemsById={itemsById} items={items}
          sel={sel} setSel={setSel} onSwap={swap} onAdd={addToLook}
          manual={manual} onSave={save} onRegen={gen}
          onExport={() => exportPng(look, itemsById, look.name || "Капсула")}
          onWorn={() => markWorn(look)}
        />
      )}

      {!look && items.length > 0 && (
        <div style={{ border: `1px dashed ${C.line}`, padding: 40, textAlign: "center", color: C.ink60, fontSize: 13 }}>
          Нажми «Собрать капсулу» — образ появится здесь.
        </div>
      )}
      {items.length === 0 && (
        <div style={{ border: `1px dashed ${C.line}`, padding: 40, textAlign: "center", color: C.ink60, fontSize: 13 }}>
          Гардероб пуст. Загрузи первые фото на вкладке «Гардероб».
        </div>
      )}

      {/* закрепить вещь */}
      {items.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ ...S.label, marginBottom: 8 }}>Закрепить вещь в следующем образе</div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6 }} className="hide-scroll">
            {items.filter((i) => !i.isWish).map((i) => (
              <button key={i.id} onClick={() => setPinned(pinned === i.id ? null : i.id)} style={{
                flex: "0 0 auto", width: 72, height: 72, background: C.card, cursor: "pointer",
                border: `1px solid ${pinned === i.id ? C.olive : C.line}`, borderRadius: 2, padding: 4,
              }}>
                <img src={i.img} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────────────────────  ХОЛСТ  ───────────────────────── */
function Canvas({ look, setLook, itemsById, items, sel, setSel, onSwap, onAdd, manual, onSave, onRegen, onExport, onWorn }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const lookItems = look.placed.map((p) => itemsById[p.itemId]).filter(Boolean);
  const pal = lookItems.length ? lookPalette(lookItems) : [];
  const [adding, setAdding] = useState(false);

  const onDown = (e, idx) => {
    e.preventDefault();
    setSel(idx);
    const r = ref.current.getBoundingClientRect();
    const pt = e.touches ? e.touches[0] : e;
    drag.current = { idx, sx: pt.clientX, sy: pt.clientY, ox: look.placed[idx].x, oy: look.placed[idx].y, w: r.width, h: r.height };
  };
  useEffect(() => {
    const move = (e) => {
      if (!drag.current) return;
      const pt = e.touches ? e.touches[0] : e;
      const d = drag.current;
      const nx = d.ox + ((pt.clientX - d.sx) / d.w) * 100;
      const ny = d.oy + ((pt.clientY - d.sy) / d.h) * 100;
      setLook((L) => ({ ...L, placed: L.placed.map((p, i) => (i === d.idx ? { ...p, x: nx, y: ny } : p)) }));
      if (e.cancelable) e.preventDefault();
    };
    const up = () => { drag.current = null; };
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
    };
  }, [setLook]);

  const patch = (k, v) =>
    setLook({ ...look, placed: look.placed.map((p, i) => (i === sel ? { ...p, [k]: v } : p)) });
  const del = () => { setLook({ ...look, placed: look.placed.filter((_, i) => i !== sel) }); setSel(null); };

  return (
    <div style={{ border: `1px solid ${C.line}`, background: C.card, marginBottom: 24 }}>
      {/* палитра-плашки */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", padding: 14, borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
        {pal.map((hex) => (
          <div key={hex} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 34, height: 34, background: hex, border: `1px solid ${C.line}` }} />
            <div>
              <div style={{ ...S.label, fontSize: 9 }}>{hex.toUpperCase()}</div>
              <div style={{ ...S.serif, fontSize: 13 }}>{colorName(hex)}</div>
            </div>
          </div>
        ))}
        <input value={look.name} onChange={(e) => setLook({ ...look, name: e.target.value })}
          placeholder="Назови капсулу"
          style={{ marginLeft: "auto", border: "none", borderBottom: `1px solid ${C.line}`, background: "transparent", ...S.serif, fontSize: 16, padding: "4px 2px", color: C.ink, minWidth: 130 }} />
      </div>

      {/* холст */}
      <div ref={ref} onClick={(e) => { if (e.target === ref.current) setSel(null); }}
        style={{ position: "relative", width: "100%", paddingTop: "125%", background: C.paper, overflow: "hidden", touchAction: "none" }}>
        {look.placed.map((p, idx) => {
          const it = itemsById[p.itemId];
          if (!it) return null;
          return (
            <img key={idx} src={it.img} alt=""
              onMouseDown={(e) => onDown(e, idx)} onTouchStart={(e) => onDown(e, idx)}
              draggable={false}
              style={{
                position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`,
                transform: `rotate(${p.rot || 0}deg)`, zIndex: p.z, cursor: "grab",
                outline: sel === idx ? `1px solid ${C.olive}` : "none", outlineOffset: 4,
                userSelect: "none",
              }} />
          );
        })}
        {!look.placed.length && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: C.ink60, fontSize: 13 }}>
            Добавь вещи кнопкой ниже
          </div>
        )}
      </div>

      {/* панель редактирования */}
      {sel !== null && look.placed[sel] && (
        <div style={{ padding: 14, borderTop: `1px solid ${C.line}`, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
          <div style={{ ...S.label }}>{itemsById[look.placed[sel].itemId]?.name || catRu(itemsById[look.placed[sel].itemId]?.category)}</div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.ink60 }}>
            размер
            <input type="range" min="6" max="70" value={look.placed[sel].w}
              onChange={(e) => patch("w", +e.target.value)} style={{ width: 90 }} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.ink60 }}>
            наклон
            <input type="range" min="-25" max="25" value={look.placed[sel].rot || 0}
              onChange={(e) => patch("rot", +e.target.value)} style={{ width: 80 }} />
          </label>
          <Btn size="sm" variant="ghost" onClick={() => patch("z", Math.max(...look.placed.map((p) => p.z)) + 1)}>Вперёд</Btn>
          <Btn size="sm" variant="ghost" onClick={() => onSwap(sel)}>Заменить</Btn>
          <Btn size="sm" variant="ghost" onClick={del} style={{ color: C.rust, borderColor: C.rust }}>Убрать</Btn>
        </div>
      )}

      {/* добавление вещей */}
      <div style={{ padding: 14, borderTop: `1px solid ${C.line}` }}>
        <button onClick={() => setAdding(!adding)} style={{ ...S.label, background: "none", border: "none", cursor: "pointer", padding: 0, color: C.ink }}>
          {adding ? "Скрыть гардероб ▲" : "Добавить вещь из гардероба ▼"}
        </button>
        {adding && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(64px,1fr))", gap: 6, marginTop: 12 }}>
            {items.filter((i) => !i.isWish).map((i) => (
              <button key={i.id} onClick={() => onAdd(i)} style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, padding: 4, cursor: "pointer", aspectRatio: "1" }}>
                <img src={i.img} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: 14, borderTop: `1px solid ${C.line}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn onClick={onSave}>Сохранить капсулу</Btn>
        {!manual && <Btn variant="ghost" onClick={onRegen}>Ещё вариант</Btn>}
        <Btn variant="ghost" onClick={onExport}>Скачать 1080×1920</Btn>
        <Btn variant="olive" onClick={onWorn}>Носила сегодня</Btn>
      </div>
    </div>
  );
}

/* ─────────────────────────  ГАРДЕРОБ  ───────────────────────── */
function Wardrobe({ items, addItems, updateItem, removeItem, say, wishMode = false, wipeAll }) {
  const [busy, setBusy] = useState(0);
  const [queue, setQueue] = useState([]);
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(null);
  const fileRef = useRef();

  const onFiles = async (files) => {
    const arr = [...files].filter((f) => f.type.startsWith("image/"));
    if (!arr.length) return;
    setBusy(arr.length);
    const out = [];
    for (const f of arr) {
      try {
        const { blob, dataUrl, colors } = await processFile(f, 25);
        out.push({
          id: "it_" + Date.now() + "_" + Math.floor(Math.random() * 1e5),
          name: "", category: "top", img: dataUrl, blob, colors, file: f, tol: 25,
          seasons: [], formality: 2, fav: false, wear: 0, lastWorn: null,
          isWish: wishMode,
        });
      } catch { }
      setBusy((b) => b - 1);
    }
    setQueue(out);
    setBusy(0);
  };

  const confirmQueue = async () => {
    await addItems(queue.map(({ file, tol, ...it }) => it));
    setQueue([]);
  };

  /* пересчитать вырезание с другой силой — для белого на белом */
  const retune = async (idx, tol) => {
    const q = queue[idx];
    setQueue((prev) => prev.map((x, j) => (j === idx ? { ...x, tol } : x)));
    try {
      const { blob, dataUrl, colors } = await processFile(q.file, tol);
      setQueue((prev) => prev.map((x, j) => (j === idx ? { ...x, blob, img: dataUrl, colors } : x)));
    } catch (e) { console.error(e); }
  };

  const shown = items.filter((i) => (wishMode ? i.isWish : !i.isWish))
    .filter((i) => filter === "all" || i.category === filter);

  return (
    <>
      <Section eyebrow={wishMode ? "Список желаний" : "Мои вещи"} title={wishMode ? "Хочу купить" : `Гардероб · ${shown.length}`}
        right={<Btn onClick={() => fileRef.current.click()}>Загрузить фото</Btn>}>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        {!wishMode && wipeAll && items.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <Btn size="sm" variant="ghost" style={{ color: C.rust, borderColor: C.rust }}
              onClick={() => window.confirm("Удалить все вещи и капсулы?") && wipeAll()}>Очистить всё</Btn>
          </div>
        )}

        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
          style={{ border: `1px dashed ${C.line}`, padding: 18, textAlign: "center", fontSize: 12, color: C.ink60, marginBottom: 18 }}>
          {busy ? `Обрабатываю фото… осталось ${busy}` : "Перетащи фото сюда или нажми «Загрузить фото». Снимай вещь на светлом фоне — он уберётся сам."}
        </div>

        {queue.length > 0 && (
          <div style={{ border: `1px solid ${C.olive}`, padding: 14, marginBottom: 20, background: C.card }}>
            <div style={{ ...S.label, marginBottom: 10 }}>Проверь категории — потом сохрани</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
              {queue.map((q, i) => (
                <div key={q.id} style={{ border: `1px solid ${C.line}`, padding: 8, background: C.paper }}>
                  <div style={{ aspectRatio: "1", display: "grid", placeItems: "center" }}>
                    <img src={q.img} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                  </div>
                  <select value={q.category}
                    onChange={(e) => setQueue(queue.map((x, j) => (j === i ? { ...x, category: e.target.value, formality: CATS.find(c => c.id === e.target.value).form } : x)))}
                    style={{ width: "100%", marginTop: 8, padding: 6, fontSize: 12, border: `1px solid ${C.line}`, background: C.paper, borderRadius: 2 }}>
                    {CATS.map((c) => <option key={c.id} value={c.id}>{c.ru}</option>)}
                  </select>
                  <input placeholder="Название" value={q.name}
                    onChange={(e) => setQueue(queue.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    style={{ width: "100%", marginTop: 6, padding: 6, fontSize: 12, border: `1px solid ${C.line}`, background: C.paper, borderRadius: 2 }} />
                  <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                    {SEASONS.map((s) => (
                      <button key={s.id} onClick={() => setQueue(queue.map((x, j) => j === i ? { ...x, seasons: x.seasons.includes(s.id) ? x.seasons.filter(v => v !== s.id) : [...x.seasons, s.id] } : x))}
                        style={{ ...S.label, fontSize: 9, flex: 1, padding: "5px 2px", cursor: "pointer", borderRadius: 2, border: `1px solid ${q.seasons.includes(s.id) ? C.olive : C.line}`, background: q.seasons.includes(s.id) ? C.olive : "transparent", color: q.seasons.includes(s.id) ? "#fff" : C.ink60 }}>
                        {s.ru}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                    {q.colors.map((c) => <div key={c} style={{ width: 16, height: 16, background: c, border: `1px solid ${C.line}` }} />)}
                  </div>
                  <label style={{ display: "block", fontSize: 10, color: C.ink60, marginTop: 8 }}>
                    вырезание фона: {q.tol === 0 ? "выключено" : q.tol}
                    <input type="range" min="0" max="70" step="5" value={q.tol}
                      onChange={(e) => retune(i, +e.target.value)} style={{ width: "100%" }} />
                  </label>
                  <div style={{ fontSize: 10, color: C.ink60, lineHeight: 1.4 }}>
                    Съело часть вещи — уменьшай. Остался фон — увеличивай. 0 оставит фото как есть.
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
              <Btn onClick={confirmQueue}>Сохранить в гардероб</Btn>
              <Btn variant="ghost" onClick={() => setQueue([])}>Отменить</Btn>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14 }} className="hide-scroll">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>Все</Chip>
          {CATS.map((c) => <Chip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>{c.ru}</Chip>)}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 10 }}>
          {shown.map((i) => (
            <div key={i.id} onClick={() => setOpen(open === i.id ? null : i.id)}
              style={{ border: `1px solid ${C.line}`, background: C.card, padding: 8, cursor: "pointer" }}>
              <div style={{ aspectRatio: "1", display: "grid", placeItems: "center" }}>
                <img src={i.img} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              </div>
              <div style={{ ...S.label, marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {i.name || catRu(i.category)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                <div style={{ display: "flex", gap: 3 }}>
                  {i.colors.slice(0, 3).map((c, k) => <div key={k} style={{ width: 11, height: 11, background: c, border: `1px solid ${C.line}` }} />)}
                </div>
                <span style={{ fontSize: 10, color: i.wear ? C.olive : C.ink60 }}>носила {i.wear || 0}</span>
              </div>
              {open === i.id && (
                <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
                  <select value={i.category} onChange={(e) => updateItem(i.id, { category: e.target.value })}
                    style={{ width: "100%", padding: 5, fontSize: 11, border: `1px solid ${C.line}`, background: C.paper, borderRadius: 2 }}>
                    {CATS.map((c) => <option key={c.id} value={c.id}>{c.ru}</option>)}
                  </select>
                  <div style={{ display: "flex", gap: 3, marginTop: 6 }}>
                    {SEASONS.map((s) => (
                      <button key={s.id} onClick={() => updateItem(i.id, { seasons: i.seasons?.includes(s.id) ? i.seasons.filter(v => v !== s.id) : [...(i.seasons || []), s.id] })}
                        style={{ ...S.label, fontSize: 9, flex: 1, padding: "4px 2px", cursor: "pointer", borderRadius: 2, border: `1px solid ${i.seasons?.includes(s.id) ? C.olive : C.line}`, background: i.seasons?.includes(s.id) ? C.olive : "transparent", color: i.seasons?.includes(s.id) ? "#fff" : C.ink60 }}>
                        {s.ru}
                      </button>
                    ))}
                  </div>
                  <label style={{ display: "block", fontSize: 10, color: C.ink60, marginTop: 8 }}>
                    формальность: {i.formality}
                    <input type="range" min="1" max="5" value={i.formality} onChange={(e) => updateItem(i.id, { formality: +e.target.value })} style={{ width: "100%" }} />
                  </label>
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <Btn size="sm" variant="ghost" onClick={() => updateItem(i.id, { fav: !i.fav })}>{i.fav ? "★ любимая" : "☆ в любимые"}</Btn>
                    {wishMode && <Btn size="sm" variant="olive" onClick={() => updateItem(i.id, { isWish: false })}>Купила</Btn>}
                    <Btn size="sm" variant="ghost" style={{ color: C.rust, borderColor: C.rust }} onClick={() => removeItem(i.id)}>Удалить</Btn>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

/* ─────────────────────────  ЖЕЛАНИЯ  ───────────────────────── */
function Wishlist(props) {
  const wish = props.items.filter((i) => i.isWish);
  const real = props.items.filter((i) => !i.isWish);
  const potential = useMemo(() => {
    return wish.map((w) => {
      const pool = [...real, { ...w, isWish: false }];
      let n = 0;
      for (let k = 0; k < 12; k++) {
        const l = buildLook(pool, { season: "any", occasion: "daily", pinned: w.id, tpl: "classic" });
        if (l) n++;
      }
      return { w, n };
    });
  }, [props.items]);

  return (
    <>
      <Wardrobe {...props} wishMode say={props.say || (() => { })} />
      {wish.length > 0 && (
        <Section eyebrow="Что даст покупка" title="Сколько образов добавит">
          <div style={{ display: "grid", gap: 8 }}>
            {potential.map(({ w, n }) => (
              <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 12, border: `1px solid ${C.line}`, background: C.card, padding: 10 }}>
                <img src={w.img} alt="" style={{ width: 44, height: 44, objectFit: "contain" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ ...S.serif, fontSize: 15 }}>{w.name || catRu(w.category)}</div>
                  <div style={{ fontSize: 11, color: C.ink60 }}>
                    {n === 0 ? "Пока не с чем сочетать" : `Собирается образов: около ${n} из 12 попыток`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

/* ─────────────────────────  КАПСУЛЫ  ───────────────────────── */
function Capsules({ looks, itemsById, saveLooks, markWorn, say }) {
  const [open, setOpen] = useState(null);
  if (!looks.length)
    return <div style={{ border: `1px dashed ${C.line}`, padding: 40, textAlign: "center", color: C.ink60, fontSize: 13 }}>
      Сохранённых капсул пока нет. Собери первую в студии.
    </div>;

  return (
    <Section eyebrow="Сохранённое" title={`Капсулы · ${looks.length}`}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 }}>
        {looks.map((l) => {
          const its = l.placed.map((p) => itemsById[p.itemId]).filter(Boolean);
          const pal = its.length ? lookPalette(its) : [];
          return (
            <div key={l.id} style={{ border: `1px solid ${C.line}`, background: C.card }}>
              <div style={{ position: "relative", paddingTop: "125%", background: C.paper, overflow: "hidden" }}>
                {l.placed.map((p, i) => {
                  const it = itemsById[p.itemId];
                  if (!it) return null;
                  return <img key={i} src={it.img} alt="" style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, transform: `rotate(${p.rot || 0}deg)`, zIndex: p.z }} />;
                })}
              </div>
              <div style={{ padding: 10 }}>
                <div style={{ ...S.serif, fontSize: 16 }}>{l.name || "Без названия"}</div>
                <div style={{ ...S.label, marginTop: 3 }}>
                  {SEASONS.find(s => s.id === l.season)?.ru || "Любой сезон"} · надета {l.wornDates?.length || 0} раз
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                  {pal.map((h) => <div key={h} style={{ width: 18, height: 18, background: h, border: `1px solid ${C.line}` }} />)}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  <Btn size="sm" variant="olive" onClick={() => markWorn(l)}>Носила</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => exportPng(l, itemsById, l.name)}>PNG</Btn>
                  <Btn size="sm" variant="ghost" style={{ color: C.rust, borderColor: C.rust }}
                    onClick={() => saveLooks(looks.filter((x) => x.id !== l.id))}>Удалить</Btn>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ─────────────────────────  АНАЛИТИКА  ───────────────────────── */
function Insights({ items, looks }) {
  const real = items.filter((i) => !i.isWish);
  const inLooks = new Set(looks.flatMap((l) => l.placed.map((p) => p.itemId)));
  const dead = real.filter((i) => !(i.wear > 0) && !inLooks.has(i.id));
  const counts = {};
  real.forEach((i) => (counts[i.category] = (counts[i.category] || 0) + 1));

  const gaps = [];
  Object.entries(MINIMUMS).forEach(([cat, min]) => {
    const n = counts[cat] || 0;
    if (n < min) gaps.push(`${catRu(cat)}: ${n} из ${min} — не хватает ${min - n}`);
  });
  const lightBottoms = real.filter((i) => i.category === "bottom" && ["light", "neutral"].includes(family(i.colors[0])));
  if (counts.bottom >= 2 && lightBottoms.length === 0) gaps.push("Все низы тёмные — светлые брюки или юбка расширят палитру");
  const accentCount = real.filter((i) => !isNeutralFam(family(i.colors[0]))).length;
  if (real.length >= 8 && accentCount === 0) gaps.push("Гардероб полностью нейтральный — одна цветная вещь оживит образы");
  if (real.length >= 8 && accentCount / real.length > 0.6) gaps.push("Много ярких вещей и мало базы — не хватает нейтральных вещей-связок");

  const top = [...real].sort((a, b) => (b.wear || 0) - (a.wear || 0)).slice(0, 6);
  const days = [...new Set(looks.flatMap((l) => l.wornDates || []))].sort().slice(-14);

  return (
    <>
      <Section eyebrow="Что носится" title="Календарь и счётчик">
        {days.length ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
            {days.map((d) => (
              <div key={d} style={{ border: `1px solid ${C.line}`, background: C.card, padding: "6px 10px", fontSize: 11 }}>
                {d.slice(8)}.{d.slice(5, 7)}
              </div>
            ))}
          </div>
        ) : <div style={{ fontSize: 13, color: C.ink60, marginBottom: 18 }}>Отмечай «Носила» — здесь появится история.</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 10 }}>
          {top.map((i) => (
            <div key={i.id} style={{ border: `1px solid ${C.line}`, background: C.card, padding: 8 }}>
              <div style={{ aspectRatio: "1", display: "grid", placeItems: "center" }}>
                <img src={i.img} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              </div>
              <div style={{ ...S.label, marginTop: 6 }}>носила {i.wear || 0}</div>
              {i.lastWorn && <div style={{ fontSize: 10, color: C.ink60 }}>последний раз {i.lastWorn}</div>}
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Дыры в гардеробе" title="Чего не хватает">
        {gaps.length ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.8 }}>
            {gaps.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        ) : <div style={{ fontSize: 13, color: C.ink60 }}>База закрыта — базовых категорий хватает.</div>}
      </Section>

      <Section eyebrow="Мёртвый груз" title={`Не используется · ${dead.length}`}>
        {dead.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 10 }}>
            {dead.map((i) => (
              <div key={i.id} style={{ border: `1px solid ${C.line}`, background: C.card, padding: 8, opacity: 0.75 }}>
                <div style={{ aspectRatio: "1", display: "grid", placeItems: "center" }}>
                  <img src={i.img} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                </div>
                <div style={{ ...S.label, marginTop: 6 }}>{i.name || catRu(i.category)}</div>
              </div>
            ))}
          </div>
        ) : <div style={{ fontSize: 13, color: C.ink60 }}>Все вещи в деле.</div>}
      </Section>
    </>
  );
}
