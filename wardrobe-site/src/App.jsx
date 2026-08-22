import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase } from "./supabase";
import { api } from "./api";

/* ─────────────────────────  ПАЛИТРА И ТОКЕНЫ  ───────────────────────── */
const C = {
  paper: "#F1F2F4",
  paper2: "#E3E5E9",
  card: "#F8F9FB",
  ink: "#1C1E22",
  ink60: "#666B73",
  line: "#D5D8DE",
  olive: "#4E5A67",
  chestnut: "#7A818B",
  rust: "#96504C",
};

const FONT = "'Inter', 'Helvetica Neue', 'Segoe UI', system-ui, Arial, sans-serif";

const S = {
  label: {
    fontSize: 10,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: C.ink60,
    fontWeight: 600,
  },
  display: { fontFamily: FONT, fontWeight: 500, letterSpacing: "-0.015em" },
};

/* ─────────────────────────  СПРАВОЧНИКИ  ───────────────────────── */
const CATS = [
  { id: "outerwear", ru: "Верхняя одежда", slot: 0, form: 3 },
  { id: "blazer", ru: "Пиджак", slot: 1, form: 4 },
  { id: "shirt", ru: "Рубашка", slot: 2, form: 3 },
  { id: "top", ru: "Верх", slot: 3, form: 2 },
  { id: "dress", ru: "Платье", slot: 4, form: 3 },
  { id: "pants", ru: "Брюки и джинсы", slot: 5, form: 2 },
  { id: "skirt", ru: "Юбка", slot: 5, form: 3 },
  { id: "shorts", ru: "Шорты", slot: 5, form: 1 },
  { id: "sweats", ru: "Спортивные брюки", slot: 5, form: 1 },
  { id: "shoes", ru: "Обувь", slot: 6, form: 2 },
  { id: "bag", ru: "Сумка", slot: 7, form: 2 },
  { id: "belt", ru: "Ремень", slot: 8, form: 3 },
  { id: "accessory", ru: "Аксессуар", slot: 8, form: 2 },
  { id: "jewelry", ru: "Украшение", slot: 9, form: 3 },
];

/* роли: что считается верхом и низом при сборке */
const TOPS = ["top", "shirt", "dress"];
const BOTTOMS = ["pants", "skirt", "shorts", "sweats", "bottom"];
const BELT_OK = ["pants", "shorts", "bottom"];   /* к спортивным и юбке ремень не идёт */
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

/* Порядок для раскладки по цветам: сначала светлые, потом нейтральные и
   коричневые, дальше цветные по кругу, в конце тёмные. */
function colorOrder(item) {
  const hex = item.colors?.[0] || "#888888";
  const [h, sat, l] = rgbToHsl(...hexToRgb(hex));
  const f = family(hex);
  if (f === "light") return [0, -l, 0];
  if (f === "neutral") return [1, -l, 0];
  if (f === "brown") return [2, h, -l];
  if (f === "dark") return [4, -l, 0];
  return [3, h, -sat];
}
const byColor = (a, b) => {
  const x = colorOrder(a), y = colorOrder(b);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};

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
  const aspect = cropped.height / cropped.width;
  const colors = pickColors(cropped);
  return { blob, dataUrl: cropped.toDataURL("image/webp", 0.82), colors, aspect,
           guess: guessCategory(aspect, colors) };
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

/* Черновая догадка о категории по форме выреза: обувь широкая и низкая,
   брюки узкие и длинные, верх — почти квадратный. Ошибается, поэтому
   категория остаётся в списке на подтверждение. */
function guessCategory(aspect, colors) {
  const a = aspect || 1.2;
  if (a < 0.62) return "shoes";
  if (a < 0.85) return "bag";
  if (a > 1.75) return "pants";
  if (a > 1.35) return "skirt";
  return "top";
}

/* ─────────────────────────  РАСКЛАДКА КОЛЛАЖА  ───────────────────────── */
/* У каждой категории своя рамка в процентах холста. Вещь вписывается в неё
   целиком и центрируется, поэтому все низы получают одинаковый масштаб,
   но шорты остаются короткими, а брюки длинными — упираются в разные
   стороны рамки. То же с верхами: кроп-топ не растянется до туники. */
const CANVAS_AR = 1.25;

/* Для каждой категории задана площадь на холсте и предельная рамка.
   Вещь масштабируется так, чтобы занимать одинаковую площадь с себе
   подобными — тогда пара обуви сверху и пара сбоку выглядят одинаково.
   Рамка не даёт длинному вылезти за поле: брюки упрутся в высоту и
   станут узкими, шорты — в ширину и останутся короткими. */
/* Размер вещи задаётся ШИРИНОЙ — глаз считывает величину одежды именно по
   ней. Высота получается из пропорций фотографии, но ограничена сверху,
   чтобы длинное платье не занимало весь холст. Небольшая поправка на
   вытянутость: узкая длинная вещь при равной ширине кажется крупнее,
   поэтому её слегка уменьшаем. */
const SIZE = {
  outerwear: { w: 33, h: 48 },
  blazer:    { w: 33, h: 48 },
  dress:     { w: 30, h: 60 },
  shirt:     { w: 32, h: 42 },
  top:       { w: 29, h: 40 },
  pants:     { w: 27, h: 54 },
  skirt:     { w: 27, h: 50 },
  shorts:    { w: 27, h: 34 },
  sweats:    { w: 27, h: 54 },
  bottom:    { w: 27, h: 54 },
  shoes:     { w: 26, h: 20 },
  bag:       { w: 22, h: 24 },
  belt:      { w: 16, h: 14 },
  accessory: { w: 16, h: 16 },
  jewelry:   { w: 13, h: 13 },
};
const WIDTH_MAX = 33;

/* поправка на вытянутость: чем длиннее вещь, тем чуть уже она рисуется */
const slim = (a) => Math.pow(1.15 / Math.max(a, 0.35), 0.16);

function sizeIn(cat, aspect) {
  const box = SIZE[cat] || SIZE.accessory;
  const a = aspect || 1.2;
  let w = box.w * Math.min(1.12, Math.max(0.82, slim(a)));
  let h = (w * a) / CANVAS_AR;
  if (h > box.h) { h = box.h; w = (h * CANVAS_AR) / a; }
  return { w, h, box };
}

/* Доля площади миниатюры: рубашка крупнее футболки, ремень мельче брюк —
   ровно так же, как в коллаже. Иначе в сетке всё выглядит вразнобой. */
function thumbSize(cat, aspect, fill = 0.92) {
  const box = SIZE[cat] || SIZE.accessory;
  const a = aspect || 1.2;
  let w = (box.w / WIDTH_MAX) * 100 * fill * Math.min(1.12, Math.max(0.82, slim(a)));
  let h = w * a;
  if (h > 96) { h = 96; w = h / a; }
  if (w > 96) { w = 96; h = w * a; }
  return { w, h };
}

function Thumb({ item, ar, fill, h }) {
  const a = ar?.[item.id];
  const { w, h: hh } = thumbSize(item.category, a, fill);
  const box = h ? { height: h } : { aspectRatio: "1" };
  return (
    <div style={{ ...box, display: "grid", placeItems: "center", overflow: "hidden" }}>
      <img src={item.img} alt="" draggable={false}
        style={a ? { width: `${w}%`, height: `${hh}%`, objectFit: "contain" }
                 : { maxWidth: "84%", maxHeight: "84%", objectFit: "contain" }} />
    </div>
  );
}

/* Раскладка как на коллажах-референсах: слева одежда — верх в ряд,
   под ним низ; справа узкая колонка из мелочей сверху вниз: украшения,
   аксессуары, ремень, сумка, обувь. Слои раскладываются рядом со сдвигом,
   чтобы обе вещи было видно, а не одна поверх другой. */
