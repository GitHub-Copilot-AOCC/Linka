// 對照 spec.md §5.8「聯絡人網路身分研究摘要」（文字摘要子功能）。純 TypeScript：組 prompt 與
// 解析 Cloud Function 回應，不依賴任何平台 API。照片搜尋子功能（PhotoCandidate）需要額外的
// 圖片搜尋 API/憑證，本次不實作，故此處不處理任何照片相關欄位。

import type { Contact, ResearchEntry } from './contact';

export const NO_RESULTS_MARKER = '查無相關資料';

// 摘要文字裡用來夾帶結構化欄位的標記——Cloud Function 端（functions/src/index.ts 的
// researchContactProfile）是通用轉發層，沒有用 responseMimeType:'application/json'
// 強制 JSON 輸出（跟 googleSearch grounding 工具搭配使用不保證相容），所以延續現有
// 「文字裡加一段標記、事後解析」的模式（跟摘要文字後面的「來源：」網址清單是同一套做法）。
const EXTRACTED_FIELDS_MARKER = '[EXTRACTED_FIELDS]';

const SYSTEM_INSTRUCTION = `你是 Linka 個人人脈管理 App 的 AI 助手，負責使用 Google 搜尋工具查找一位聯絡人的公開網路資訊
（例如現職公司、職稱異動、公開發表的新聞或文章、公開的專業背景介紹等），並整理成一篇簡短摘要。

規則：
- 全部使用繁體中文撰寫摘要
- 只根據搜尋工具實際查到的公開資訊撰寫，絕對不可憑空捏造或用一般常識腦補內容；如果搜尋不到與這位聯絡人高度相關、有足夠信心的公開資訊，
  必須直接回覆「${NO_RESULTS_MARKER}」，不要輸出其他內容
- 若同名同姓的人很多、無法確定搜尋結果是否為同一人，也視為查無相關資料，回覆「${NO_RESULTS_MARKER}」
- 摘要內容應聚焦在對人脈經營有幫助的資訊（職涯異動、公開活動、發表文章等），避免無關的八卦或隱私細節
- 除了一般的 Google 搜尋，也要主動嘗試搜尋這個人在 LinkedIn、Facebook 上的公開個人檔案（例如用
  site:linkedin.com、site:facebook.com 之類的搜尋詞），確認是否為同一人後，優先參考這些平台上公開列出的
  職稱、公司等資訊
- 摘要完成後，另起一行，以「來源：」開頭，逐行列出你實際查詢到並引用的完整網址（每行一個網址），供使用者自行查證；
  若回覆「${NO_RESULTS_MARKER}」則不需要來源清單
- 接著另起一行，以「${EXTRACTED_FIELDS_MARKER}」開頭，輸出一段 JSON（不要用 markdown code fence 包住），
  格式為 {"role":"","company":"","linkedin":"","facebook":"","twitter":"","birthday":""}，填入你在搜尋
  過程中從可信來源（尤其是 LinkedIn/Facebook 本人頁面）確認找到的欄位值；birthday 請用 YYYY-MM-DD 格式，
  只有明確查到完整生日時才填，只查到月日或需要猜測都留空；找不到、不確定、或需要猜測的欄位一律留空字串，
  絕對不可編造；若回覆「${NO_RESULTS_MARKER}」則不需要這個區塊`;

/** 依聯絡人已知資訊組出送給 Gemini 的搜尋 prompt 與 systemInstruction。 */
export function buildContactResearchPrompt(contact: Contact): { prompt: string; systemInstruction: string } {
  const profileLines = [
    `姓名：${contact.name}`,
    contact.role ? `職稱：${contact.role}` : null,
    contact.company ? `公司：${contact.company}` : null,
  ].filter(Boolean);

  const prompt = `請搜尋以下這位聯絡人的公開網路資訊，並依系統指示的規則產生摘要：
${profileLines.join('\n')}`;

  return { prompt, systemInstruction: SYSTEM_INSTRUCTION };
}

export type ExtractedContactFields = Partial<
  Pick<Contact, 'role' | 'company' | 'linkedin' | 'facebook' | 'twitter' | 'birthday'>
>;

export interface ContactResearchResult {
  summary: string;
  sourceUrls: string[];
  extractedFields: ExtractedContactFields;
  noResultsFound: boolean;
}

const EXTRACTABLE_KEYS = ['role', 'company', 'linkedin', 'facebook', 'twitter', 'birthday'] as const;

/** 把 [EXTRACTED_FIELDS] 標記跟後面的 JSON 從摘要文字中切出來，解析失敗就當作沒找到，
 *  不影響摘要本身正常顯示（跟現有 sourceUrls 解析失敗時的容錯邏輯是同一個精神）。 */
function extractStructuredFields(rawText: string): { cleanedText: string; extractedFields: ExtractedContactFields } {
  const markerIndex = rawText.indexOf(EXTRACTED_FIELDS_MARKER);
  if (markerIndex === -1) {
    return { cleanedText: rawText, extractedFields: {} };
  }

  const cleanedText = rawText.slice(0, markerIndex).trim();
  const jsonPart = rawText.slice(markerIndex + EXTRACTED_FIELDS_MARKER.length).trim();

  try {
    const parsed = JSON.parse(jsonPart) as Record<string, unknown>;
    const extractedFields: ExtractedContactFields = {};
    for (const key of EXTRACTABLE_KEYS) {
      const value = parsed[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        extractedFields[key] = value.trim();
      }
    }
    return { cleanedText, extractedFields };
  } catch {
    return { cleanedText, extractedFields: {} };
  }
}

/** 解析 Cloud Function 回傳的原始資料，判斷是否查無資料，整理來源網址清單跟可能的欄位補全建議。 */
export function parseContactResearchResult(raw: unknown): ContactResearchResult {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const rawSummary = typeof obj.summary === 'string' ? obj.summary : '';
  const { cleanedText, extractedFields } = extractStructuredFields(rawSummary);
  const summary = cleanedText.trim();

  const sourceUrls = Array.isArray(obj.sourceUrls)
    ? obj.sourceUrls.filter((u): u is string => typeof u === 'string' && u.length > 0)
    : [];

  const noResultsFound = summary.length === 0 || summary.includes(NO_RESULTS_MARKER);

  return {
    summary: noResultsFound ? NO_RESULTS_MARKER : summary,
    sourceUrls: noResultsFound ? [] : sourceUrls,
    extractedFields: noResultsFound ? {} : extractedFields,
    noResultsFound,
  };
}

/** 將解析後的研究結果包裝成可附加到 Contact.researchLog 的新紀錄（見 spec.md §7）。 */
export function createResearchEntry(result: ContactResearchResult): ResearchEntry {
  const hasExtractedFields = Object.keys(result.extractedFields).length > 0;
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    summary: result.summary,
    sourceUrls: result.sourceUrls,
    createdAt: Date.now(),
    extractedFields: hasExtractedFields ? result.extractedFields : undefined,
  };
}

/** 依時間排序，最新的研究紀錄在前（見 spec.md §5.8「持續累積」需求）。 */
export function sortResearchLogNewestFirst(log: ResearchEntry[]): ResearchEntry[] {
  return [...log].sort((a, b) => b.createdAt - a.createdAt);
}
