"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export interface ShopProduct {
  id: number;
  slug: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  priceBld: number;
  kind: string;
  maxPerUser: number | null;
  /** Для кейсов: возможные призы и их шансы в процентах. */
  casePrizes?: Array<{ label: string; chance: number }>;
}

export interface ShopOrderView {
  id: number;
  title: string;
  kind: string;
  priceBld: number;
  status: "pending" | "delivered" | "failed" | "refunded" | string;
  createdAt: string;
  error?: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  all: "Все",
  cosmetic: "Косметика",
  custom: "Кастом",
  service: "Услуги",
  currency: "Валюта",
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "Ждёт выдачи", className: "text-[var(--mc-gold)]" },
  delivered: { label: "Выдано", className: "text-[var(--mc-green-light)]" },
  failed: { label: "Ошибка", className: "text-[var(--mc-red)]" },
  refunded: { label: "Возврат", className: "text-[var(--mc-blue)]" },
};

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatBld(value: number): string {
  return value.toLocaleString("ru-RU");
}

export default function ShopCatalog({
  products,
  initialBld,
  isLoggedIn,
  initialOrders,
  purchasedCounts,
}: {
  products: ShopProduct[];
  initialBld: number;
  isLoggedIn: boolean;
  initialOrders: ShopOrderView[];
  purchasedCounts: Record<number, number>;
}) {
  const router = useRouter();
  const [bld, setBld] = useState(initialBld);
  const [orders, setOrders] = useState<ShopOrderView[]>(initialOrders);
  const [counts, setCounts] = useState<Record<number, number>>(purchasedCounts);
  const [category, setCategory] = useState("all");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reward, setReward] = useState<{ label: string; kind: string } | null>(null);

  const categories = useMemo(() => {
    const present = new Set(products.map((p) => p.category));
    return [
      { key: "all", label: CATEGORY_LABELS.all },
      ...Object.entries(CATEGORY_LABELS)
        .filter(([key]) => key !== "all" && present.has(key))
        .map(([key, label]) => ({ key, label })),
    ];
  }, [products]);

  const visible = category === "all" ? products : products.filter((p) => p.category === category);

  async function buy(product: ShopProduct) {
    if (!isLoggedIn || busyId != null) return;
    setBusyId(product.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/shop/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });
      const data = (await res.json()) as {
        bld?: number;
        order?: {
          id: number;
          title: string;
          kind: string;
          priceBld: number;
          status: string;
        };
        error?: string;
        reward?: { label: string | null; kind: string } | null;
      };
      if (!res.ok || data.bld == null || !data.order) {
        throw new Error(data.error || "Не удалось купить товар");
      }

      setBld(data.bld);
      setCounts((prev) => ({ ...prev, [product.id]: (prev[product.id] ?? 0) + 1 }));
      setOrders((prev) => [
        {
          id: data.order!.id,
          title: data.order!.title,
          kind: data.order!.kind,
          priceBld: data.order!.priceBld,
          status: data.order!.status,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setMessage(
        data.reward?.kind === "name_change"
          ? "Смена ника куплена — доступна в настройках профиля."
          : data.order.kind === "frame" || data.order.kind === "profile_bg"
            ? `«${product.title}» куплен и активирован. Настрой его в профиле.`
            : product.kind === "case"
              ? `Кейс «${product.title}» открыт.`
              : `«${product.title}» куплен. Заказ №${data.order.id} появится в игре после выдачи.`
      );
      if (data.reward?.label) {
        setReward({ label: data.reward.label, kind: data.reward.kind });
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="mc-panel-flat flex items-baseline gap-2 px-3 py-2">
          <span className="text-[0.58rem] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Баланс
          </span>
          <span className="font-mono text-xl leading-none text-[var(--mc-gold)]">
            {formatBld(bld)}
          </span>
          <span className="text-xs text-[var(--text-muted)]">BLD</span>
        </div>

        {categories.length > 1 && (
          <div className="no-scrollbar flex w-full flex-wrap gap-1 overflow-x-auto sm:w-auto sm:flex-nowrap">
            {categories.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={`shrink-0 border-2 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.08em] transition-colors ${
                  category === c.key
                    ? "border-black bg-[var(--mc-green)] text-[#0f1a08]"
                    : "border-black bg-[var(--bg)] text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!isLoggedIn && (
        <p className="border-2 border-black bg-[var(--card-alt)] px-3 py-2 text-sm text-[var(--text-secondary)]">
          Чтобы покупать,{" "}
          <Link href="/auth/login?callbackUrl=/shop" className="text-[var(--mc-green-light)] underline">
            войди в аккаунт
          </Link>
          .
        </p>
      )}

      {error && (
        <p className="border-2 border-black bg-[rgba(214,69,69,0.14)] px-3 py-2 text-sm text-[var(--mc-red)]">
          {error}
        </p>
      )}
      {message && (
        <p className="border-2 border-black bg-[rgba(93,156,60,0.16)] px-3 py-2 text-sm text-[var(--mc-green-light)]">
          {message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((product) => {
          const limitReached =
            product.maxPerUser != null &&
            product.maxPerUser > 0 &&
            (counts[product.id] ?? 0) >= product.maxPerUser;
          const notEnough = isLoggedIn && bld < product.priceBld;
          const disabled = !isLoggedIn || limitReached || notEnough || busyId != null;

          return (
            <article key={product.id} className="mc-panel flex flex-col gap-3 p-5">
              <div className="flex items-start gap-3">
                <div className="mc-inset flex h-12 w-12 shrink-0 items-center justify-center text-2xl">
                  {product.icon}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold uppercase tracking-[0.08em]">
                    {product.title}
                  </h2>
                  <p className="mt-1 text-sm leading-snug text-[var(--text-secondary)]">
                    {product.description}
                  </p>
                </div>
              </div>

              {product.casePrizes && product.casePrizes.length > 0 && (
                <div className="border-2 border-black/40 bg-[var(--bg)] p-2">
                  <div className="mb-1 text-[0.56rem] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    Возможные призы
                  </div>
                  <ul className="flex flex-col gap-0.5">
                    {product.casePrizes.map((prize) => (
                      <li
                        key={`${prize.label}-${prize.chance}`}
                        className="flex items-center justify-between gap-2 text-[0.66rem] text-[var(--text-secondary)]"
                      >
                        <span className="min-w-0 truncate">{prize.label}</span>
                        <span className="font-mono text-[0.6rem] text-[var(--text-muted)]">
                          {prize.chance}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-auto border-t-2 border-black/40 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-base text-[var(--mc-gold)]">
                    {formatBld(product.priceBld)} BLD
                  </span>
                  {product.maxPerUser != null && product.maxPerUser > 0 && (
                    <span className="text-[0.6rem] text-[var(--text-muted)]">
                      до {product.maxPerUser} шт.
                    </span>
                  )}
                </div>

                {!isLoggedIn ? (
                  <Link
                    href="/auth/login?callbackUrl=/shop"
                    className="mc-btn mc-btn-primary mt-2 w-full py-1.5 text-xs"
                  >
                    Войти и купить
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => buy(product)}
                    disabled={disabled}
                    className="mc-btn mc-btn-primary mt-2 w-full py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {busyId === product.id
                      ? "Покупаем…"
                      : limitReached
                        ? "Уже куплено"
                        : notEnough
                          ? `Не хватает ${formatBld(product.priceBld - bld)} BLD`
                          : "Купить"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div className="mc-inset p-8 text-center text-sm text-[var(--text-muted)]">
          В этой категории пока нет товаров.
        </div>
      )}

      {isLoggedIn && (
        <section className="mc-panel overflow-hidden">
          <div className="mc-head">
            Мои покупки
            <span className="ml-auto text-[0.6rem] font-normal normal-case tracking-normal text-[var(--text-muted)]">
              последние {Math.min(orders.length, 10)}
            </span>
          </div>
          {orders.length === 0 ? (
            <div className="p-6 text-sm text-[var(--text-muted)]">
              Покупок пока нет. Выбери товар выше — заказ появится здесь.
            </div>
          ) : (
            <ul className="divide-y-2 divide-black/40">
              {orders.slice(0, 10).map((order) => {
                const status = STATUS_LABELS[order.status] ?? {
                  label: order.status,
                  className: "text-[var(--text-muted)]",
                };
                return (
                  <li
                    key={order.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm"
                  >
                    <span className="font-mono text-xs text-[var(--text-muted)]">
                      #{order.id}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{order.title}</span>
                    <span className="font-mono text-xs text-[var(--mc-gold)]">
                      −{formatBld(order.priceBld)} BLD
                    </span>
                    <span className={`text-[0.62rem] uppercase tracking-[0.08em] ${status.className}`}>
                      {status.label}
                    </span>
                    <span className="w-full font-mono text-[0.6rem] text-[var(--text-muted)] sm:w-auto">
                      {formatWhen(order.createdAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {reward && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Награда"
          onClick={() => setReward(null)}
        >
          <div
            className="mc-panel w-full max-w-sm p-6 text-center"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-4xl">{reward.kind === "nothing" ? "🕸" : "🎁"}</div>
            <div className="mt-3 text-[0.62rem] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {reward.kind === "name_change" ? "Куплено" : "Выпало"}
            </div>
            <div className="mt-1 text-lg font-bold text-[var(--mc-gold)]">{reward.label}</div>
            {reward.kind === "name_change" && (
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Сменить ник можно в настройках профиля.
              </p>
            )}
            <button
              type="button"
              onClick={() => setReward(null)}
              className="mc-btn mc-btn-primary mt-4 w-full py-1.5 text-xs"
            >
              Забрать
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
