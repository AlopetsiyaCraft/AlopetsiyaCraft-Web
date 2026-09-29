import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { seasons, users, playerInventories, inventorySnapshots } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import Header from "@/components/Header";
import InventoryGrid, {
  type PreparedContainers,
  type PreparedStack,
} from "@/components/InventoryGrid";
import SnapshotHistory, {
  type SnapshotSummary,
} from "@/components/SnapshotHistory";
import {
  parseInventoryData,
  type InventoryData,
  type InventoryStack,
} from "@/lib/inventory";
import { localizeEnchantment, localizeItemSmart, resolveItemIcons } from "@/lib/mcAssets";

const CONTAINER_KEYS = ["main", "armor", "offhand", "enderChest"] as const;

/**
 * Страница «Инвентарь»: показывает последний снимок инвентаря владельца
 * аккаунта (иконки из ванильных ассетов 1.21.1, русские имена предметов).
 * Снимок шлёт серверный мод AlopetsiyaInventory при выходе игрока с сервера
 * (и при входе / остановке сервера) в POST /api/inventory/from-server.
 *
 * Админ (users.role = "admin"): селектор игроков и ?nick=xxx — просмотр
 * чужого инвентаря + история снимков и отложенный откат к точке истории
 * (применяется модом при следующем входе игрока). Обычные пользователи
 * видят только свой инвентарь, без истории.
 *
 * Страница личная: данные инвентаря привязаны к нику Minecraft владельца
 * аккаунта (ключ — ник в нижнем регистре), поэтому без логина недоступна.
 */

interface Props {
  containers: PreparedContainers;
  xpLevel?: number;
  health?: number;
  healthMax?: number;
  food?: number;
  saturation?: number;
}

async function prepareInventory(data: InventoryData): Promise<Props> {
  // Собираем все id предметов и заклинаний — резолвим пачками, а не по одному.
  const itemIds = new Set<string>();
  const enchantIds = new Set<string>();
  for (const key of CONTAINER_KEYS) {
    for (const stack of data.containers[key]) {
      if (!stack) continue;
      itemIds.add(stack.id);
      for (const e of stack.enchantments ?? []) enchantIds.add(e.id);
    }
  }

  const [icons, enchantmentNames] = await Promise.all([
    resolveItemIcons([...itemIds]),
    Promise.all(
      [...enchantIds].map(async (id) => [id, await localizeEnchantment(id)] as const)
    ).then((pairs) => new Map(pairs)),
  ]);

  const prepOne = async (stack: InventoryStack | null): Promise<PreparedStack | null> => {
    if (!stack) return null;
    const [name, enchNames] = await Promise.all([
      localizeItemSmart(stack.id, stack.name),
      Promise.all((stack.enchantments ?? []).map((e) => enchantmentNames.get(e.id) ?? null)),
    ]);
    return {
      ...stack,
      icon: icons.get(stack.id) ?? null,
      name,
      enchantmentNames: enchNames.length ? enchNames : undefined,
    };
  };

  const containers: any = {};
  for (const key of CONTAINER_KEYS) {
    containers[key] = await Promise.all(data.containers[key].map(prepOne));
  }

  return {
    containers: containers as PreparedContainers,
    xpLevel: data.xpLevel,
    health: data.health,
    healthMax: data.healthMax,
    food: data.food,
    saturation: data.saturation,
  };
}

