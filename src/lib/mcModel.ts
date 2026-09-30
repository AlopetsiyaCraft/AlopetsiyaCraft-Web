/**
 * Модели предметов и блоков — из .jar модов или из зеркала ванильных ассетов.
 *
 * В отличие от mcAssets (которому нужен только путь к текстуре) здесь важна и
 * геометрия: элементы, грани и display.gui. Именно по ним иконка блока в игре
 * рисуется как 3D-модель в изометрии — плоской картинки у блоков нет.
 *
 * Ванильные модели складываются в data/models/, чтобы не ходить в GitHub на
 * каждый рендер.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { readModModel } from "@/lib/mcMods";

const ASSETS_BASE = `https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21.1/assets/minecraft/`;
const MODEL_DIR = join(process.cwd(), "data", "models");

const modelCache = new Map<string, Record<string, unknown> | null>();
const missingModels = new Set<string>();

function modelDiskPath(ns: string, path: string): string {
  return join(MODEL_DIR, ns, `${path.replace(/\//g, "__")}.json`);
}

/** JSON модели <ns>:<path> (path без .json) или null. */
export async function loadModel(ns: string, path: string): Promise<Record<string, unknown> | null> {
  const key = `${ns}:${path}`;
  const cached = modelCache.get(key);
  if (cached !== undefined) return cached;
  if (missingModels.has(key)) return null;

  const save = (value: Record<string, unknown> | null) => {
    modelCache.set(key, value);
    if (!value) missingModels.add(key);
    return value;
  };

  // 1. Мод — прямо из jar.
  if (ns !== "minecraft") {
    // Мод может ссылаться на чужой namespace (часто на minecraft) — это не его
    // файл, поэтому здесь только свой namespace.
    const fromJar = readModModel(ns, path);
    return save(fromJar);
  }

  // 2. Кэш на диске.
  const file = modelDiskPath(ns, path);
  if (existsSync(file)) {
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8"));
      if (parsed && typeof parsed === "object") return save(parsed as Record<string, unknown>);
    } catch {
      // битый кэш — перекачаем
    }
  }

  // 3. Зеркало ассетов.
  try {
    const res = await fetch(`${ASSETS_BASE}models/${path}.json`, { cache: "no-store" });
    if (!res.ok) return save(null);
    const text = await res.text();
    const parsed = JSON.parse(text) as Record<string, unknown>;
    try {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, text, "utf8");
    } catch {
      // кэш необязателен
    }
    return save(parsed);
  } catch {
    return save(null);
  }
}

// ---------- геометрия ----------

export type FaceName = "down" | "up" | "north" | "south" | "west" | "east";

export interface ModelFace {
  name: FaceName;
  /** UV: [u1, v1, u2, v2]; null — вычислить автоматически. */
  uv: [number, number, number, number] | null;
  /** Поворот UV на 0/90/180/270 градусов. */
  rotation: number;
  /** Ссылка на текстуру ("#planks", "ns:path") или null (грань без текстуры). */
  texture: string | null;
  /** false — грань рисуется в полный свет (BlockElementFace#shade). */
  shade: boolean;
}

export interface ModelElement {
  from: [number, number, number];
  to: [number, number, number];
  rotation: { origin: [number, number, number]; axis: "x" | "y" | "z"; angle: number } | null;
  faces: ModelFace[];
}

export interface GuiTransform {
  rotation: [number, number, number];
  translation: [number, number, number];
  scale: [number, number, number];
}

/**
 * Трансформация блока по умолчанию — та, что лежит в ванильном block/block:
 * поворот 30°/225° и масштаб 0.625. Её использует игра, если у модели нет
 * своего display.gui.
 */
export const DEFAULT_BLOCK_TRANSFORM: GuiTransform = {
  rotation: [30, 225, 0],
  translation: [0, 0, 0],
  scale: [0.625, 0.625, 0.625],
};

const FACE_NAMES: FaceName[] = ["down", "up", "north", "south", "west", "east"];

