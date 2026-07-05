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
