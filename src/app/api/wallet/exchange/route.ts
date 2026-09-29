import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getWallet, setWallet } from "@/lib/wallet";
import {
  SELL_CHIPS_PER_BLD,
  bldToChips,
  chipsSpentForBld,
  chipsToBld,
} from "@/lib/currency";

/**
 * POST /api/wallet/exchange { from: "bld" | "chips", amount }
 * Обмен валют в кошельке:
 *   - bld → chips: 1 BLD = CHIPS_PER_BLD фишек.
 *   - chips → bld: целыми пачками по SELL_CHIPS_PER_BLD, остаток фишек
 *     остаётся на счету. Возвращает новые балансы { bld, chips }.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    const userId = parseInt(session.user.id, 10);

    const body = await request.json();
    const from: "bld" | "chips" = body?.from === "chips" ? "chips" : "bld";
    const amount = Math.floor(Number(body?.amount));

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Укажи положительную сумму обмена" }, { status: 400 });
    }

    const wallet = await getWallet(userId);
    if (!wallet) {
      return NextResponse.json({ error: "Аккаунт не найден" }, { status: 404 });
    }

    let bld = wallet.bld;
    let chips = wallet.chips;

    if (from === "bld") {
      if (bld < amount) {
        return NextResponse.json({ error: "Недостаточно болдов" }, { status: 402 });
      }
      bld -= amount;
      chips += bldToChips(amount);
    } else {
      const spent = chipsSpentForBld(amount);
      if (spent === 0) {
        return NextResponse.json(
          { error: `Можно обменять минимум ${SELL_CHIPS_PER_BLD} фишек` },
          { status: 400 }
        );
      }
      if (chips < spent) {
        return NextResponse.json({ error: "Недостаточно фишек" }, { status: 402 });
      }
      chips -= spent;
      bld += chipsToBld(amount);
    }

    await setWallet(userId, bld, chips);
    return NextResponse.json({ bld, chips });
  } catch (error) {
    console.error("Wallet exchange error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}