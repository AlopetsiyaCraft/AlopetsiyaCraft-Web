/**
 * Рендер иконок предметов — как в инвентаре игры.
 *
 * Плоские предметы (item/generated) — это квад со слоями layer0, layer1…,
 * ровно как их рисует игра. У блоков плоской иконки нет вообще: игра берёт
 * геометрию модели и рисует её в изометрии по display.gui (у ванильного
 * block/block это поворот [30,225,0] и масштаб 0.625). Поэтому здесь
 * маленький программный растеризатор:
 *
 *  - координаты и порядок углов граней — как в FaceInfo/BlockElement игры;
 *  - UV — по uvsByFace и BlockFaceUV#uv (вместе с поворотом грани);
 *  - поворот элемента вокруг оси и общий поворот модели — как в FaceBakery;
 *  - затенение граней — константы Minecraft (низ 0.5, верх 1.0, север/юг 0.8,
 *    запад/восток 0.6), плюс грань без shade рисуется в полный свет.
 *
 * Результат кэшируется в data/icons/<ключ>.png.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import sharp from "sharp";
import {
  DEFAULT_BLOCK_TRANSFORM,
  resolveModel,
  resolveTextureRef,
  type ModelElement,
  type ResolvedModel,
} from "@/lib/mcModel";
import { getTextureByRef, getModFile, type TexturePixels } from "@/lib/mcTextures";
import { spawnEggColors } from "@/lib/spawnEggs";
import { resolveDeckImage } from "@/lib/mcDecks";

const ICON_DIR = join(process.cwd(), "data", "icons");

/** Размер иконки в пикселях. */
const ICON_SIZE = 64;

/** Затенение граней — константы рендерера Minecraft. */
const FACE_SHADE: Record<string, number> = {
  down: 0.5,
  up: 1.0,
  north: 0.8,
  south: 0.8,
  west: 0.6,
  east: 0.6,
};

/** Cutout-порог альфы в игре — 0.1. */
const ALPHA_CUTOUT = 26;

// ---------- матрицы ----------
//
// Храним построчно (m[r * 4 + c]), как в Matrix4f из JOML: элемент (r, c) —
// это m[r * 4 + c], а точка transform' = M · transform. Сдвиг поэтому стоит
// в последней строке, а не в последнем столбце.

type Mat4 = number[];

const matIdentity = (): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Произведение a · b: сначала применяется b, потом a. */
function matMul(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16).fill(0);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[r * 4 + k]! * b[k * 4 + c]!;
      out[r * 4 + c] = sum;
    }
  }
  return out;
}

const matTranslate = (x: number, y: number, z: number): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];

const matScale = (x: number, y: number, z: number): Mat4 => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];

/** Поворот вокруг X по правилу правой руки — как Axis.XP в JOML. */
function matRotX(deg: number): Mat4 {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1];
}

/** Поворот вокруг Y по правилу правой руки — как Axis.YP в JOML. */
function matRotY(deg: number): Mat4 {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1];
}

