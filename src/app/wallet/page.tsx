import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { seasons, walletLedger } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
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

  const ledger = await db
    .select({
      id: walletLedger.id,
      currency: walletLedger.currency,
      amount: walletLedger.amount,
      balanceAfter: walletLedger.balanceAfter,
      reason: walletLedger.reason,
      createdAt: walletLedger.createdAt,
    })
    .from(walletLedger)
    .where(eq(walletLedger.userId, parseInt(session.user.id, 10)))
    .orderBy(desc(walletLedger.createdAt))
    .limit(20)
    .all();

  const formatWhen = (date: Date) =>
    new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);

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

        <section className="mc-panel overflow-hidden">
          <div className="mc-head">
            История операций
            <span className="ml-auto text-[0.6rem] font-normal normal-case tracking-normal text-[var(--text-muted)]">
              последние {ledger.length}
            </span>
          </div>
          {ledger.length === 0 ? (
            <div className="p-6 text-sm text-[var(--text-muted)]">
              Операций пока нет. Здесь появятся покупки, бонусы и обмены.
            </div>
          ) : (
            <ul className="divide-y-2 divide-black/40">
              {ledger.map((row) => {
                const unit = row.currency === "bld" ? "BLD" : "фишек";
                const positive = row.amount >= 0;
                return (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">{row.reason}</span>
                    <span
                      className={`font-mono text-sm ${
                        positive ? "text-[var(--mc-green-light)]" : "text-[var(--mc-red)]"
                      }`}
                    >
                      {positive ? "+" : "−"}
                      {Math.abs(row.amount).toLocaleString("ru-RU")} {unit}
                    </span>
                    <span className="font-mono text-[0.62rem] text-[var(--text-muted)]">
                      баланс {row.balanceAfter.toLocaleString("ru-RU")}
                    </span>
                    <span className="w-full font-mono text-[0.6rem] text-[var(--text-muted)] sm:w-auto">
                      {formatWhen(row.createdAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
export const metadata = {
  title: "Кошелёк",
  description: "Болды и фишки: баланс и конвертер валют АлопецияКрафт",
};
