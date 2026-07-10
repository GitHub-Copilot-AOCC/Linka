// 型別與驗證邏輯對照 spec.md §7 資料模型。純 TypeScript，不依賴任何平台 API。

export type ContactSource = 'manual' | 'google_import' | 'vcard_import' | 'doc_import' | 'ocr';

export interface ContactPhoto {
  url: string;
  source: 'upload' | 'web_search';
  sourceUrl?: string;
  addedAt: number; // epoch ms
}

// 網路身分研究摘要的一筆紀錄（見 spec.md §5.8、§7）。持續累加，不覆蓋舊紀錄。
// 本次僅實作文字摘要子功能；照片搜尋子功能（PhotoCandidate）需要額外的圖片搜尋
// API/憑證，故此處不包含 candidatePhotos 欄位。
export interface ResearchEntry {
  id: string;
  summary: string; // AI 產生的摘要文章內容（查無資料時為明確的「查無相關資料」訊息）
  sourceUrls: string[]; // 摘要所引用的來源網址
  createdAt: number; // epoch ms，用於呈現時間軸
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
  researchLog?: ResearchEntry[]; // 網路身分研究摘要歷史（見 spec.md §5.8），持續累加、不覆蓋
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

/** 待處理提醒：nextContactReminder 已設定且不晚於今天（見 spec.md §5.4）。 */
export function isReminderDue(contact: Contact, todayDateString: string): boolean {
  return Boolean(contact.nextContactReminder) && contact.nextContactReminder! <= todayDateString;
}

/** 依提醒日期排序（早到晚），供首頁待辦清單使用。 */
export function sortByReminderDate(contacts: Contact[]): Contact[] {
  return [...contacts].sort((a, b) => (a.nextContactReminder ?? '').localeCompare(b.nextContactReminder ?? ''));
}

/** 關鍵字搜尋（見 spec.md §5.2：姓名/公司/職稱），不分大小寫、忽略前後空白。 */
export function filterContactsByKeyword(contacts: Contact[], keyword: string): Contact[] {
  const trimmed = keyword.trim().toLowerCase();
  if (!trimmed) return contacts;
  return contacts.filter((c) =>
    [c.name, c.company, c.role].some((field) => field?.toLowerCase().includes(trimmed))
  );
}

/**
 * 找出姓名完全相同（去除前後空白、不分大小寫）的既有聯絡人，供新增聯絡人時提醒使用者
 * 「已經有同名的人了，是同一位嗎？」（見使用者回報的 corner case）。刻意只警示不擋，
 * 因為真的同名同姓的不同人是合理情境（vCard/文件匯入的重複偵測則額外比對電話/Email）。
 */
export function findContactsByName(contacts: Contact[], name: string): Contact[] {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return [];
  return contacts.filter((c) => c.name.trim().toLowerCase() === trimmed);
}

/** 依社交圈標籤篩選（見 spec.md §5.2）。tagId 為 null/undefined 時不篩選。 */
export function filterContactsByTag(contacts: Contact[], tagId: string | null): Contact[] {
  if (!tagId) return contacts;
  return contacts.filter((c) => c.tags?.includes(tagId));
}

export type ContactSortBy = 'name' | 'importance';

/** 列表排序：依姓名字母（預設）或依星級（高到低）。見 spec.md §5.2。 */
export function sortContacts(contacts: Contact[], sortBy: ContactSortBy): Contact[] {
  if (sortBy === 'importance') {
    return [...contacts].sort((a, b) => b.importance - a.importance || a.name.localeCompare(b.name));
  }
  return [...contacts].sort((a, b) => a.name.localeCompare(b.name));
}

/** 依建立時間新到舊排序，取前 limit 筆，供首頁「最近新增的聯絡人」使用。 */
export function recentContacts(contacts: Contact[], limit = 5): Contact[] {
  return [...contacts].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

/** 過去 days 天內新增的聯絡人數量（供首頁/AI 助理儀表板的「最近新增」統計卡使用）。 */
export function countRecentlyAddedContacts(contacts: Contact[], days = 30): number {
  const threshold = Date.now() - days * 86400000;
  return contacts.filter((c) => c.createdAt >= threshold).length;
}

/** 本月壽星人數（依生日的月份比對，不管年份），供首頁/AI 助理儀表板的統計卡使用。 */
export function countBirthdaysThisMonth(contacts: Contact[], todayIso: string): number {
  const currentMonth = Number(todayIso.split('-')[1]);
  return contacts.filter((c) => {
    if (!c.birthday) return false;
    const month = Number(c.birthday.split('-')[1]);
    return month === currentMonth;
  }).length;
}

/** 重要聯絡人（星級 >= 4）人數，供首頁/AI 助理儀表板的統計卡使用。 */
export function countImportantContacts(contacts: Contact[]): number {
  return contacts.filter((c) => c.importance >= 4).length;
}

export interface UpcomingBirthday {
  contact: Contact;
  daysUntil: number;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * 2/29 生日在非閏年沒有對應日期，比照常見慣例算在 2/28（見使用者回報的 corner case：
 * 原本直接丟給 Date.UTC 會溢位變成 3/1，讓提醒日期整整差一天）。
 */
function resolveBirthdayDateInYear(month: number, day: number, year: number): Date {
  const adjustedDay = month === 2 && day === 29 && !isLeapYear(year) ? 28 : day;
  return new Date(Date.UTC(year, month - 1, adjustedDay));
}

/**
 * 未來 windowDays 天內（含今天）即將到來的生日，供首頁唯讀預覽清單使用。
 * 與 §5.6 AI 主動提醒（生日前 3 天才建立建議）是分開的兩個功能，這裡是範圍更廣的預覽。
 */
export function upcomingBirthdays(contacts: Contact[], todayIso: string, windowDays = 14): UpcomingBirthday[] {
  const today = new Date(`${todayIso}T00:00:00.000Z`);
  const result: UpcomingBirthday[] = [];

  for (const contact of contacts) {
    if (!contact.birthday) continue;
    const [, month, day] = contact.birthday.split('-').map(Number);
    let next = resolveBirthdayDateInYear(month, day, today.getUTCFullYear());
    if (next.getTime() < today.getTime()) {
      next = resolveBirthdayDateInYear(month, day, today.getUTCFullYear() + 1);
    }
    const daysUntil = Math.round((next.getTime() - today.getTime()) / 86400000);
    if (daysUntil <= windowDays) {
      result.push({ contact, daysUntil });
    }
  }

  return result.sort((a, b) => a.daysUntil - b.daysUntil);
}