/** Поворот вокруг Z по правилу правой руки — как Axis.ZP в JOML. */
function matRotZ(deg: number): Mat4 {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

type Vec3 = [number, number, number];

/**
 * rotationXYZ как в JOML (Quaternionf#rotationXYZ). Там это
 * rotationX(x).rotateY(y).rotateZ(z), то есть произведение Rx·Ry·Rz, и
 * первым к точке применяется Z. Для ванильного блока [30, 225, 0] именно
 * такой порядок даёт игровую картинку: сверху видна верхняя грань, а не нижняя.
 */
function matRotXYZ(rx: number, ry: number, rz: number): Mat4 {
  return matMul(matRotX(rx), matMul(matRotY(ry), matRotZ(rz)));
}

function applyPoint(m: Mat4, p: Vec3): Vec3 {
  const [x, y, z] = p;
  return [
    m[0]! * x + m[1]! * y + m[2]! * z + m[3]!,
    m[4]! * x + m[5]! * y + m[6]! * z + m[7]!,
    m[8]! * x + m[9]! * y + m[10]! * z + m[11]!,
  ];
}

/** Нормаль поворачиваем только линейной частью (без сдвига). */
function applyDir(m: Mat4, p: Vec3): Vec3 {
  const [x, y, z] = p;
  return [m[0]! * x + m[1]! * y + m[2]! * z, m[4]! * x + m[5]! * y + m[6]! * z, m[8]! * x + m[9]! * y + m[10]! * z];
}

// ---------- текстура ----------

export interface RgbaImage {
  width: number;
  height: number;
  /** RGBA, длина = width * height * 4. */
  data: Buffer;
}

/** Пиксель текстуры с билинейной выборкой по UV в координатах 0..16. */
function sampleTexture(tex: TexturePixels, u: number, v: number, tint: number | null): [number, number, number, number] {
  // UV в модели — в единицах 1/16 текстуры (как getU(index) в игре).
  let x = Math.floor(u);
  let y = Math.floor(v);
  if (x < 0) x = ((x % tex.width) + tex.width) % tex.width;
  if (y < 0) y = ((y % tex.height) + tex.height) % tex.height;
  if (x >= tex.width) x %= tex.width;
  if (y >= tex.height) y %= tex.height;
  const o = (y * tex.width + x) * 4;
  let r = tex.data[o]!;
  let g = tex.data[o + 1]!;
  let b = tex.data[o + 2]!;
  const a = tex.data[o + 3]!;
  if (tint !== null) {
    // Цвет слота в игре — умножение на цвет краски.
    const tr = (tint >> 16) & 0xff;
    const tg = (tint >> 8) & 0xff;
    const tb = tint & 0xff;
    if (tr !== 255 || tg !== 255 || tb !== 255) {
      r = (r * tr) / 255;
      g = (g * tg) / 255;
      b = (b * tb) / 255;
    }
  }
  return [r, g, b, a];
}

// ---------- геометрия граней (как в FaceInfo игры) ----------

type FaceName = "down" | "up" | "north" | "south" | "west" | "east";

const FACE_NORMAL: Record<FaceName, Vec3> = {
  down: [0, -1, 0],
  up: [0, 1, 0],
  north: [0, 0, -1],
  south: [0, 0, 1],
  west: [-1, 0, 0],
  east: [1, 0, 0],
};

/**
 * Углы грани в порядке FaceInfo: MIN_X=4, MIN_Y=0, MIN_Z=2, MAX_Y=1, MAX_Z=3,
 * MAX_X=5 — то есть вершины указывают, какую грани элемента брать по каждой оси.
 */
function faceCorners(name: FaceName, from: Vec3, to: Vec3): [Vec3, Vec3, Vec3, Vec3] {
  const [x0, y0, z0] = from;
  const [x1, y1, z1] = to;
  switch (name) {
    case "down":
      return [
        [x0, y0, z1],
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
      ];
    case "up":
      return [
        [x0, y1, z0],
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y1, z0],
      ];
    case "north":
      return [
        [x1, y1, z0],
        [x1, y0, z0],
        [x0, y0, z0],
        [x0, y1, z0],
      ];
    case "south":
      return [
        [x0, y1, z1],
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
      ];
    case "west":
      return [
        [x0, y1, z0],
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, y1, z1],
      ];
    case "east":
      return [
        [x1, y1, z1],
        [x1, y0, z1],
        [x1, y0, z0],
        [x1, y1, z0],
      ];
  }
}

/** Автоматические UV грани — BlockElement#uvsByFace. */
function autoUv(name: FaceName, from: Vec3, to: Vec3): [number, number, number, number] {
  const [x0, y0, z0] = from;
  const [x1, y1, z1] = to;
  switch (name) {
    case "down":
      return [x0, 16 - z1, x1, 16 - z0];
    case "up":
      return [x0, z0, x1, z1];
    case "north":
      return [16 - x1, 16 - y1, 16 - x0, 16 - y0];
    case "south":
      return [x0, 16 - y1, x1, 16 - y0];
    case "west":
      return [z0, 16 - y1, z1, 16 - y0];
    case "east":
      return [16 - z1, 16 - y1, 16 - z0, 16 - y0];
  }
}

/**
 * UV вершин грани: BlockFaceUV#uv отдаёт по индексу вершины
 * (u1,v1), (u1,v2), (u2,v2), (u2,v1) — с учётом поворота грани.
 */
function vertexUvs(uv: [number, number, number, number], rotation: number): [Vec2, Vec2, Vec2, Vec2] {
  const [u1, v1, u2, v2] = uv;
  const base: [Vec2, Vec2, Vec2, Vec2] = [
    [u1, v1],
    [u1, v2],
    [u2, v2],
    [u2, v1],
  ];
  const shift = Math.floor(rotation / 90) % 4;
  if (shift === 0) return base;
  return [base[shift]!, base[(shift + 1) % 4]!, base[(shift + 2) % 4]!, base[(shift + 3) % 4]!];
}

