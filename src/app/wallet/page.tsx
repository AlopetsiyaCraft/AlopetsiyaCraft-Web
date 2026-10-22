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
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={{ name: wallet.name, skinUrl: wallet.skinUrl, bld: wallet.bld }}
        isLoggedIn={!!session}
      />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="mc-title text-3xl sm:text-4xl">Кошелёк</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Болды — для покупок на сайте. Фишки — для казино в Minecraft.
            </p>
          </div>
        </div>

        <WalletExchange initialBld={wallet.bld} initialChips={wallet.chips} />
      </main>
    </div>
  );
}
export const metadata = {
  title: "Кошелёк",
  description: "Болды и фишки: баланс и конвертер валют АлопецияКрафт",
};
