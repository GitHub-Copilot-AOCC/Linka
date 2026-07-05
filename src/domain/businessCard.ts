// 對照 spec.md §5.5 項目1「名片 OCR」。純 TypeScript：組 prompt 與解析 AI 回應，不依賴任何平台 API。

export interface BusinessCardFields {
  name: string;
  role?: string;
  company?: string;
  phone?: string;
  email?: string;
}

export const BUSINESS_CARD_EXTRACTION_PROMPT = `這是一張名片的照片，請從中辨識出以下欄位並以 JSON 物件回傳：
{"name": string, "role": string, "company": string, "phone": string, "email": string}

規則：
- name 為必填，其餘欄位辨識不到就回傳空字串 ""
- 電話號碼保留原始格式（含國碼、分機等），不要自行改寫
- 只回傳 JSON 物件本身，不要加上任何說明文字`;

/** 解析 Cloud Function 回傳的原始資料，過濾掉空字串欄位並確保至少有姓名。 */
export function parseBusinessCardFields(raw: unknown): BusinessCardFields | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const data = raw as Record<string, unknown>;
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name) return null;

  const clean = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  return {
    name,
    role: clean(data.role),
    company: clean(data.company),
    phone: clean(data.phone),
    email: clean(data.email),
  };
}