const UPPER = ["outerwear", "blazer", "shirt", "top", "dress"];
const SIDE = ["jewelry", "accessory", "belt", "bag", "shoes"];

function layout(items, tpl = "classic", ar = {}) {
  const order = (list, x) => list.indexOf(x.category);
  const uppers = items.filter((i) => UPPER.includes(i.category))
    .sort((a, b) => order(UPPER, a) - order(UPPER, b));
  const bottoms = items.filter((i) => BOTTOMS.includes(i.category));
  const side = items.filter((i) => SIDE.includes(i.category))
    .sort((a, b) => order(SIDE, a) - order(SIDE, b));

  const out = [];
  const leftW = side.length ? 66 : 100;

  /* верхние вещи в ряд с небольшим нахлёстом */
  const sizes = uppers.map((i) => sizeIn(i.category, ar[i.id]));
  const overlap = -2;   /* зазор, а не нахлёст: обе вещи должны читаться */
  const rowW = sizes.reduce((sum, s) => sum + s.w, 0) - overlap * Math.max(0, uppers.length - 1);
  const k = Math.min(1, (leftW - 6) / Math.max(rowW, 1));
  let x = (leftW - rowW * k) / 2;
  let bottomOfRow = 4;
  uppers.forEach((it, i) => {
    const w = sizes[i].w * k, h = sizes[i].h * k;
    out.push({ itemId: it.id, x, y: 4, w, rot: 0, z: i });
    bottomOfRow = Math.max(bottomOfRow, 4 + h);
    x += w - overlap * k;
  });

  /* низ под верхом, по центру левой части */
  let y = uppers.length ? bottomOfRow - 4 : 6;
  bottoms.forEach((it, i) => {
    const s = sizeIn(it.category, ar[it.id]);
    const kk = Math.min(1, (leftW - 10) / s.w);
    const w = s.w * kk, h = s.h * kk;
    out.push({ itemId: it.id, x: (leftW - w) / 2, y, w, rot: 0, z: 10 + i });
    y += h + 2;
  });

  /* Колонка справа: мелочи сверху вниз, обувь всегда прижата к низу —
     но не к самому краю, а на уровне низа одежды. */
  if (side.length) {
    const colW = 100 - leftW;
    const shoes = side.filter((i) => i.category === "shoes");
    const small = side.filter((i) => i.category !== "shoes");
    const gap = 3;
    const place = (it, y, i) => {
      const raw = sizeIn(it.category, ar[it.id]);
      const kk = Math.min(1, (colW - 4) / raw.w);
      const w = raw.w * kk, h = raw.h * kk;
      out.push({ itemId: it.id, x: leftW + (colW - w) / 2, y, w, rot: 0, z: 20 + i });
      return h;
    };

    let shoesH = 0;
    if (shoes.length) {
      const raw = sizeIn("shoes", ar[shoes[0].id]);
      shoesH = raw.h * Math.min(1, (colW - 4) / raw.w);
    }
    const room = 92 - (shoes.length ? shoesH + 6 : 0);

    let sy = 4;
    small.forEach((it, i) => { sy += place(it, sy, i) + gap; });
    if (sy > room + 4) {   /* мелочей много — поджимаем их кверху */
      const shift = sy - room - 4;
      out.filter((p) => small.some((m) => m.id === p.itemId))
         .forEach((p) => { p.y = Math.max(2, p.y - shift); });
    }
    shoes.forEach((it, i) => place(it, 92 - shoesH, 30 + i));
  }

  /* Композиция выходит широкой и низкой, а холст вытянутый. Разводим вещи
     по вертикали от центра, пока пропорция не приблизится к холсту, —
     размеры при этом не меняются, просто уходит пустота снизу. */
  const hOf = (p) => (p.w * (ar[p.itemId] || 1.2)) / CANVAS_AR;
  const top = Math.min(...out.map((p) => p.y));
  const bot = Math.max(...out.map((p) => p.y + hOf(p)));
  const left = Math.min(...out.map((p) => p.x));
  const right = Math.max(...out.map((p) => p.x + p.w));
  const bw = right - left, bh = bot - top;
  const want = 1.16;
  if (bh > 0 && bh / bw < want) {
    const f = Math.min(1.35, (want * bw) / bh);
    const cy = (top + bot) / 2;
    out.forEach((p) => { p.y = cy + (p.y + hOf(p) / 2 - cy) * f - hOf(p) / 2; });
  }
  return out;
}

/* Подгонка коллажа под холст: считаем общий габарит вещей и растягиваем
   его к краям. Чем меньше вещей, тем больше воздуха вокруг — чтобы три
   предмета не болтались в углах, а девять не задыхались. */
function fitPlaced(placed, itemsById, ar) {
  if (!placed.length || !ar) return placed;
  const boxes = placed.map((p) => {
    const a = ar[p.itemId];
    return a ? { p, h: (p.w * a) / CANVAS_AR } : null;
  });
  if (boxes.some((b) => !b)) return placed;

  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  boxes.forEach(({ p, h }) => {
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x + p.w); y1 = Math.max(y1, p.y + h);
  });
  const bw = x1 - x0, bh = y1 - y0;
  if (bw <= 0 || bh <= 0) return placed;

  const n = placed.length;
  const target = n <= 3 ? 0.90 : n <= 5 ? 0.94 : 0.97;
  const k = Math.min((target * 100) / bw, (target * 100) / bh);
  const dx = (100 - bw * k) / 2 - x0 * k;
  const dy = (100 - bh * k) / 2 - y0 * k;
  return placed.map((p) => ({ ...p, x: p.x * k + dx, y: p.y * k + dy, w: p.w * k }));
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
  const by = (c) => pool.filter((i) => (Array.isArray(c) ? c.includes(i.category) : i.category === c) && ok(i));
  const pick = (arr) => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : null);
  const occ = OCCASIONS.find((o) => o.id === occasion);

  let best = null;
  for (let n = 0; n < 90; n++) {
    const chosen = [];
    const pinnedItem = pinned ? pool.find((i) => i.id === pinned) : null;
    if (pinnedItem) chosen.push(pinnedItem);
    const has = (c) => chosen.some((i) => i.category === c);

    const hasRole = (list) => chosen.some((i) => list.includes(i.category));
    const useDress = !hasRole(TOPS) && !hasRole(BOTTOMS) && by("dress").length && Math.random() < 0.25;
    if (useDress) chosen.push(pick(by("dress")));

    if (!has("dress")) {
      if (!hasRole(["top", "shirt"])) {
        /* рубашка поверх топа — распространённый слой, собираем его иногда вместе */
        const shirts = by("shirt"), plain = by("top");
        if (shirts.length && plain.length && Math.random() < 0.3) {
          chosen.push(pick(plain)); chosen.push(pick(shirts));
        } else {
          const t = pick([...plain, ...shirts]); if (t) chosen.push(t);
        }
      }
      if (!hasRole(BOTTOMS)) { const b = pick(by(BOTTOMS)); if (b) chosen.push(b); }
    }
    if (!has("shoes")) { const sh = pick(by("shoes")); if (sh) chosen.push(sh); }
    const outers = [...by("outerwear"), ...by("blazer")];
    if (season === "winter" && !hasRole(["outerwear", "blazer"])) { const o = pick(by("outerwear")) || pick(outers); if (o) chosen.push(o); }
    else if (season !== "summer" && !hasRole(["outerwear", "blazer"]) && Math.random() < 0.55) { const o = pick(outers); if (o) chosen.push(o); }
    if (!has("bag") && Math.random() < 0.75) { const g = pick(by("bag")); if (g) chosen.push(g); }
    /* аксессуар — необязательная деталь, а не обязательный элемент.
       Больше половины образов обходятся без него, а те, что уже мелькали
       в этой подборке, пропускаем, чтобы один ремень не кочевал везде. */
    /* ремень уместен к брюкам, джинсам и шортам, но не к спортивным и юбке */
    const bottomCat = chosen.find((i) => BOTTOMS.includes(i.category))?.category;
    const beltFits = BELT_OK.includes(bottomCat);
    if (beltFits && !has("belt") && Math.random() < 0.3) { const bl = pick(by("belt")); if (bl) chosen.push(bl); }

    const avoid = new Set(opts.avoid || []);
    const fresh = [...by("accessory"), ...by("jewelry")].filter((e) => !avoid.has(e.id));
    const nExtra = Math.random() < 0.55 ? 0 : Math.random() < 0.85 ? 1 : 2;
    fresh.sort(() => Math.random() - 0.5).slice(0, nExtra)
      .forEach((e) => { if (!chosen.includes(e)) chosen.push(e); });

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
  /* рубашка уходит назад, топ поверх неё — тогда видно обе вещи */
  return {
    id: "look_" + Date.now() + "_" + Math.floor(Math.random() * 1e4),
    name: "",
    season, occasion, tpl,
    placed: layout(ordered, tpl, opts.ar || {}),
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
    ctx.fillStyle = C.ink; ctx.font = "600 17px Inter, Helvetica, Arial";
    ctx.fillText(colorName(hex), x + 10, 182);
  });
  ctx.fillStyle = C.ink;
  ctx.font = "500 44px Inter, Helvetica, Arial";
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
        <h2 style={{ ...S.display, fontSize: 24, margin: "4px 0 0", color: C.ink, fontWeight: 400 }}>{title}</h2>
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
    <div style={{ minHeight: "100vh", background: C.paper, color: C.ink, display: "grid", placeItems: "center", padding: 20, fontFamily: FONT }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ ...S.display, fontSize: 30, marginBottom: 6 }}>Гардероб</div>
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