type Vec2 = [number, number];

/** Поворот элемента вокруг оси (BlockElementRotation), координаты в 0..16. */
function elementMatrix(el: ModelElement): Mat4 {
  if (!el.rotation) return matIdentity();
  const { origin, axis, angle } = el.rotation;
  // Пивот задаётся в координатах [-8..8] относительно центра блока.
  const p: Vec3 = [origin[0], origin[1], origin[2]];
  const rot = axis === "x" ? matRotX(angle) : axis === "y" ? matRotY(angle) : matRotZ(angle);
  return matMul(matTranslate(-p[0], -p[1], -p[2]), matMul(rot, matTranslate(p[0], p[1], p[2])));
}

// ---------- растеризация ----------

interface Quad {
  pts: Vec3[];
  uv: [Vec2, Vec2, Vec2, Vec2];
  tex: TexturePixels;
  shade: number;
  depth: number;
}

/** Заливает четырехугольник текстурой (два треугольника, nearest). */
function fillQuad(
  out: Buffer,
  size: number,
  q: { p: [Vec2, Vec2, Vec2, Vec2]; uv: [Vec2, Vec2, Vec2, Vec2]; tex: TexturePixels; shade: number }
): void {
  const [p0, p1, p2, p3] = q.p;
  const [uv0, uv1, uv2, uv3] = q.uv;
  fillTriangle(out, size, p0, p1, p2, uv0, uv1, uv2, q.tex, q.shade);
  fillTriangle(out, size, p0, p2, p3, uv0, uv2, uv3, q.tex, q.shade);
}

function fillTriangle(
  out: Buffer,
  size: number,
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  uv0: Vec2,
  uv1: Vec2,
  uv2: Vec2,
  tex: TexturePixels,
  shade: number
): void {
  const minX = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0])));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
  const minY = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1])));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));
  if (minX > maxX || minY > maxY) return;

  const det = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]);
  if (Math.abs(det) < 1e-9) return;
  const inv = 1 / det;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      // Бэрицентрические координаты; любой знак — треугольник не покрывает пиксель.
      const w0 = ((p1[0] - px) * (p2[1] - py) - (p2[0] - px) * (p1[1] - py)) * inv;
      const w1 = ((p2[0] - px) * (p0[1] - py) - (p0[0] - px) * (p2[1] - py)) * inv;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;

      const u = uv0[0] * w0 + uv1[0] * w1 + uv2[0] * w2;
      const v = uv0[1] * w0 + uv1[1] * w1 + uv2[1] * w2;
      const [r, g, b, a] = sampleTexture(tex, u, v, null);
      if (a < ALPHA_CUTOUT) continue;

      const o = (y * size + x) * 4;
      const nr = Math.min(255, r * shade);
      const ng = Math.min(255, g * shade);
      const nb = Math.min(255, b * shade);
      if (a >= 250) {
        out[o] = nr;
        out[o + 1] = ng;
        out[o + 2] = nb;
        out[o + 3] = 255;
      } else {
        // Полупрозрачное стекло смешивается с уже нарисованным.
        const sa = a / 255;
        const da = out[o + 3]! / 255;
        const oa = sa + da * (1 - sa);
        if (oa <= 0) continue;
        out[o] = Math.round((nr * sa + out[o]! * da * (1 - sa)) / oa);
        out[o + 1] = Math.round((ng * sa + out[o + 1]! * da * (1 - sa)) / oa);
        out[o + 2] = Math.round((nb * sa + out[o + 2]! * da * (1 - sa)) / oa);
        out[o + 3] = Math.round(oa * 255);
      }
    }
  }
}

// ---------- плоские предметы ----------

/**
 * Квад со слоями, как item/generated. tint[layer] — цвет слота: у яиц призыва
 * layer0 красится в backgroundColor моба, layer1 — в highlightColor.
 */
