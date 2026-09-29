import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { seasons } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import Header from "@/components/Header";
import WalletExchange from "@/components/WalletExchange";
import { getWallet } from "@/lib/wallet";

/**
 * /wallet — кошелёк: Болды (покупки на сайте) и Фишки (столы казино в Minecraft),
 * ниже — конвертер Болды ↔ Фишки.
 */
export default async function WalletPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent("/wallet")}`);
  }

  const [wallet, allSeasons] = await Promise.all([
    getWallet(parseInt(session.user.id, 10)),
    db.select().from(seasons).orderBy(desc(seasons.number)).all(),
  ]);
  if (!wallet) redirect("/auth/login");

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={{ name: wallet.name, skinUrl: wallet.skinUrl, bld: wallet.bld }}
        isLoggedIn={!!session}
      />

      <main className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold">Кошелёк</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Болды (BLD) — для покупок на сайте. Фишки — для игры в казино в Minecraft.
          </p>
        </div>

        <WalletExchange initialBld={wallet.bld} initialChips={wallet.chips} />
      </main>
    </div>
  );
}