/* ─────────────────────────  МЕНЮ ПОЛЬЗОВАТЕЛЯ  ───────────────────────── */
function UserPanel({ email, items, looks, onClose }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const leave = () => {
    if (window.confirm("Точно выйти из аккаунта?")) supabase.auth.signOut();
  };

  const real = items.filter((i) => !i.isWish);
  const Row = ({ k, v }) => (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "9px 0", borderBottom: `1px solid ${C.line}` }}>
      <span style={{ color: C.ink60 }}>{k}</span><span>{v}</span>
    </div>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(28,30,34,.28)", zIndex: 90 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: "min(340px, 88vw)", zIndex: 91,
        background: C.card, borderLeft: `1px solid ${C.line}`, padding: 22, overflowY: "auto",
        boxShadow: "-12px 0 32px rgba(28,30,34,.10)", fontFamily: FONT,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ ...S.label }}>аккаунт</div>
            <div style={{ ...S.display, fontSize: 17, marginTop: 6, wordBreak: "break-all" }}>{email}</div>
          </div>
          <button onClick={onClose} aria-label="Закрыть"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, lineHeight: 1, color: C.ink60 }}>×</button>
        </div>

        <div style={{ marginTop: 22 }}>
          <Row k="вещей" v={real.length} />
          <Row k="капсул сохранено" v={looks.length} />
          <Row k="вещей в деле" v={real.filter((i) => i.wear > 0).length} />
          <Row k="в списке желаний" v={items.filter((i) => i.isWish).length} />
        </div>

        <div style={{ marginTop: 26 }}>
          <div style={{ ...S.label, marginBottom: 10 }}>язык</div>
          <div style={{ display: "flex", gap: 6 }}>
            <Chip active onClick={() => {}}>Русский</Chip>
            <Chip active={false} onClick={() => alert("Английская версия ещё готовится")}>English</Chip>
          </div>
        </div>

        <div style={{ marginTop: 30 }}>
          <Btn variant="ghost" onClick={leave} style={{ width: "100%", color: C.rust, borderColor: C.rust }}>
            Выйти из аккаунта
          </Btn>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────  О ПРОЕКТЕ  ───────────────────────── */
function About({ items, looks, ar, onStart }) {
  const real = items.filter((i) => !i.isWish);
  const itemsById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);

  /* витрина: последняя сохранённая капсула, иначе собираем на лету */
  const showcase = useMemo(() => {
    if (looks.length) return looks[0];
    if (real.length < 3) return null;
    const l = buildLook(items, { season: "any", occasion: "daily", tpl: "classic", ar });
    return l ? { ...l, placed: fitPlaced(l.placed, itemsById, ar) } : null;
  }, [looks, items, ar]);
  const tops = real.filter((i) => TOPS.includes(i.category)).length;
  const bottoms = real.filter((i) => BOTTOMS.includes(i.category)).length;
  const shoes = real.filter((i) => i.category === "shoes").length;
  const combos = tops * bottoms * shoes;

  const Card = ({ n, t, d }) => (
    <div style={{ border: `1px solid ${C.line}`, background: C.card, padding: 18 }}>
      <div style={{ ...S.label, fontSize: 9, color: C.olive }}>{n}</div>
      <div style={{ ...S.display, fontSize: 17, margin: "8px 0 6px" }}>{t}</div>
      <div style={{ fontSize: 13, color: C.ink60, lineHeight: 1.6 }}>{d}</div>
    </div>
  );

  return (
    <>
      <div className="hero-grid" style={{ padding: "26px 0 34px", borderBottom: `1px solid ${C.line}`, marginBottom: 30 }}>
        <div>
          <div style={{ ...S.label, marginBottom: 14 }}>капсульный гардероб</div>
          <h1 style={{ ...S.display, fontSize: "clamp(28px, 4.4vw, 46px)", margin: 0, lineHeight: 1.12 }}>
            Всё, что у тебя есть, — и всё, что из этого можно собрать.
          </h1>
          <p style={{ fontSize: 15, color: C.ink60, lineHeight: 1.7, maxWidth: 520, marginTop: 18 }}>
            Загружаешь фотографии вещей, фон убирается сам, цвета считываются с ткани.
            Дальше приложение перебирает сочетания и показывает готовые капсулы —
            проверяя цвет, формальность и сезон, но оставляя последнее слово за тобой.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 22, flexWrap: "wrap" }}>
            <Btn onClick={() => onStart("feed")}>Смотреть подборку</Btn>
            <Btn variant="ghost" onClick={() => onStart("wardrobe")}>Открыть гардероб</Btn>
          </div>
        </div>

        {showcase && (
          <div style={{ border: `1px solid ${C.line}`, background: C.card, padding: 10 }}>
            <div style={{ position: "relative", paddingTop: "125%", background: C.paper, overflow: "hidden" }}>
              {showcase.placed.map((p, i) => {
                const it = itemsById[p.itemId];
                if (!it) return null;
                return <img key={i} src={it.img} alt="" style={{
                  position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, zIndex: p.z,
                }} />;
              })}
            </div>
            <div style={{ ...S.label, fontSize: 9, marginTop: 8, textAlign: "center" }}>
              {showcase.name || "капсула из твоих вещей"}
            </div>
          </div>
        )}
      </div>

      {real.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 1, background: C.line, border: `1px solid ${C.line}`, marginBottom: 34 }}>
          {[[real.length, "вещей"], [combos, "сочетаний"], [looks.length, "капсул сохранено"],
            [real.filter((i) => i.wear > 0).length, "вещей в деле"]].map(([v, t]) => (
            <div key={t} style={{ background: C.card, padding: "18px 14px" }}>
              <div style={{ ...S.display, fontSize: 26 }}>{v}</div>
              <div style={{ ...S.label, fontSize: 9, marginTop: 4 }}>{t}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14, marginBottom: 34 }}>
        <Card n="01" t="Гардероб" d="Фотографируешь вещь на контрастном фоне — фон убирается, цвета определяются, категория подставляется сама. Остаётся подтвердить." />
        <Card n="02" t="Подборка" d="Девять готовых капсул при каждом открытии. Фильтры по сезону и поводу, кнопка «другой» меняет один образ, не трогая остальные." />
        <Card n="03" t="Студия" d="Ручная сборка и правка: вещи двигаются, меняют размер и порядок слоёв. Можно закрепить вещь и собрать образ вокруг неё." />
        <Card n="04" t="Аналитика" d="Сколько сочетаний даёт гардероб, какая доля из них удачная, что лежит без дела и чего не хватает — с объяснением, а не просто списком." />
      </div>

      <div style={{ border: `1px solid ${C.line}`, background: C.card, padding: 20 }}>
        <div style={{ ...S.display, fontSize: 17, marginBottom: 10 }}>Как устроен подбор</div>
        <p style={{ fontSize: 13, color: C.ink60, lineHeight: 1.7, margin: 0 }}>
          Алгоритм собирает сотни вариантов и оценивает каждый: не больше двух ярких цветов на нейтральной базе,
          близкая формальность вещей, совпадение по сезону, редко надёванное — выше в очереди.
          Он не видит силуэта и принта, поэтому это помощник, а не стилист: последнее слово остаётся за тобой.
        </p>
      </div>
    </>
  );
}

