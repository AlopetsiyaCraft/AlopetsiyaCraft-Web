"use client";

import type { InventoryStack } from "@/lib/inventory";

/** Предмет, подготовленный сервером: имя уже переведено, иконка известна. */
export interface PreparedStack extends InventoryStack {
  /** URL картинки (ванильная текстура), или null — нет картинки. */
  icon: string | null;
  /** Переведённые названия заклинаний (null, если нет перевода). */
  enchantmentNames?: (string | null)[];
}

export interface PreparedContainers {
  main: (PreparedStack | null)[];
  armor: (PreparedStack | null)[];
  offhand: (PreparedStack | null)[];
  enderChest: (PreparedStack | null)[];
}

interface Props {
  containers: PreparedContainers;
  updatedAt: Date | null;
  playersOnline?: boolean;
}

const CONTAINER_LABELS: { key: keyof PreparedContainers; label: string }[] = [
  { key: "main", label: "Инвентарь" },
  { key: "armor", label: "Броня" },
  { key: "offhand", label: "Оффхенд" },
  { key: "enderChest", label: "Эндер-сундук" },
];

/** Шахматный фон пустого слота, как в игре. */
const checker =
  "repeating-conic-gradient(var(--checker-a) 0% 25%, var(--checker-b) 0% 50%) 0 0 / 16px 16px";

function Counter({ n }: { n: number }) {
  // Количество показываем только для стаков > 1 (как в игре).
  if (n <= 1) return null;
  return (
    <span className="absolute bottom-0 right-0.5 text-[13px] font-bold text-white drop-shadow-[1px_1px_0_rgba(0,0,0,0.9)] pointer-events-none leading-none">
      {n}
    </span>
  );
}

function ItemImage({ stack }: { stack: PreparedStack }) {
  if (!stack.icon) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-sm font-bold opacity-60 select-none">
        ?
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={stack.icon}
      alt=""
      draggable={false}
      className="w-full h-full object-contain"
      style={{ imageRendering: "pixelated" }}
      onError={(e) => {
        // Битый/отсутствующий файл текстуры — заглушка.
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

function Tooltip({ stack }: { stack: PreparedStack }) {
  const durability =
    stack.maxDamage && stack.damage !== undefined
      ? Math.max(0, stack.maxDamage - stack.damage)
      : null;
  const durabilityPct = durability !== null && stack.maxDamage ? durability / stack.maxDamage : null;
  const durabilityColor =
    durabilityPct === null
      ? "text-[var(--text-secondary)]"
      : durabilityPct > 0.5
        ? "text-green-400"
        : durabilityPct > 0.2
          ? "text-yellow-400"
          : "text-red-400";

  return (
    <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-50 w-max max-w-[280px]">
      <div className="bg-[#100018]/95 backdrop-blur border border-[#7c3aed]/60 rounded-lg px-3 py-2.5 shadow-2xl">
        <div className="text-sm font-semibold text-white">{stack.name}</div>
        {stack.count > 1 && <div className="text-xs text-[var(--text-secondary)]">Кол-во: {stack.count}</div>}
        {durability !== null && stack.maxDamage && (
          <div className={`text-xs ${durabilityColor}`}>
            Прочность: {durability} / {stack.maxDamage}
          </div>
        )}
        {stack.enchantments && stack.enchantments.length > 0 && (
          <div className="mt-1 flex flex-col gap-0.5">
            {stack.enchantments.map((en, i) => (
              <div key={i} className="text-xs text-[#a78bfa]">
                {enchantmentName(stack, i)}
                {en.lvl > 1 ? ` ${roman(en.lvl)}` : ""}
              </div>
            ))}
          </div>
        )}
        {stack.lore && stack.lore.length > 0 && (
          <div className="mt-1 flex flex-col gap-0.5 text-xs italic text-[#9ca3af]">
            {stack.lore.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}
        <div className="mt-1.5 pt-1.5 border-t border-white/10 font-mono text-[10px] text-[var(--text-muted)] break-all">
          {stack.id}
        </div>
      </div>
    </div>
  );
}

function enchantmentName(stack: PreparedStack, index: number): string {
  const names = stack.enchantmentNames;
  if (names && names[index]) return names[index];
  const id = stack.enchantments?.[index];
  if (!id) return "";
  const name = id.id.includes(":") ? id.id.split(":")[1]! : id.id;
  return name.replace(/_/g, " ");
}

function roman(n: number): string {
  const vals: [number, string][] = [
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"],
    [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let s = "";
  let v = n;
  for (const [val, sym] of vals) {
    while (v >= val) {
      s += sym;
      v -= val;
    }
  }
  return s;
}

function Slot({ stack, size = 44 }: { stack: PreparedStack | null; size?: number }) {
  if (!stack) {
    return <div className="relative rounded border border-[var(--border)]" style={{ width: size, height: size, background: checker }} />;
  }
  return (
    <div
      className="group relative rounded border border-[var(--border)] transition-transform"
      style={{ width: size, height: size, background: checker }}
    >
      <div className="absolute inset-[2px] flex items-center justify-center p-0.5">
        <ItemImage stack={stack} />
      </div>
      <Counter n={stack.count} />
      <div className="absolute inset-0 rounded hover:bg-white/10 cursor-pointer" />
      <Tooltip stack={stack} />
    </div>
  );
}

function GridRow({ stacks, cols }: { stacks: (PreparedStack | null)[]; cols: number }) {
  const padded = [...stacks];
  while (padded.length < cols) padded.push(null);
  return (
    <div className="flex gap-[3px]">
      {padded.slice(0, cols).map((s, i) => (
        <Slot key={i} stack={s} />
      ))}
    </div>
  );
}

function ContainerBlock({ title, item }: { title: string; item: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1.5">{title}</div>
      {item}
    </div>
  );
}

export default function InventoryGrid({ containers, updatedAt }: Props) {
  // Рюкзак: 4 ряда по 9.
  const mainRows: (PreparedStack | null)[][] = [];
  for (let r = 0; r < 4; r++) mainRows.push(containers.main.slice(r * 9, r * 9 + 9));

  // Броня (ботынки внизу, шлем сверху — как в игре) + оффхенд рядом.
  const armorCol = [...containers.armor].reverse();

  return (
    <div className="flex flex-col gap-6">
      <ContainerBlock
        title="Инвентарь (36)"
        item={
          <div className="flex flex-col gap-[3px] w-fit">
            {mainRows.map((row, i) => (
              <GridRow key={i} stacks={row} cols={9} />
            ))}
          </div>
        }
      />

      <div className="flex flex-wrap items-start gap-8">
        <ContainerBlock
          title="Броня и оффхенд"
          item={
            <div className="flex gap-[3px] items-center">
              <div className="flex flex-col gap-[3px]">
                {armorCol.map((s, i) => (
                  <Slot key={i} stack={s} />
                ))}
              </div>
              <div className="mx-1" />
              <Slot stack={containers.offhand[0] ?? null} />
            </div>
          }
        />
        <ContainerBlock
          title="Эндер-сундук (27)"
          item={
            <div className="flex flex-col gap-[3px] w-fit">
              {[0, 1, 2].map((r) => (
                <GridRow key={r} stacks={containers.enderChest.slice(r * 9, r * 9 + 9)} cols={9} />
              ))}
            </div>
          }
        />
      </div>

      {updatedAt && (
        <div className="text-sm text-[var(--text-muted)]">
          Снимок сохранён:{" "}
          <span className="text-[var(--text-secondary)]">
            {updatedAt.toLocaleString("ru-RU")}
          </span>{" "}
          — обновляется при выходе с сервера.
        </div>
      )}
    </div>
  );
}