import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { seasons, shopOrders, shopProducts, users } from "@/lib/db/schema";
import Header from "@/components/Header";
import AdminShop, {
  type AdminOrder,
  type AdminProduct,
} from "@/components/AdminShop";

/** /admin/shop — управление каталогом и заказами. Только для role=admin. */
export default async function AdminShopPage() {
  const admin = await getAdminUser();
  if (!admin) {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent("/admin/shop")}`);
  }

  const session = await auth();
  const [allSeasons, me, products, orders] = await Promise.all([
    db.select().from(seasons).orderBy(desc(seasons.number)).all(),
    db
      .select({ name: users.nickname, skinUrl: users.skinUrl, bld: users.bld })
      .from(users)
      .where(eq(users.id, admin.id))
      .get(),
    db.select().from(shopProducts).orderBy(shopProducts.sortOrder, shopProducts.id).all(),
    db
      .select({
        id: shopOrders.id,
        nickname: shopOrders.nickname,
        productTitle: shopOrders.productTitle,
        priceBld: shopOrders.priceBld,
        status: shopOrders.status,
        createdAt: shopOrders.createdAt,
        error: shopOrders.error,
      })
      .from(shopOrders)
      .orderBy(desc(shopOrders.createdAt))
      .limit(50)
      .all(),
  ]);

  const productRows: AdminProduct[] = products.map((product) => ({
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    category: product.category,
    icon: product.icon,
    priceBld: product.priceBld,
    kind: product.kind,
    payload: product.payload,
    isActive: product.isActive,
    sortOrder: product.sortOrder,
    maxPerUser: product.maxPerUser,
  }));

  const orderRows: AdminOrder[] = orders.map((order) => ({
    id: order.id,
    nickname: order.nickname,
    title: order.productTitle,
    priceBld: order.priceBld,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    error: order.error,
  }));

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={me ? { name: me.name, skinUrl: me.skinUrl, bld: me.bld } : undefined}
        isLoggedIn={!!session}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="mc-title text-3xl sm:text-4xl">Админка · магазин</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Каталог, цены, лимиты и ручная выдача заказов.
            </p>
          </div>
          <a href="/admin" className="mc-btn px-3 py-1.5 text-xs">
            ← В админку
          </a>
        </div>
        <AdminShop initialProducts={productRows} initialOrders={orderRows} />
      </main>
    </div>
  );
}

export const metadata = {
  title: "Админка · магазин",
  description: "Управление каталогом и заказами магазина",
};