/* ─────────────────────────  ПРИЛОЖЕНИЕ  ───────────────────────── */
export default function App() {
  const [session, setSession] = useState(undefined);
  const [tab, setTab] = useState("feed");
  const [draft, setDraft] = useState(null);
  const [menu, setMenu] = useState(false);
  const [items, setItems] = useState([]);
  const [looks, setLooks] = useState([]);
  const [settings, setSettings] = useState({ city: "", lat: null, lon: null, cityLabel: "" });
  const [ready, setReady] = useState(false);
  const [weather, setWeather] = useState(null);
  const [toast, setToast] = useState("");

  const uid = session?.user?.id;
  const [ar, setAr] = useState({});
  const arRef = useRef({});
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

  /* пропорции картинок нужны, чтобы коллаж заполнял холст без пустот */
  useEffect(() => {
    const missing = items.filter((i) => !(i.id in arRef.current) && i.img);
    if (!missing.length) return;
    let alive = true;
    Promise.all(missing.map((i) => new Promise((res) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => res([i.id, im.naturalHeight / im.naturalWidth]);
      im.onerror = () => res([i.id, 1.2]);
      im.src = i.img;
    }))).then((pairs) => {
      if (!alive) return;
      arRef.current = { ...arRef.current, ...Object.fromEntries(pairs) };
      setAr(arRef.current);
    });
    return () => { alive = false; };
  }, [items]);

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
    <div style={{ minHeight: "100vh", background: C.paper, display: "grid", placeItems: "center", ...S.display, color: C.ink }}>{text}</div>
  );
  if (session === undefined) return screen("…");
  if (!session) return <Auth />;
  if (!ready) return screen("Открываем гардероб…");

  const openInStudio = (look) => { setDraft({ ...look, id: "look_" + Date.now() }); setTab("studio"); };

  const TABS = [
    { id: "feed", ru: "Подборка" },
    { id: "studio", ru: "Студия" },
    { id: "wardrobe", ru: "Гардероб" },
    { id: "capsules", ru: "Капсулы" },
    { id: "insights", ru: "Аналитика" },
    { id: "wish", ru: "Желания" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.paper, color: C.ink, fontFamily: FONT }}>
      <header style={{ borderBottom: `1px solid ${C.line}`, padding: "14px 16px", position: "sticky", top: 0, background: C.paper, zIndex: 40 }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <button onClick={() => setTab("about")} title="О проекте"
            style={{ ...S.display, fontSize: 19, background: "none", border: "none", cursor: "pointer", color: C.ink, padding: 0 }}>
            Гардероб
          </button>
          <nav style={{ display: "flex", gap: 4, alignItems: "center", overflowX: "auto" }} className="hide-scroll">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                ...S.label, padding: "8px 10px", cursor: "pointer", background: "none", border: "none",
                color: tab === t.id ? C.ink : C.ink60,
                borderBottom: `2px solid ${tab === t.id ? C.olive : "transparent"}`,
              }}>{t.ru}</button>
            ))}
            <button onClick={() => setMenu(true)} aria-label="Меню пользователя"
              style={{
                width: 30, height: 30, borderRadius: "50%", cursor: "pointer", marginLeft: 8, flex: "0 0 auto",
                border: `1px solid ${C.line}`, background: C.card, color: C.ink, fontSize: 12, fontWeight: 600, fontFamily: FONT,
              }}>{(session.user.email || "?")[0].toUpperCase()}</button>
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 16px 90px" }}>
        {tab === "about" && <About items={items} looks={looks} ar={ar} onStart={setTab} />}
        {tab === "feed" && (
          <Feed items={items} itemsById={itemsById} ar={ar} looks={looks} saveLooks={saveLooks}
            markWorn={markWorn} say={say} openInStudio={openInStudio} suggestedSeason={suggestedSeason} />
        )}
        {tab === "studio" && (
          <Studio draft={draft} items={items} itemsById={itemsById} ar={ar} looks={looks} saveLooks={saveLooks}
            weather={weather} suggestedSeason={suggestedSeason} settings={settings}
            saveSettings={saveSettings} say={say} markWorn={markWorn} />
        )}
        {tab === "wardrobe" && (
          <Wardrobe items={items} ar={ar} addItems={addItems} updateItem={updateItem}
            removeItem={removeItem} say={say} wipeAll={wipeAll} />
        )}
        {tab === "capsules" && (
          <Capsules looks={looks} itemsById={itemsById} ar={ar} saveLooks={saveLooks} markWorn={markWorn} say={say} />
        )}
        {tab === "insights" && <Insights items={items} looks={looks} />}
        {tab === "wish" && (
          <Wishlist items={items} ar={ar} addItems={addItems} updateItem={updateItem} removeItem={removeItem} say={say} />
        )}
      </main>

      {menu && (
        <UserPanel email={session.user.email} items={items} looks={looks} onClose={() => setMenu(false)} />
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)",
          background: C.ink, color: C.paper, padding: "10px 18px", borderRadius: 2, fontSize: 12, zIndex: 100, maxWidth: "90vw", textAlign: "center" }}>
          {toast}
        </div>
      )}
      <style>{`.hide-scroll::-webkit-scrollbar{display:none}
        .hero-grid{display:grid;gap:26px;align-items:center}
        @media (min-width: 900px){ .hero-grid{grid-template-columns:1.35fr 0.65fr} }
        .studio-grid{display:grid;gap:14px;align-items:start}
        @media (min-width: 900px){
          .studio-grid{grid-template-columns:minmax(0,1fr) 280px;height:min(74vh,700px)}
          .studio-grid > *{height:100%;min-height:0;overflow:hidden}
          .studio-grid > aside{overflow:hidden}
        }
        @media (max-width: 899px){
          .studio-grid > aside{max-height:320px}
        }
        .panel-scroll::-webkit-scrollbar{width:6px}
        .panel-scroll::-webkit-scrollbar-thumb{background:#CFC5B2;border-radius:3px}
        input,select,textarea{font-family:inherit}
        *{box-sizing:border-box}
        body{margin:0}`}</style>
    </div>
  );
}