function Vital({ icon, value, color }: { icon: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-lg">
      <span className="text-lg leading-none" aria-hidden="true">{icon}</span>
      <span className={`text-sm font-semibold font-mono ${color}`}>{value}</span>
    </div>
  );
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ nick?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent("/inventory")}`);
  }

  const [viewer, allSeasons] = await Promise.all([
    db
.select({ name: users.nickname, skinUrl: users.skinUrl, role: users.role, bld: users.bld })
      .from(users)
      .where(eq(users.id, parseInt(session.user.id, 10)))
      .get(),
    db.select().from(seasons).orderBy(desc(seasons.number)).all(),
  ]);

  if (!viewer) redirect("/auth/login");

  const isAdmin = viewer.role === "admin";
  const sp = await searchParams;
  const nickParam = typeof sp.nick === "string" ? sp.nick.trim().toLowerCase() : "";
  const ownNick = viewer.name.toLowerCase();
  // Админ может смотреть других через ?nick=; обычный пользователь — только себя.
  const targetNick = isAdmin && nickParam ? nickParam : ownNick;
  const viewingOther = targetNick !== ownNick;

  const [row, playersRows, historyRows] = await Promise.all([
    db
      .select()
      .from(playerInventories)
      .where(eq(playerInventories.nickname, targetNick))
      .get(),
    isAdmin
      ? db.$client.execute({
          sql: "SELECT nickname, display_nickname, MAX(captured_at) AS last_captured FROM inventory_snapshots GROUP BY nickname ORDER BY last_captured DESC",
        })
      : null,
    isAdmin
      ? db
          .select({
            id: inventorySnapshots.id,
            displayNickname: inventorySnapshots.displayNickname,
            data: inventorySnapshots.data,
            reason: inventorySnapshots.reason,
            capturedAt: inventorySnapshots.capturedAt,
          })
          .from(inventorySnapshots)
          .where(eq(inventorySnapshots.nickname, targetNick))
          .orderBy(desc(inventorySnapshots.id))
          .limit(50)
      : null,
  ]);

  const data = row ? parseInventoryData(row.data) : null;
  const prepared = data ? await prepareInventory(data) : null;
  const updatedAt = row?.updatedAt ?? null;
  const displayNickname = row?.displayNickname || targetNick;

  // Суммарии истории для панели отката (считаем на сервере).
  type HistoryRow = {
    id: number;
    displayNickname: string;
    data: string;
    reason: string;
    capturedAt: number;
  };
  const history: SnapshotSummary[] = (historyRows ?? []).map((h: HistoryRow) => {
    const inv = parseInventoryData(h.data);
    let itemCount = 0;
    let totalCount = 0;
    if (inv) {
      for (const key of CONTAINER_KEYS) {
        for (const stack of inv.containers[key]) {
          if (stack) {
            itemCount++;
            totalCount += stack.count;
          }
        }
      }
    }
    return {
      id: h.id,
      displayNickname: h.displayNickname || targetNick,
      reason: h.reason,
      capturedAt: h.capturedAt,
      itemCount,
      totalCount,
      xpLevel: inv?.xpLevel ?? 0,
      health: inv?.health ?? 0,
      food: inv?.food ?? 0,
    };
  });

  const adminPlayers: { nickname: string; displayNickname: string; lastCaptured: number }[] =
    playersRows
      ? (playersRows.rows as unknown as {
          nickname: string;
          display_nickname: string;
          last_captured: number;
        }[]).map((r) => ({
          nickname: r.nickname,
          displayNickname: r.display_nickname || r.nickname,
          lastCaptured: r.last_captured,
        }))
      : [];

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={viewer ? { name: viewer.name, skinUrl: viewer.skinUrl, bld: viewer.bld } : undefined}
        isLoggedIn={!!session}
      />

      <main className="max-w-7xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">Инвентарь</h1>
          <span className="text-[var(--text-muted)]">
            {viewingOther ? `· ${displayNickname} (просмотр админа)` : `· ${viewer.name}`}
          </span>
        </div>

        {isAdmin && (
          <section className="flex flex-wrap items-center gap-2 px-4 py-3 border border-[var(--border)] rounded-lg bg-[var(--card)]">
            <span className="text-sm text-[var(--text-muted)] mr-1">Игроки:</span>
            <a
              href="/inventory"
              className={`px-3 py-1 rounded-md text-sm border transition-colors ${
                !viewingOther
                  ? "bg-[var(--accent)]/15 border-[var(--accent)]/40 text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--hover)]"
              }`}
            >
              {viewer.name}
            </a>
            {adminPlayers.map((p) => (
              <a
                key={p.nickname}
                href={`/inventory?nick=${encodeURIComponent(p.nickname)}`}
                className={`px-3 py-1 rounded-md text-sm border transition-colors ${
                  targetNick === p.nickname && viewingOther
                    ? "bg-[var(--accent)]/15 border-[var(--accent)]/40 text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--hover)]"
                }`}
              >
                {p.displayNickname}
              </a>
            ))}
          </section>
        )}

        {!prepared ? (
          <div className="p-8 text-center text-[var(--text-muted)] text-sm border border-[var(--border)] rounded-lg flex flex-col items-center gap-4">
            <div className="flex flex-wrap justify-center gap-6 opacity-70 pointer-events-none">
              <span className="text-[40px]">🎒</span>
              <span className="text-[40px]">🗡️</span>
              <span className="text-[40px]">🛡️</span>
            </div>
            <div className="flex flex-col gap-1">
              <span>Инвентарь ещё не сохранялся.</span>
              <span>
                Зайдите на сервер и выйдите из игры — мод AlopetsiyaInventory снимет
                инвентарь и пришлёт сюда (кнопка «Инвентарь» в профиле).
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Vital icon="❤️" value={`${prepared.health ?? "?"} / ${prepared.healthMax ?? "?"}`} color="text-red-400" />
              <Vital icon="🍖" value={`${prepared.food ?? "?"} / 20`} color="text-yellow-400" />
              <Vital icon="✨" value={`Уровень ${prepared.xpLevel ?? "?"}`} color="text-[#a78bfa]" />
              {prepared.saturation !== undefined && (
                <Vital icon="💧" value={`Насыщение ${Math.round(prepared.saturation * 10) / 10}`} color="text-sky-400" />
              )}
            </div>

            <InventoryGrid containers={prepared.containers} updatedAt={updatedAt} />

            {isAdmin && (
              <SnapshotHistory
                snapshots={history}
                nickname={viewingOther ? displayNickname : viewer.name}
              />
            )}

            <div className="text-sm text-[var(--text-muted)] border-t border-[var(--border)] pt-4">
              Нет снимка онлайн — сайт показывает последний сохранённый при
              выходе с сервера (админ видит историю и может откатить к любой
              точке — применится при следующем входе игрока). Данные присылает
              мод{" "}
              <span className="font-mono text-[var(--text-secondary)]">AlopetsiyaInventory</span>.
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export const metadata = {
  title: "Инвентарь — АлопецияКрафт",
  description: "Текущий инвентарь вашего игрока на сервере: предметы, броня, эндер-сундук",
};