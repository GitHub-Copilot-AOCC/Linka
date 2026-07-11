// 對照 spec.md §5.5 項目1「名片 OCR」。純 TypeScript：組 prompt 與解析 AI 回應，不依賴任何平台 API。

export interface BusinessCardFields {
  name: string;
  role?: string;
  company?: string;
  phone?: string;
  email?: string;
}

/** 正規化座標框（0–1，相對於整張照片的寬高），x0/y0 為左上角、x1/y1 為右下角。 */
export interface NormalizedBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface BusinessCardScanResult {
  fields: BusinessCardFields;
  /** 名片本身（不含背景）在照片中的範圍，供裁切成「名片全圖」使用；沒偵測到或框不合理時為 undefined。 */
  cardBoundingBox?: NormalizedBox;
  /** 名片上印刷的人像照片範圍（若有），供額外裁成大頭照使用；沒有印人像照片時為 undefined。 */
  personPhotoBoundingBox?: NormalizedBox;
}

export const BUSINESS_CARD_EXTRACTION_PROMPT = `這是一張名片的照片，請從中辨識出以下欄位並以 JSON 物件回傳：
{"name": string, "role": string, "company": string, "phone": string, "email": string,
 "cardBoundingBox": {"x0": number, "y0": number, "x1": number, "y1": number},
 "personPhotoBoundingBox": {"x0": number, "y0": number, "x1": number, "y1": number} | null}

規則：
- name 為必填，其餘文字欄位辨識不到就回傳空字串 ""
- 電話號碼保留原始格式（含國碼、分機等），不要自行改寫
- cardBoundingBox：這張照片中「名片本身」（不含桌面、手指、背景）所占的矩形範圍，用正規化座標
  （0 到 1 之間的浮點數，x0/y0 為左上角、x1/y1 為右下角，相對於整張照片的寬高）表示；如果整張照片
  幾乎就是名片本身、沒有明顯背景，範圍可以接近 {"x0":0,"y0":0,"x1":1,"y1":1}；這個欄位一定要給出
  合理估計值，不要留 null
- personPhotoBoundingBox：如果名片上印有一張人像照片（例如常見的大頭照名片），給出那張照片在整張
  照片中的正規化座標範圍；如果名片上沒有印人像照片，回傳 null，絕對不可憑空生成
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

/**
 * 驗證並正規化一個座標框；框缺欄位、數值不合理（反轉、超出範圍太多）或小到不像是有意義的
 * 裁切範圍時一律回傳 undefined，讓呼叫端整個退回用未裁切的原圖，不擋名片掃描流程。
 */
function parseBox(raw: unknown): NormalizedBox | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { x0, y0, x1, y1 } = raw as Record<string, unknown>;
  if (typeof x0 !== 'number' || typeof y0 !== 'number' || typeof x1 !== 'number' || typeof y1 !== 'number') {
    return undefined;
  }

  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const box: NormalizedBox = { x0: clamp(x0), y0: clamp(y0), x1: clamp(x1), y1: clamp(y1) };
  const width = box.x1 - box.x0;
  const height = box.y1 - box.y0;
  // 框太小或反轉（x1<=x0、y1<=y0）都當作沒偵測到，避免裁出空白或無意義的照片。
  if (width < 0.05 || height < 0.05) return undefined;
  return box;
}

/** 解析名片掃描的完整結果（欄位 + 兩個裁切用座標框），供 BusinessCardScanDialog 使用。 */
export function parseBusinessCardScanResult(raw: unknown): BusinessCardScanResult | null {
  const fields = parseBusinessCardFields(raw);
  if (!fields) return null;
  const data = raw as Record<string, unknown>;
  return {
    fields,
    cardBoundingBox: parseBox(data.cardBoundingBox),
    personPhotoBoundingBox: parseBox(data.personPhotoBoundingBox),
  };
}