/** Автоматические UV грани — BlockElement#uvsByFace. */
function autoUv(name: FaceName, from: number[], to: number[]): [number, number, number, number] {
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

function num3(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  if (!value.slice(0, 3).every((n) => typeof n === "number")) return null;
  return [Number(value[0]), Number(value[1]), Number(value[2])];
}

function parseElement(raw: unknown): ModelElement | null {
  if (!raw || typeof raw !== "object") return null;
  const el = raw as Record<string, unknown>;
  const from = num3(el.from);
  const to = num3(el.to);
  if (!from || !to) return null;

  let rotation: ModelElement["rotation"] = null;
  const rot = el.rotation as Record<string, unknown> | undefined;
  if (rot && typeof rot === "object") {
    const origin = num3(rot.origin);
    const axis = rot.axis;
    const angle = typeof rot.angle === "number" ? rot.angle : undefined;
    if (origin && (axis === "x" || axis === "y" || axis === "z") && angle !== undefined) {
      rotation = { origin, axis, angle };
    }
  }

  const faces: ModelFace[] = [];
  const facesRaw = el.faces as Record<string, unknown> | undefined;
  if (facesRaw && typeof facesRaw === "object") {
    for (const name of FACE_NAMES) {
      const faceRaw = facesRaw[name];
      if (!faceRaw || typeof faceRaw !== "object") continue;
      const face = faceRaw as Record<string, unknown>;
      let uv: [number, number, number, number] | null = null;
      if (Array.isArray(face.uv) && face.uv.length >= 4 && face.uv.slice(0, 4).every((n) => typeof n === "number")) {
        uv = [Number(face.uv[0]), Number(face.uv[1]), Number(face.uv[2]), Number(face.uv[3])];
      }
      const rotationDeg = typeof face.rotation === "number" ? ((face.rotation % 360) + 360) % 360 : 0;
      faces.push({
        name,
        uv: uv ?? autoUv(name, from, to),
        rotation: rotationDeg,
        texture: typeof face.texture === "string" ? face.texture : null,
        shade: face.shade !== false,
      });
    }
  }

  return { from, to, rotation, faces };
}

function parseGui(raw: unknown): GuiTransform | null {
  if (!raw || typeof raw !== "object") return null;
  const display = raw as Record<string, unknown>;
  const gui = display.gui as Record<string, unknown> | undefined;
  if (!gui || typeof gui !== "object") return null;

  const rotation = num3(gui.rotation) ?? [0, 0, 0];
  const translation = num3(gui.translation) ?? [0, 0, 0];
  const scaleRaw = gui.scale;
  const scale: [number, number, number] =
    typeof scaleRaw === "number" ? [scaleRaw, scaleRaw, scaleRaw] : (num3(scaleRaw) ?? [1, 1, 1]);
  return { rotation, translation, scale };
}

export interface ResolvedModel {
  /** Ключ текстуры → ссылка ("#planks", "ns:path"). */
  textures: Record<string, string>;
  /** Геометрия модели (если это блок). */
  elements: ModelElement[];
  /** Трансформация для иконки в инвентаре. */
  gui: GuiTransform | null;
  ambientOcclusion: boolean;
}

function splitRef(ref: string, defaultNs: string): { ns: string; path: string } {
  const clean = ref.trim().replace(/^#/, "");
  const i = clean.indexOf(":");
  if (i >= 0) return { ns: clean.slice(0, i), path: clean.slice(i + 1) };
  return { ns: defaultNs, path: clean };
}

/**
 * Собирает модель по цепочке родителей.
 *
 * Значения ребёнка важнее значений родителя — так же делает игра. Это важно
 * для шаблонов вроде item/template_spawn_egg и для вариантов, где предмет
 * переопределяет текстуру или геометрию.
 */
export async function resolveModel(ns: string, modelPath: string): Promise<ResolvedModel | null> {
  const textures: Record<string, string> = {};
  let elements: ModelElement[] = [];
  let gui: GuiTransform | null = null;
  let ambientOcclusion = true;
  let found = false;

  const seen = new Set<string>();
  let cur: { ns: string; path: string } | null = { ns, path: modelPath };

  for (let depth = 0; depth <= 8 && cur; depth++) {
    const key = `${cur.ns}:${cur.path}`;
    if (seen.has(key)) break;
    seen.add(key);
    // builtin/entity и прочие шаблоны задач не имеют — на них обрываемся.
    if (cur.path.startsWith("builtin/")) break;

    const model = await loadModel(cur.ns, cur.path);
    if (!model) break;
    found = true;

    const own = model.textures as Record<string, unknown> | undefined;
    if (own && typeof own === "object") {
      for (const [k, v] of Object.entries(own)) {
        if (typeof v !== "string" || k in textures) continue;
        textures[k] = v;
      }
    }

    // Геометрию и трансформацию берём от самой верхней модели в цепочке —
    // именно её видит игра.
    if (!elements.length && Array.isArray(model.elements)) {
      for (const raw of model.elements) {
        const el = parseElement(raw);
        if (el) elements.push(el);
      }
    }
    if (!gui) gui = parseGui(model.display);
    if (typeof model.ambientocclusion === "boolean") ambientOcclusion = model.ambientocclusion;

    const parent = typeof model.parent === "string" ? model.parent : null;
    if (!parent) break;
    const p = splitRef(parent, cur.ns);
    // Родитель может лежать в другом namespace (моды часто ссылаются на
    // minecraft:block/block) — проверяем свой, потом minecraft.
    cur = (await loadModel(p.ns, p.path)) ? p : (await loadModel("minecraft", p.path)) ? { ns: "minecraft", path: p.path } : null;
  }

  return found ? { textures, elements, gui, ambientOcclusion } : null;
}

/** Раскрывает "#переменная" в ссылку на текстуру. */
export function resolveTextureRef(model: ResolvedModel, key: string): string | null {
  let name = key;
  const seen = new Set<string>();
  while (!seen.has(name)) {
    seen.add(name);
    const raw = model.textures[name];
    if (typeof raw !== "string") return null;
    if (raw.startsWith("#")) {
      name = raw.slice(1);
      continue;
    }
    return raw;
  }
  return null;
}