async function renderFlat(model: ResolvedModel, size: number, tints: Record<string, number>): Promise<RgbaImage | null> {
  const layerKeys = Object.keys(model.textures)
    .filter((k) => /^layer\d+$/.test(k))
    .sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)));
  if (!layerKeys.length) return null;

  const out = Buffer.alloc(size * size * 4, 0);

  for (const key of layerKeys) {
    const ref = resolveTextureRef(model, key);
    if (!ref) continue;
    const tex = await getTextureByRef(ref);
    if (!tex) continue;
    // Нет краски — обычный слой. undefined приводим к null, иначе цвет станет 0.
    const tint = tints[key] ?? null;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Слой занимает весь квад 0..16 и показывается в слоте 16x16, поэтому при
        // увеличении значка каждый тексель спрайта должен попасть ровно в свой
        // квадрат. Отсюда u = x * width / size, а не x / (size - 1) * 16: иначе
        // текстура растягивается на size - 1 шагов, крайний столбец и строка
        // уезжают за UV 16 и Wrap-семплинг подтягивает к ним тексель 0.
        const u = (x * tex.width) / size;
        const v = (y * tex.height) / size;
        const [r, g, b, a] = sampleTexture(tex, u, v, tint);
        if (a < ALPHA_CUTOUT) continue;
        const o = (y * size + x) * 4;
        out[o] = r;
        out[o + 1] = g;
        out[o + 2] = b;
        out[o + 3] = a;
      }
    }
  }
  return { width: size, height: size, data: out };
}

// ---------- блоки: 3D ----------