/* ─────────────────────────  ПОДБОРКА  ───────────────────────── */
function Feed({ items, itemsById, ar, looks, saveLooks, markWorn, say, openInStudio, suggestedSeason }) {
  const [season, setSeason] = useState("any");
  const [occasion, setOccasion] = useState("daily");
  const [variants, setVariants] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (suggestedSeason && season === "any") setSeason(suggestedSeason); }, [suggestedSeason]);

  const makeBatch = useCallback((n = 9) => {
    const out = [];
    const usedExtras = [];
    for (let k = 0; k < n * 8 && out.length < n; k++) {
      const l = buildLook(items, { season, occasion, pinned: null, tpl: "classic", avoid: usedExtras, ar });
      if (!l) break;
      const key = l.placed.map((p) => p.itemId).sort().join("|");
      if (out.some((o) => o.placed.map((p) => p.itemId).sort().join("|") === key)) continue;
      l.placed.forEach((p) => {
        const it = itemsById[p.itemId];
        if (it && (it.category === "accessory" || it.category === "jewelry")) usedExtras.push(it.id);
      });
      out.push({ ...l, placed: fitPlaced(l.placed, itemsById, ar) });
    }
    return out;
  }, [items, itemsById, ar, season, occasion]);

  /* подборка собирается сама при открытии и при смене условий */
  useEffect(() => {
    if (items.length < 3) { setVariants([]); return; }
    setBusy(true);
    const t = setTimeout(() => { setVariants(makeBatch(9)); setBusy(false); }, 10);
    return () => clearTimeout(t);
  }, [makeBatch, items.length]);

  const replaceOne = (idx) => {
    const used = variants.flatMap((v) => v.placed.map((p) => p.itemId));
    const l = buildLook(items, { season, occasion, pinned: null, tpl: "classic", avoid: used, ar });
    if (l) setVariants((prev) => prev.map((v, i) =>
      (i === idx ? { ...l, placed: fitPlaced(l.placed, itemsById, ar) } : v)));
  };

  const keep = async (look) => {
    const name = look.name || `Капсула ${looks.length + 1}`;
    await saveLooks([{ ...look, name }, ...looks]);
    say("Сохранено в капсулы");
  };

  if (items.length < 3)
    return (
      <div style={{ border: `1px dashed ${C.line}`, padding: 40, textAlign: "center", color: C.ink60, fontSize: 13, lineHeight: 1.6 }}>
        Для подборки нужно хотя бы три вещи — верх, низ и обувь.<br />Загрузи их на вкладке «Гардероб».
      </div>
    );

  return (
    <Section eyebrow="Собрано для тебя" title="Подборка"
      right={<Btn variant="ghost" onClick={() => setVariants(makeBatch(9))}>Обновить</Btn>}>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 10 }} className="hide-scroll">
        <Chip active={season === "any"} onClick={() => setSeason("any")}>Любой сезон</Chip>
        {SEASONS.map((s) => (
          <Chip key={s.id} active={season === s.id} onClick={() => setSeason(s.id)}>{s.ru}</Chip>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 18 }} className="hide-scroll">
        {OCCASIONS.map((o) => (
          <Chip key={o.id} active={occasion === o.id} onClick={() => setOccasion(o.id)}>{o.ru}</Chip>
        ))}
      </div>

      {busy && <div style={{ fontSize: 13, color: C.ink60, marginBottom: 12 }}>Собираю варианты…</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 12 }}>
        {variants.map((l, idx) => {
          const its = l.placed.map((p) => itemsById[p.itemId]).filter(Boolean);
          const pal = its.length ? lookPalette(its) : [];
          return (
            <div key={l.id} style={{ border: `1px solid ${C.line}`, background: C.card }}>
              <div onClick={() => openInStudio(l)}
                style={{ position: "relative", paddingTop: "125%", background: C.paper, overflow: "hidden", cursor: "pointer" }}>
                {l.placed.map((p, i) => {
                  const it = itemsById[p.itemId];
                  if (!it) return null;
                  return <img key={i} src={it.img} alt="" style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, transform: `rotate(${p.rot || 0}deg)`, zIndex: p.z }} />;
                })}
              </div>
              <div style={{ padding: 10 }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                  {pal.map((hex) => (
                    <div key={hex} title={colorName(hex)} style={{ width: 18, height: 18, background: hex, border: `1px solid ${C.line}` }} />
                  ))}
                  <div style={{ ...S.label, marginLeft: "auto", alignSelf: "center" }}>
                    {pal.map(colorName).join(" · ")}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Btn size="sm" onClick={() => keep(l)}>Сохранить</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => replaceOne(idx)}>Другой</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => openInStudio(l)}>Править</Btn>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ─────────────────────────  СТУДИЯ  ───────────────────────── */
function Studio({ draft, items, itemsById, ar, looks, saveLooks, weather, suggestedSeason, settings, saveSettings, say, markWorn }) {
  const [season, setSeason] = useState("any");
  const [occasion, setOccasion] = useState("daily");
  const [tpl, setTpl] = useState("classic");
  const [pinned, setPinned] = useState(null);
  const [look, setLook] = useState(null);
  const [sel, setSel] = useState(null);
  const [cityInput, setCityInput] = useState(settings.city || "");
  const [manual, setManual] = useState(false);

  useEffect(() => { if (suggestedSeason && season === "any") setSeason(suggestedSeason); }, [suggestedSeason]);
  useEffect(() => { if (draft) { setLook(draft); setSel(null); setManual(false); } }, [draft]);

  const gen = () => {
    const l = buildLook(items, { season, occasion, pinned, tpl, ar });
    if (!l) return say("Не хватает вещей — добавь хотя бы верх, низ и обувь");
    setLook({ ...l, placed: fitPlaced(l.placed, itemsById, ar) });
    setSel(null); setManual(false);
  };

  const genAll = () => {
    const pool = items.filter((i) => !i.isWish);
    const covered = new Set();
    const out = [];
    for (let n = 0; n < 40 && out.length < 12; n++) {
      const uncovered = pool.filter((i) => !covered.has(i.id) && ["top", "bottom", "dress", "outerwear"].includes(i.category));
      const anchor = uncovered.length ? uncovered[0].id : null;
      const l = buildLook(pool, { season, occasion, pinned: anchor, tpl, ar });
      if (!l) break;
      const key = l.placed.map((p) => p.itemId).sort().join("|");
      if (out.some((o) => o.placed.map((p) => p.itemId).sort().join("|") === key)) continue;
      l.placed.forEach((p) => covered.add(p.itemId));
      l.name = `Капсула ${out.length + 1}`;
      out.push({ ...l, placed: fitPlaced(l.placed, itemsById, ar) });
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
    const p = layout([item], look.tpl, ar)[0];
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
              <div style={{ ...S.display, fontSize: 22, marginTop: 2 }}>
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
        <div className="studio-grid">
          <Canvas
            look={look} setLook={setLook} itemsById={itemsById} items={items}
            sel={sel} setSel={setSel} onSwap={swap}
            manual={manual} onSave={save} onRegen={gen}
            onExport={() => exportPng(look, itemsById, look.name || "Капсула")}
            onWorn={() => markWorn(look)}
          />
          <ItemsPanel items={items} ar={ar} onPick={addToLook} pinned={pinned} onPin={setPinned} />
        </div>
      )}

      {!look && items.length > 0 && (
        <div style={{ border: `1px dashed ${C.line}`, padding: 48, textAlign: "center", color: C.ink60, fontSize: 13, lineHeight: 1.6 }}>
          Нажми «Собрать капсулу» — образ появится здесь.<br />
          Гардероб для ручной сборки откроется рядом с холстом.
        </div>
      )}
      {items.length === 0 && (
        <div style={{ border: `1px dashed ${C.line}`, padding: 40, textAlign: "center", color: C.ink60, fontSize: 13 }}>
          Гардероб пуст. Загрузи первые фото на вкладке «Гардероб».
        </div>
      )}

    </>
  );
}

