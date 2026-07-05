// 型別與驗證邏輯對照 spec.md §7 資料模型。純 TypeScript，不依賴任何平台 API。

export type ContactSource = 'manual' | 'google_import' | 'vcard_import' | 'doc_import' | 'ocr';

export interface ContactPhoto {
  url: string;
  source: 'upload' | 'web_search';
  sourceUrl?: string;
  addedAt: number; // epoch ms
}

export interface Contact {
  id: string;
  name: string;
  role?: string;
  company?: string;
  phone?: string;
  email?: string;
  birthday?: string; // YYYY-MM-DD
  linkedin?: string;
  facebook?: string;
  twitter?: string;
  notes?: string;
  tags?: string[];
  importance: 1 | 2 | 3 | 4 | 5;
  photos?: ContactPhoto[];
  nextContactReminder?: string; // ISO date
  source?: ContactSource;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_IMPORTANCE: Contact['importance'] = 3;
export const MAX_PHOTOS_PER_CONTACT = 5;

export type NewContactInput = Omit<
  Contact,
  'id' | 'importance' | 'createdAt' | 'updatedAt' | 'photos'
> & {
  importance?: Contact['importance'];
};

export interface ValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof Contact, string>>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 驗證聯絡人輸入欄位（見 spec.md §5.2）。姓名為必填，其他欄位選填但格式需正確。 */
export function validateContact(input: NewContactInput): ValidationResult {
  const errors: ValidationResult['errors'] = {};

  if (!input.name || input.name.trim().length === 0) {
    errors.name = 'name is required';
  }

  if (input.email && !EMAIL_RE.test(input.email)) {
    errors.email = 'email format is invalid';
  }

  if (input.birthday && !/^\d{4}-\d{2}-\d{2}$/.test(input.birthday)) {
    errors.birthday = 'birthday must be YYYY-MM-DD';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** 移除值為 undefined 的欄位，Firestore 的 addDoc/setDoc 遇到 undefined 欄位值會直接拋錯。 */
function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as T;
  for (const key of Object.keys(obj) as Array<keyof T>) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
}

/** 建立新聯絡人時套用預設值（星級預設 3，見 spec.md §5.2）。 */
export function applyContactDefaults(input: NewContactInput): Omit<Contact, 'id'> {
  const now = Date.now();
  return omitUndefined({
    ...input,
    importance: input.importance ?? DEFAULT_IMPORTANCE,
    createdAt: now,
    updatedAt: now,
  });
}
