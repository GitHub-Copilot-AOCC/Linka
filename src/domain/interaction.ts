// 型別對照 spec.md §7 Interaction。v1 改為獨立集合，支援 contactIds 多對多綁定（見 §5.3）。

export type InteractionType = 'meeting' | 'call' | 'email';
export type InteractionSource = 'manual' | 'ai_quick_capture';

export interface Interaction {
  id: string;
  contactIds: string[];
  type: InteractionType;
  description: string;
  date: string; // YYYY-MM-DD
  source: InteractionSource;
  rawInput?: string;
  createdAt: number;
}

export type NewInteractionInput = Omit<Interaction, 'id' | 'createdAt' | 'source' | 'rawInput'>;
export type CreateInteractionInput = NewInteractionInput & {
  source?: InteractionSource;
  rawInput?: string;
};

export interface InteractionValidationResult {
  valid: boolean;
  errors: Partial<Record<'contactIds' | 'description' | 'date', string>>;
}

/** 驗證互動紀錄輸入（見 spec.md §5.3：描述必填，日期預設今天，需綁定至少一位聯絡人）。 */
export function validateInteraction(input: NewInteractionInput): InteractionValidationResult {
  const errors: InteractionValidationResult['errors'] = {};
  if (!input.contactIds || input.contactIds.length === 0) {
    errors.contactIds = 'at least one contact is required';
  }
  if (!input.description || input.description.trim().length === 0) {
    errors.description = 'description is required';
  }
  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    errors.date = 'date must be YYYY-MM-DD';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/** 依 §5.3 表單簡化原則：日期預設今天。回傳 YYYY-MM-DD（本地時區）。 */
export function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 無互動天數門檻（見 spec.md §5.6、§11.4），v1 所有聯絡人共用同一門檻，不因星級而異。
 * 必須跟 functions/src/index.ts 的 LONG_SILENCE_DAYS 保持一致（後端目前沒有共用套件可 import，僅能人工同步）。
 */
export const LONG_SILENCE_DAYS = 60;

/** 依互動紀錄算出每位聯絡人最近一次互動日期，供 §11.4 列表久未聯絡色彩警示使用。 */
export function latestInteractionDateByContactId(interactions: Interaction[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const interaction of interactions) {
    for (const contactId of interaction.contactIds) {
      const current = map.get(contactId);
      if (!current || interaction.date > current) {
        map.set(contactId, interaction.date);
      }
    }
  }
  return map;
}

/** 見 spec.md §5.6：僅在「有過互動但已超過門檻天數」時視為久未聯絡；從未互動過的聯絡人不計入（比照後端主動提醒規則）。 */
export function isLongSilence(latestInteractionDate: string | undefined, todayIso: string): boolean {
  if (!latestInteractionDate) return false;
  const older = new Date(`${latestInteractionDate}T00:00:00.000Z`);
  const newer = new Date(`${todayIso}T00:00:00.000Z`);
  const days = Math.floor((newer.getTime() - older.getTime()) / 86400000);
  return days >= LONG_SILENCE_DAYS;
}

/** 依日期新到舊排序，取前 limit 筆，供首頁「最近的互動紀錄」使用。 */
export function recentInteractions(interactions: Interaction[], limit = 5): Interaction[] {
  return [...interactions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    .slice(0, limit);
}