/* ─────────────────────────  ПАНЕЛЬ ВЕЩЕЙ  ───────────────────────── */
/* Миниатюры в одном масштабе: обувь не должна занимать столько же места,
   сколько брюки. Доля высоты карточки берётся из площади категории. */

const PANEL_ORDER = ["shoes", "top", "shirt", "pants", "skirt", "shorts", "sweats", "bottom",
  "dress", "blazer", "outerwear", "bag", "belt", "accessory", "jewelry"];

function ItemsPanel({ items, ar, onPick, pinned, onPin, title = "Добавить вещь" }) {
  const [q, setQ] = useState("");
  const pool = items.filter((i) => !i.isWish)
    .filter((i) => !q || (i.name || catRu(i.category)).toLowerCase().includes(q.toLowerCase()));

  const groups = PANEL_ORDER
    .map((c) => ({ cat: c, list: pool.filter((i) => i.category === c).sort(byColor) }))
    .filter((g) => g.list.length);

  return (
    <aside style={{ border: `1px solid ${C.line}`, background: C.card, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: 12, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ ...S.label, marginBottom: 8 }}>{title}</div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="поиск"
          style={{ width: "100%", border: `1px solid ${C.line}`, background: C.paper, padding: "7px 9px", fontSize: 12, borderRadius: 2, color: C.ink }} />
      </div>
      <div className="panel-scroll" style={{ overflowY: "auto", padding: 12, flex: 1 }}>
        {groups.map((g) => (
          <div key={g.cat} style={{ marginBottom: 16 }}>
            <div style={{ ...S.label, fontSize: 9, marginBottom: 8, position: "sticky", top: -12, background: C.card, padding: "4px 0" }}>
              {catRu(g.cat)} · {g.list.length}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(58px,1fr))", gap: 6 }}>
              {g.list.map((i) => (
                <button key={i.id} title={i.name || catRu(i.category)}
                  onClick={() => onPick(i)}
                  onContextMenu={(e) => { if (onPin) { e.preventDefault(); onPin(i.id); } }}
                  style={{
                    background: C.paper, cursor: "pointer", padding: 3, borderRadius: 2,
                    border: `1px solid ${pinned === i.id ? C.olive : C.line}`,
                    boxShadow: `inset 0 -3px 0 ${i.colors?.[0] || C.line}`,
                  }}>
                  <Thumb item={i} ar={ar} fill={0.92} />
                </button>
              ))}
            </div>
          </div>
        ))}
        {!groups.length && <div style={{ fontSize: 12, color: C.ink60 }}>Ничего не найдено</div>}
      </div>
    </aside>
  );
}

