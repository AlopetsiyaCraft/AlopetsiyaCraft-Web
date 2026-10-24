import { db } from "@/lib/db";
import { adminAudit } from "@/lib/db/schema";

/**
 * Запись в журнал админки. Не бросает исключение: провал аудита не должен
 * ломать основное действие.
 */
export async function logAdminAction(params: {
  admin: { id: number; nickname: string };
  action: string;
  targetType?: string;
  targetId?: string | number | null;
  details?: string | null;
}): Promise<void> {
  try {
    await db
      .insert(adminAudit)
      .values({
        adminId: params.admin.id,
        adminNickname: params.admin.nickname,
        action: params.action,
        targetType: params.targetType ?? null,
        targetId: params.targetId != null ? String(params.targetId) : null,
        details: params.details ? params.details.slice(0, 1000) : null,
      })
      .run();
  } catch (error) {
    console.error("Admin audit error:", error);
  }
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "user.role": "Смена роли",
  "season.create": "Создан сезон",
  "season.update": "Изменён сезон",
  "shop.product.create": "Создан товар",
  "shop.product.update": "Изменён товар",
  "shop.order.deliver": "Выдача заказа",
  "currency.bld": "Начисление BLD",
  "currency.chips": "Начисление фишек",
  "economy.grant": "Массовое начисление",
  broadcast: "Рассылка",
  "content.photo": "Правка фото",
  "content.post": "Правка записи",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
