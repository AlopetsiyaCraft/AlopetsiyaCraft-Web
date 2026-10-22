"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface AdminProduct {
  id: number;
  slug: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  priceBld: number;
  kind: string;
  payload: string;
  isActive: boolean;
  sortOrder: number;
  maxPerUser: number | null;
}

export interface AdminOrder {
  id: number;
  nickname: string;
  title: string;
  priceBld: number;
  status: string;
  createdAt: string;
  error: string | null;
}

const CATEGORIES = [
  ["cosmetic", "Косметика"],
  ["custom", "Кастом"],
  ["service", "Услуги"],
  ["currency", "Валюта"],
] as const;

const KINDS = [
  ["cape", "Плащ"],
  ["nick_effect", "Ник-эффект"],
  ["pet", "Питомец"],
  ["title", "Титул"],
  ["disc", "Пластинка"],
  ["item", "Предмет"],
  ["chips", "Фишки"],
] as const;

const STATUS: Record<string, string> = {
  pending: "Ждёт выдачи",
  delivered: "Выдано",
  failed: "Ошибка",
  refunded: "Возврат",
};

function formatWhen(iso: string) {
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

const EMPTY_FORM = {
  title: "",
  slug: "",
  description: "",
  category: "cosmetic",
  icon: "🎁",
  priceBld: "50",
  kind: "title",
  payload: "{}",
  sortOrder: "100",
  maxPerUser: "",
};

export default function AdminShop({
  initialProducts,
  initialOrders,
}: {
  initialProducts: AdminProduct[];
  initialOrders: AdminOrder[];
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [orders, setOrders] = useState(initialOrders);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function setField<K extends keyof typeof EMPTY_FORM>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function patchProduct(id: number, patch: Record<string, unknown>) {
    setBusy(`product-${id}`);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/shop/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось обновить товар");
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } as AdminProduct : p))
      );
      setMessage("Товар обновлён");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  async function createProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("create");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/shop/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          priceBld: Number(form.priceBld),
          sortOrder: Number(form.sortOrder),
          maxPerUser: form.maxPerUser === "" ? null : Number(form.maxPerUser),
        }),
      });
      const data = (await res.json()) as { error?: string; id?: number };
      if (!res.ok) throw new Error(data.error || "Не удалось создать товар");
      setMessage(`Товар создан (id ${data.id})`);
      setForm({ ...EMPTY_FORM });
      router.refresh();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  async function orderAction(order: AdminOrder, action: "deliver" | "refund") {
    setBusy(`order-${order.id}`);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/shop/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, action }),
      });
      const data = (await res.json()) as { error?: string; status?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось обновить заказ");
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? {
                ...o,
                status: data.status ?? (action === "deliver" ? "delivered" : "refunded"),
                error: action === "refund" ? "Возврат администратором" : null,
              }
            : o
        )
      );
      setMessage(action === "deliver" ? "Заказ выдан" : "BLD возвращены игроку");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
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

      <section className="mc-panel overflow-hidden">
        <div className="mc-head">Товары</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[var(--card-alt)] text-[0.6rem] uppercase tracking-[0.12em] text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-2">Товар</th>
                <th className="px-3 py-2">Категория</th>
                <th className="px-3 py-2">Тип</th>
                <th className="px-3 py-2">Цена</th>
                <th className="px-3 py-2">Лимит</th>
                <th className="px-3 py-2">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black/40">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{product.icon}</span>
                      <div>
                        <div className="font-semibold">{product.title}</div>
                        <div className="font-mono text-[0.6rem] text-[var(--text-muted)]">
                          {product.slug}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[0.72rem] text-[var(--text-secondary)]">
                    {CATEGORIES.find(([key]) => key === product.category)?.[1] ?? product.category}
                  </td>
                  <td className="px-3 py-2 text-[0.72rem] text-[var(--text-secondary)]">
                    {KINDS.find(([key]) => key === product.kind)?.[1] ?? product.kind}
                  </td>
                  <td className="px-3 py-2">
                    <form
                      className="flex items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const value = Number(new FormData(e.currentTarget).get("price"));
                        if (Number.isInteger(value) && value >= 0) {
                          void patchProduct(product.id, { priceBld: value });
                        }
                      }}
                    >
                      <input
                        name="price"
                        type="number"
                        min={0}
                        defaultValue={product.priceBld}
                        className="mc-input w-20 py-1 text-xs"
                      />
                      <button
                        type="submit"
                        disabled={busy === `product-${product.id}`}
                        className="mc-btn px-2 py-1 text-[0.6rem]"
                      >
                        OK
                      </button>
                    </form>
                  </td>
                  <td className="px-3 py-2 text-[0.72rem] text-[var(--text-secondary)]">
                    {product.maxPerUser ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => void patchProduct(product.id, { isActive: !product.isActive })}
                      disabled={busy === `product-${product.id}`}
                      className={`mc-chip text-[0.6rem] ${
                        product.isActive
                          ? "text-[var(--mc-green-light)]"
                          : "text-[var(--text-muted)]"
                      }`}
                    >
                      {product.isActive ? "В продаже" : "Скрыт"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mc-panel overflow-hidden">
        <div className="mc-head">Новый товар</div>
        <form onSubmit={createProduct} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Название
            <input
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              required
              className="mc-input"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Slug
            <input
              value={form.slug}
              onChange={(e) => setField("slug", e.target.value)}
              required
              placeholder="my-product"
              className="mc-input"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Категория
            <select
              value={form.category}
              onChange={(e) => setField("category", e.target.value)}
              className="mc-input"
            >
              {CATEGORIES.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Тип выдачи
            <select
              value={form.kind}
              onChange={(e) => setField("kind", e.target.value)}
              className="mc-input"
            >
              {KINDS.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Иконка (эмодзи)
            <input
              value={form.icon}
              onChange={(e) => setField("icon", e.target.value)}
              className="mc-input"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Цена, BLD
            <input
              type="number"
              min={0}
              value={form.priceBld}
              onChange={(e) => setField("priceBld", e.target.value)}
              className="mc-input"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Сортировка
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setField("sortOrder", e.target.value)}
              className="mc-input"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Лимит на игрока (пусто — без лимита)
            <input
              type="number"
              min={1}
              value={form.maxPerUser}
              onChange={(e) => setField("maxPerUser", e.target.value)}
              className="mc-input"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)] sm:col-span-2">
            Описание
            <textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              rows={2}
              className="mc-input"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)] sm:col-span-2">
            payload (JSON для мода)
            <textarea
              value={form.payload}
              onChange={(e) => setField("payload", e.target.value)}
              rows={3}
              className="mc-input font-mono text-xs"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy === "create"}
              className="mc-btn mc-btn-primary px-4 py-2 text-xs"
            >
              {busy === "create" ? "Создаём…" : "Создать товар"}
            </button>
          </div>
        </form>
      </section>

      <section className="mc-panel overflow-hidden">
        <div className="mc-head">Последние заказы</div>
        {orders.length === 0 ? (
          <div className="p-6 text-sm text-[var(--text-muted)]">Заказов пока нет.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[var(--card-alt)] text-[0.6rem] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Игрок</th>
                  <th className="px-3 py-2">Товар</th>
                  <th className="px-3 py-2">Цена</th>
                  <th className="px-3 py-2">Статус</th>
                  <th className="px-3 py-2">Когда</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black/40">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-3 py-2 font-mono text-xs text-[var(--text-muted)]">
                      {order.id}
                    </td>
                    <td className="px-3 py-2 font-semibold">{order.nickname}</td>
                    <td className="px-3 py-2">{order.title}</td>
                    <td className="px-3 py-2 font-mono text-xs text-[var(--mc-gold)]">
                      {order.priceBld} BLD
                    </td>
                    <td className="px-3 py-2 text-[0.7rem]">
                      <span className={order.status === "delivered" ? "text-[var(--mc-green-light)]" : order.status === "pending" ? "text-[var(--mc-gold)]" : "text-[var(--mc-red)]"}>
                        {STATUS[order.status] ?? order.status}
                      </span>
                      {order.error && (
                        <span className="block text-[0.6rem] text-[var(--text-muted)]">{order.error}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-[0.62rem] text-[var(--text-muted)]">
                      {formatWhen(order.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      {order.status === "pending" && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => void orderAction(order, "deliver")}
                            disabled={busy === `order-${order.id}`}
                            className="mc-btn px-2 py-1 text-[0.6rem]"
                          >
                            Выдать
                          </button>
                          <button
                            type="button"
                            onClick={() => void orderAction(order, "refund")}
                            disabled={busy === `order-${order.id}`}
                            className="mc-btn px-2 py-1 text-[0.6rem] text-[var(--mc-red)]"
                          >
                            Возврат
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