async function renderBlock(model: ResolvedModel, size: number): Promise<RgbaImage | null> {
  if (!model.elements.length) return null;

  const t = model.gui ?? DEFAULT_BLOCK_TRANSFORM;

  // Полная цепочка как в игре: координаты модели 0..16 → /16 → масштаб и поворот
  // из display.gui → сдвиг из ItemTransform#apply → центровка translate(-0.5)
  // из ItemRenderer#render.
  const view = matMul(
    matTranslate(-0.5, -0.5, -0.5),
    matMul(
      matTranslate(t.translation[0] / 16, t.translation[1] / 16, t.translation[2] / 16),
      matMul(matRotXYZ(t.rotation[0], t.rotation[1], t.rotation[2]), matMul(matScale(t.scale[0], t.scale[1], t.scale[2]), matScale(1 / 16, 1 / 16, 1 / 16)))
    )
  );

  const quads: Quad[] = [];

  for (const el of model.elements) {
    const world = matMul(view, elementMatrix(el));
    for (const face of el.faces) {
      const name = face.name;
      if (!face.texture) continue;
      const ref = resolveTextureRef(model, face.texture.replace(/^#/, ""));
      if (!ref) continue;
      const tex = await getTextureByRef(ref);
      if (!tex) continue;

      const corners = faceCorners(name, el.from, el.to).map((p) => applyPoint(world, p));
      // Камера смотрит вдоль -Z, поэтому грань видна, если её нормаль смотрит на +Z.
      const n = applyDir(world, FACE_NORMAL[name]);
      if (n[2] <= 1e-6) continue;

      const uv = face.uv ?? autoUv(name, el.from, el.to);
      const depth = (corners[0]![2] + corners[1]![2] + corners[2]![2] + corners[3]![2]) / 4;
      quads.push({
        pts: corners,
        uv: vertexUvs(uv, face.rotation),
        tex,
        shade: face.shade ? (FACE_SHADE[name] ?? 1) : 1,
        depth,
      });
    }
  }
  if (!quads.length) return null;

  // Дальние грани первыми (алгоритм художника) — обход в глубину.
  quads.sort((a, b) => a.depth - b.depth);

  // Вписываем силуэт в кадр с небольшими полями, как игра в слоте.
  const pad = Math.max(1, Math.round(size * 0.02));
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const q of quads) {
    for (const p of q.pts) {
      // Вид в GUI — ортографический: экранные X = x, Y = -y, глубина = z.
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (-p[1] < minY) minY = -p[1];
      if (-p[1] > maxY) maxY = -p[1];
    }
  }
  const spanX = Math.max(1e-9, maxX - minX);
  const spanY = Math.max(1e-9, maxY - minY);
  const scale = Math.min((size - pad * 2) / spanX, (size - pad * 2) / spanY);
  const offX = (size - spanX * scale) / 2;
  const offY = (size - spanY * scale) / 2;

  const out = Buffer.alloc(size * size * 4, 0);
  for (const q of quads) {
    const p = q.pts.map((v): Vec2 => [offX + (v[0] - minX) * scale, offY + (-v[1] - minY) * scale]);
    fillQuad(out, size, { p: p as [Vec2, Vec2, Vec2, Vec2], uv: q.uv, tex: q.tex, shade: q.shade });
  }

  return { width: size, height: size, data: out };
}

// ---------- публичный API ----------

export interface IconOptions {
  /** Имя стека — нужно, чтобы различать варианты одного предмета (колоды). */
  name?: string;
}

function iconCacheFile(key: string): string {
  const safe = key.replace(/[^a-z0-9_.:-]/gi, "_");
  return join(ICON_DIR, `${safe}.png`);
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Иконка предмета в PNG, либо null, если отрисовать нечем. */
export async function renderItemIcon(itemId: string, opts: IconOptions = {}): Promise<Buffer | null> {
  const id = itemId.toLowerCase();
  const sep = id.indexOf(":");
  const ns = sep >= 0 ? id.slice(0, sep) : "minecraft";
  const name = sep >= 0 ? id.slice(sep + 1) : id;

  const variant = opts.name ? `-${hashString(opts.name).toString(36)}` : "";
  const cacheFile = iconCacheFile(`${ns}_${name}${variant}`);
  if (existsSync(cacheFile)) {
    try {
      return readFileSync(cacheFile);
    } catch {
      // перерисуем
    }
  }

  const png = await renderItemIconUncached(ns, name, id, opts);
  if (!png) return null;

  try {
    mkdirSync(dirname(cacheFile), { recursive: true });
    writeFileSync(cacheFile, png);
  } catch {
    // кэш необязателен
  }
  return png;
}

/** Есть ли в модели что-то, что можно отрисовать (геометрия или слои). */
function hasDrawableContent(model: ResolvedModel): boolean {
  if (model.elements.length > 0) return true;
  return Object.keys(model.textures).some((k) => /^layer\d+$/.test(k));
}

async function renderItemIconUncached(ns: string, name: string, fullId: string, opts: IconOptions): Promise<Buffer | null> {
  const tints: Record<string, number> = {};
  const egg = spawnEggColors(fullId);
  if (egg) {
    // Яйцо призыва: текстура одна на всех мобов, игра красит её в цвета моба.
    tints["layer0"] = egg[0];
    tints["layer1"] = egg[1];
  }

  // Как и игра: сначала item/<name>, а если это пустышка (builtin/entity —
  // сундуки, черепа, шалкеры) — берём block/<name>. Именно так в инвентаре
  // сундук получает геометрию сундука, а не пустой шаблон.
  const chain: string[] = [`item/${name}`];
  const item = await resolveModel(ns, chain[0]!);
  if (!item || !hasDrawableContent(item)) chain.push(`block/${name}`);

  let image: RgbaImage | null = null;
  for (const modelPath of chain) {
    const model = modelPath === chain[0] ? item : await resolveModel(ns, modelPath);
    if (!model || !hasDrawableContent(model)) continue;
    image = model.elements.length ? await renderBlock(model, ICON_SIZE) : await renderFlat(model, ICON_SIZE, tints);
    if (image) break;
  }

  if (!image) {
    // Предмет с кастомным рендерером (колода charta): в jar лежит картинка,
    // которой мод рисует предмет. Подбираем её по названию колоды.
    const deckPath = resolveDeckImage(ns, name, opts.name);
    if (deckPath) {
      const tex = await getModFile(ns, deckPath);
      if (tex) image = await renderCustomIcon(tex, ICON_SIZE);
    }
  }

  if (!image) return null;

  return sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Просто вписывает картинку из jar в кадр (кастомный рендерер мода). */
async function renderCustomIcon(tex: TexturePixels, size: number): Promise<RgbaImage> {
  const out = Buffer.alloc(size * size * 4, 0);
  // Обложка колоды — не квадрат, поэтому по ней сохраняем пропорции, как игра.
  const scale = Math.min(size / tex.width, size / tex.height);
  const w = Math.round(tex.width * scale);
  const h = Math.round(tex.height * scale);
  const offX = Math.round((size - w) / 2);
  const offY = Math.round((size - h) / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.min(tex.width - 1, Math.floor((x / w) * tex.width));
      const sy = Math.min(tex.height - 1, Math.floor((y / h) * tex.height));
      const o = (sy * tex.width + sx) * 4;
      const a = tex.data[o + 3]!;
      if (a < ALPHA_CUTOUT) continue;
      const d = ((y + offY) * size + (x + offX)) * 4;
      out[d] = tex.data[o]!;
      out[d + 1] = tex.data[o + 1]!;
      out[d + 2] = tex.data[o + 2]!;
      out[d + 3] = a;
    }
  }
  return { width: size, height: size, data: out };
}