/* ─────────────────────────  ХОЛСТ  ───────────────────────── */
function Canvas({ look, setLook, itemsById, items, sel, setSel, onSwap, manual, onSave, onRegen, onExport, onWorn }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const lookItems = look.placed.map((p) => itemsById[p.itemId]).filter(Boolean);
  const pal = lookItems.length ? lookPalette(lookItems) : [];

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
    <div style={{ border: `1px solid ${C.line}`, background: C.card, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* палитра-плашки */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", padding: 14, borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
        {pal.map((hex) => (
          <div key={hex} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 34, height: 34, background: hex, border: `1px solid ${C.line}` }} />
            <div>
              <div style={{ ...S.label, fontSize: 9 }}>{hex.toUpperCase()}</div>
              <div style={{ ...S.display, fontSize: 13 }}>{colorName(hex)}</div>
            </div>
          </div>
        ))}
        <input value={look.name} onChange={(e) => setLook({ ...look, name: e.target.value })}
          placeholder="Назови капсулу"
          style={{ marginLeft: "auto", border: "none", borderBottom: `1px solid ${C.line}`, background: "transparent", ...S.display, fontSize: 16, padding: "4px 2px", color: C.ink, minWidth: 130 }} />
      </div>

      {/* холст */}
      <div ref={ref} onClick={(e) => { if (e.target === ref.current) setSel(null); }}
        style={{ position: "relative", flex: 1, minHeight: 0, width: "100%", maxWidth: "min(100%, 46vh)", aspectRatio: "4 / 5", margin: "0 auto", background: C.paper, overflow: "hidden", touchAction: "none" }}>
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
          <Btn size="sm" variant="ghost" onClick={() => patch("z", Math.max(...look.placed.map((p) => p.z)) + 1)}>Вперёд</Btn>
          <Btn size="sm" variant="ghost" onClick={() => onSwap(sel)}>Заменить</Btn>
          <Btn size="sm" variant="ghost" onClick={del} style={{ color: C.rust, borderColor: C.rust }}>Убрать</Btn>
        </div>
      )}

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
function Wardrobe({ items, ar, addItems, updateItem, removeItem, say, wishMode = false, wipeAll }) {
  const [busy, setBusy] = useState(0);
  const [queue, setQueue] = useState([]);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("color");
  const [open, setOpen] = useState(null);
  const fileRef = useRef();

  const onFiles = async (files) => {
    const arr = [...files].filter((f) => f.type.startsWith("image/"));
    if (!arr.length) return;
    setBusy(arr.length);
    const out = [];
    for (const f of arr) {
      try {
        const { blob, dataUrl, colors, guess } = await processFile(f, 25);
        out.push({
          id: "it_" + Date.now() + "_" + Math.floor(Math.random() * 1e5),
          name: "", category: guess, img: dataUrl, blob, colors, file: f, tol: 25,
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
    .filter((i) => filter === "all" || i.category === filter)
    .sort((a, b) => {
      if (sort === "color") return byColor(a, b);
      if (sort === "wear") return (b.wear || 0) - (a.wear || 0);
      if (sort === "cat") {
        const ci = (x) => PANEL_ORDER.indexOf(x.category);
        return ci(a) - ci(b) || byColor(a, b);
      }
      return 0;
    });

  return (
    <>
      <Section eyebrow={wishMode ? "Список желаний" : "Мои вещи"} title={wishMode ? "Хочу купить" : `Гардероб · ${shown.length}`}
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {busy > 0 && <span style={{ ...S.label, fontSize: 9 }}>обрабатываю · {busy}</span>}
            {!wishMode && wipeAll && items.length > 0 && (
              <Btn size="sm" variant="ghost" style={{ color: C.rust, borderColor: C.rust }}
                onClick={() => window.confirm("Удалить все вещи и капсулы?") && wipeAll()}>Очистить</Btn>
            )}
            <Btn onClick={() => fileRef.current.click()}>Загрузить фото</Btn>
          </div>
        }>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
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

        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 10 }} className="hide-scroll">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>Все</Chip>
          {CATS.map((c) => <Chip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>{c.ru}</Chip>)}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 14, overflowX: "auto" }} className="hide-scroll">
          <span style={{ ...S.label, fontSize: 9 }}>порядок</span>
          <Chip active={sort === "color"} onClick={() => setSort("color")}>По цвету</Chip>
          <Chip active={sort === "cat"} onClick={() => setSort("cat")}>По категориям</Chip>
          <Chip active={sort === "wear"} onClick={() => setSort("wear")}>По носке</Chip>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10, alignItems: "start" }}>
          {shown.map((i) => (
            <div key={i.id} onClick={() => setOpen(open === i.id ? null : i.id)}
              style={{ border: `1px solid ${open === i.id ? C.ink : C.line}`, background: C.card,
                       padding: 8, cursor: "pointer", position: "relative" }}>
              <Thumb item={i} ar={ar} h={150} />
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
                <div onClick={(e) => e.stopPropagation()} style={{
                  position: "absolute", left: -1, right: -1, top: "100%", zIndex: 30,
                  border: `1px solid ${C.ink}`, borderTop: "none", background: C.card,
                  padding: 12, boxShadow: "0 12px 28px rgba(28,30,34,.14)", minWidth: 190,
                }}>
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
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    <Btn size="sm" variant="ghost" style={{ flex: "1 1 auto", whiteSpace: "nowrap" }}
                      onClick={() => updateItem(i.id, { fav: !i.fav })}>{i.fav ? "★ любимая" : "☆ в любимые"}</Btn>
                    {wishMode && <Btn size="sm" variant="olive" onClick={() => updateItem(i.id, { isWish: false })}>Купила</Btn>}
                    <Btn size="sm" variant="ghost" style={{ color: C.rust, borderColor: C.rust, whiteSpace: "nowrap" }}
                      onClick={() => removeItem(i.id)}>Удалить</Btn>
                  </div>
                  <div style={{ marginTop: 8, textAlign: "right" }}>
                    <button onClick={() => setOpen(null)} style={{ ...S.label, fontSize: 9, background: "none", border: "none", cursor: "pointer", color: C.ink60 }}>
                      закрыть
                    </button>
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
                  <div style={{ ...S.display, fontSize: 15 }}>{w.name || catRu(w.category)}</div>
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
function Capsules({ looks, itemsById, ar, saveLooks, markWorn, say }) {
  const [open, setOpen] = useState(null);
  if (!looks.length)
    return <div style={{ border: `1px dashed ${C.line}`, padding: 40, textAlign: "center", color: C.ink60, fontSize: 13 }}>
      Сохранённых капсул пока нет. Собери первую в студии.
    </div>;

  return (
    <Section eyebrow="Сохранённое" title={`Капсулы · ${looks.length}`}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 }}>
        {looks.map((raw) => {
          const l = { ...raw, placed: fitPlaced(raw.placed, itemsById, ar) };
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
                <div style={{ ...S.display, fontSize: 16 }}>{l.name || "Без названия"}</div>
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
const FAM_RU = { light: "Светлые", neutral: "Нейтральные", brown: "Коричневые", dark: "Тёмные",
  red: "Красные", gold: "Жёлтые и охра", green: "Зелёные", blue: "Синие", purple: "Фиолетовые" };

function Bar({ label, value, max, note, tone = C.olive }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ color: C.ink60 }}>{note ?? value}</span>
      </div>
      <div style={{ height: 6, background: C.paper2, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: tone }} />
      </div>
    </div>
  );
}

function Insights({ items, looks }) {
  const real = items.filter((i) => !i.isWish);
  const stats = useMemo(() => {
    const by = (c) => real.filter((i) => i.category === c);
    const inSeason = (i, s) => !i.seasons?.length || i.seasons.includes(s);

    /* сколько образов вообще складывается и сколько из них удачные */
    const combos = {};
    SEASONS.forEach((s) => {
      const tops = real.filter((i) => TOPS.includes(i.category) && inSeason(i, s.id));
      const bottoms = real.filter((i) => BOTTOMS.includes(i.category) && inSeason(i, s.id));
      const shoes = by("shoes").filter((i) => inSeason(i, s.id));
      combos[s.id] = { total: tops.length * bottoms.length * shoes.length, tops: tops.length, bottoms: bottoms.length, shoes: shoes.length };
    });

    /* доля сочетаний, которые проходят проверку по цвету и формальности */
    const tops = real.filter((i) => TOPS.includes(i.category));
    const bottoms = real.filter((i) => BOTTOMS.includes(i.category));
    const shoes = by("shoes");
    let good = 0, tried = 0;
    if (tops.length && bottoms.length && shoes.length) {
      for (let n = 0; n < 400; n++) {
        const trio = [tops[(Math.random() * tops.length) | 0], bottoms[(Math.random() * bottoms.length) | 0], shoes[(Math.random() * shoes.length) | 0]];
        tried++;
        if (scoreLook(trio) >= 85) good++;
      }
    }
    const harmony = tried ? good / tried : 0;
    const totalCombos = tops.length * bottoms.length * shoes.length;

    /* палитра гардероба */
    const fams = {};
    real.forEach((i) => { const f = family(i.colors?.[0] || "#888"); fams[f] = (fams[f] || 0) + 1; });
    const accent = real.filter((i) => !isNeutralFam(family(i.colors?.[0] || "#888"))).length;

    /* покрытие сезонов по ключевым ролям */
    const cover = SEASONS.map((s) => ({
      s,
      top: real.filter((i) => TOPS.includes(i.category) && inSeason(i, s.id)).length,
      bottom: real.filter((i) => BOTTOMS.includes(i.category) && inSeason(i, s.id)).length,
      shoes: by("shoes").filter((i) => inSeason(i, s.id)).length,
      outer: real.filter((i) => ["outerwear", "blazer"].includes(i.category) && inSeason(i, s.id)).length,
    }));

    const inLooks = new Set(looks.flatMap((l) => l.placed.map((p) => p.itemId)));
    const dead = real.filter((i) => !(i.wear > 0) && !inLooks.has(i.id));
    const untagged = real.filter((i) => !i.seasons?.length);
    const worn = real.filter((i) => i.wear > 0);
    const avgForm = real.length ? real.reduce((a, b) => a + (b.formality || 2), 0) / real.length : 0;

    return { by, combos, harmony, totalCombos, fams, accent, cover, dead, untagged, worn, avgForm, tops, bottoms, shoes };
  }, [items, looks]);

  const { by, combos, harmony, totalCombos, fams, accent, cover, dead, untagged, worn, avgForm } = stats;

  /* содержательные выводы, а не просто «не хватает сумки» */
  const advice = [];
  const need = (cat, min, why) => {
    const n = by(cat).length;
    if (n < min) advice.push({ t: `${catRu(cat)}: ${n} из ${min}`, d: why });
  };
  const roleCount = (list) => real.filter((i) => list.includes(i.category)).length;
  if (roleCount(TOPS) < 5) advice.push({ t: `Верх: ${roleCount(TOPS)} из 5`, d: "Верх меняется чаще всего — на нём держится разнообразие образов." });
  if (roleCount(BOTTOMS) < 3) advice.push({ t: `Низ: ${roleCount(BOTTOMS)} из 3`, d: "Каждый новый низ умножает количество образов, а не прибавляет." });
  need("shoes", 2, "Одна пара обуви делает все образы похожими друг на друга.");
  if (roleCount(["outerwear", "blazer"]) < 1) advice.push({ t: "Верхней одежды нет", d: "Без неё половина года выпадает из гардероба." });

  if (real.length >= 6) {
    const share = accent / real.length;
    if (share === 0) advice.push({ t: "Гардероб полностью нейтральный", d: "Всё сочетается со всем, но образы получаются плоскими. Одна цветная вещь оживит подборку." });
    else if (share > 0.6) advice.push({ t: "Ярких вещей больше половины", d: "Не хватает нейтральной базы-связки: цветное плохо сочетается с цветным, и алгоритм отбраковывает такие пары." });
  }
  const allBottoms = real.filter((i) => BOTTOMS.includes(i.category));
  const lightBottoms = allBottoms.filter((i) => ["light", "neutral"].includes(family(i.colors?.[0] || "#888")));
  if (allBottoms.length >= 2 && !lightBottoms.length)
    advice.push({ t: "Все низы тёмные", d: "Светлые брюки или юбка дадут второй вариант основы и заметно расширят палитру." });

  cover.forEach((c) => {
    const holes = [];
    if (!c.top) holes.push("верха");
    if (!c.bottom) holes.push("низа");
    if (!c.shoes) holes.push("обуви");
    if (holes.length) advice.push({ t: `${c.s.ru}: нет ${holes.join(", ")}`, d: "Для этого сезона образ не соберётся вообще." });
    else if (Math.min(c.top, c.bottom, c.shoes) === 1)
      advice.push({ t: `${c.s.ru}: всё держится на одной вещи`, d: `Верхов ${c.top}, низов ${c.bottom}, пар обуви ${c.shoes} — образы будут повторяться.` });
  });

  if (harmony > 0 && harmony < 0.35)
    advice.push({ t: `Сочетается только ${Math.round(harmony * 100)}% комбинаций`, d: "Вещи плохо дружат между собой по цвету или сильно расходятся по формальности. Проверь, верно ли проставлена формальность в карточках." });
  if (untagged.length)
    advice.push({ t: `Без сезона: ${untagged.length}`, d: "Такие вещи попадают в любой образ, включая неподходящие по погоде. Проставь сезоны в карточках." });

  const days = [...new Set(looks.flatMap((l) => l.wornDates || []))].sort().slice(-21);
  const topWorn = [...real].sort((a, b) => (b.wear || 0) - (a.wear || 0)).slice(0, 6);
  const maxCat = Math.max(1, ...CATS.map((c) => by(c.id).length));
  const maxFam = Math.max(1, ...Object.values(fams));

  if (!real.length)
    return <div style={{ border: `1px dashed ${C.line}`, padding: 40, textAlign: "center", color: C.ink60, fontSize: 13 }}>
      Гардероб пуст — считать пока нечего.
    </div>;

  const Num = ({ v, t }) => (
    <div style={{ border: `1px solid ${C.line}`, background: C.card, padding: 14 }}>
      <div style={{ ...S.display, fontSize: 28, lineHeight: 1.1 }}>{v}</div>
      <div style={{ ...S.label, fontSize: 9, marginTop: 6 }}>{t}</div>
    </div>
  );

  return (
    <>
      <Section eyebrow="Коротко" title="Гардероб в цифрах">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
          <Num v={real.length} t="вещей" />
          <Num v={totalCombos} t="возможных образов" />
          <Num v={Math.round(harmony * totalCombos)} t="из них удачных" />
          <Num v={`${Math.round((worn.length / real.length) * 100)}%`} t="вещей в деле" />
          <Num v={avgForm.toFixed(1)} t="средняя формальность" />
        </div>
        <div style={{ fontSize: 12, color: C.ink60, marginTop: 12, lineHeight: 1.6 }}>
          «Возможных образов» — все сочетания верха, низа и обуви. «Удачных» — те, что проходят проверку
          по цвету и формальности: сейчас это {Math.round(harmony * 100)}% сочетаний.
          Одна новая вещь-основа даёт не плюс один образ, а умножает их количество.
        </div>
      </Section>

      <Section eyebrow="Что нужно докупить" title={`Выводы · ${advice.length}`}>
        {advice.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {advice.map((g, i) => (
              <div key={i} style={{ border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.rust}`, background: C.card, padding: 12 }}>
                <div style={{ ...S.display, fontSize: 15 }}>{g.t}</div>
                <div style={{ fontSize: 12, color: C.ink60, marginTop: 4, lineHeight: 1.5 }}>{g.d}</div>
              </div>
            ))}
          </div>
        ) : <div style={{ fontSize: 13, color: C.ink60 }}>Дыр не видно — база собрана, сезоны закрыты, цвета сбалансированы.</div>}
      </Section>

      <Section eyebrow="Состав" title="По категориям и цветам">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 24 }}>
          <div>
            <div style={{ ...S.label, marginBottom: 10 }}>Категории</div>
            {CATS.filter((c) => by(c.id).length).map((c) => (
              <Bar key={c.id} label={c.ru} value={by(c.id).length} max={maxCat} />
            ))}
          </div>
          <div>
            <div style={{ ...S.label, marginBottom: 10 }}>Палитра</div>
            {Object.entries(fams).sort((a, b) => b[1] - a[1]).map(([f, n]) => (
              <Bar key={f} label={FAM_RU[f] || f} value={n} max={maxFam}
                tone={isNeutralFam(f) ? C.chestnut : C.olive} />
            ))}
            <div style={{ fontSize: 12, color: C.ink60, marginTop: 8, lineHeight: 1.5 }}>
              Нейтральных {real.length - accent}, акцентных {accent}. Рабочая пропорция — примерно двое нейтральных на одну цветную.
            </div>
          </div>
        </div>
      </Section>

      <Section eyebrow="По сезонам" title="Что можно собрать">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
          {cover.map((c) => (
            <div key={c.s.id} style={{ border: `1px solid ${C.line}`, background: C.card, padding: 14 }}>
              <div style={{ ...S.display, fontSize: 17, marginBottom: 2 }}>{c.s.ru}</div>
              <div style={{ ...S.label, fontSize: 9, marginBottom: 10 }}>
                образов: {combos[c.s.id].total}
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.9, color: C.ink60 }}>
                верх — {c.top}<br />низ — {c.bottom}<br />обувь — {c.shoes}<br />верхняя одежда — {c.outer}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Что носится" title="Календарь и счётчик">
        {days.length ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
            {days.map((d) => (
              <div key={d} style={{ border: `1px solid ${C.line}`, background: C.card, padding: "6px 10px", fontSize: 11 }}>
                {d.slice(8)}.{d.slice(5, 7)}
              </div>
            ))}
          </div>
        ) : <div style={{ fontSize: 13, color: C.ink60, marginBottom: 18 }}>Отмечай «Носила» — здесь появится история, а выводы станут точнее.</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 10 }}>
          {topWorn.map((i) => (
            <div key={i.id} style={{ border: `1px solid ${C.line}`, background: C.card, padding: 8 }}>
              <div style={{ aspectRatio: "1", display: "grid", placeItems: "center" }}>
                <img src={i.img} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              </div>
              <div style={{ ...S.label, marginTop: 6 }}>носила {i.wear || 0}</div>
              {i.lastWorn && <div style={{ fontSize: 10, color: C.ink60 }}>{i.lastWorn}</div>}
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Мёртвый груз" title={`Не используется · ${dead.length}`}>
        {dead.length ? (
          <>
            <div style={{ fontSize: 12, color: C.ink60, marginBottom: 12, lineHeight: 1.5 }}>
              Эти вещи ни разу не попали ни в один сохранённый образ. Часто причина не в самой вещи,
              а в том, что к ней нечего надеть — посмотри на её цвет и формальность.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 10 }}>
              {dead.sort(byColor).map((i) => (
                <div key={i.id} style={{ border: `1px solid ${C.line}`, background: C.card, padding: 8, opacity: 0.8 }}>
                  <div style={{ aspectRatio: "1", display: "grid", placeItems: "center" }}>
                    <img src={i.img} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                  </div>
                  <div style={{ ...S.label, marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {i.name || catRu(i.category)}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : <div style={{ fontSize: 13, color: C.ink60 }}>Все вещи в деле.</div>}
      </Section>
    </>
  );
}
