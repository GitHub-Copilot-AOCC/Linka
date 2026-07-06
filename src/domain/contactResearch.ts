// 對照 spec.md §5.8「聯絡人網路身分研究摘要」（文字摘要子功能）。純 TypeScript：組 prompt 與
// 解析 Cloud Function 回應，不依賴任何平台 API。照片搜尋子功能（PhotoCandidate）需要額外的
// 圖片搜尋 API/憑證，本次不實作，故此處不處理任何照片相關欄位。

import type { Contact, ResearchEntry } from './contact';

export const NO_RESULTS_MARKER = '查無相關資料';

const SYSTEM_INSTRUCTION = `你是 Linka 個人人脈管理 App 的 AI 助手，負責使用 Google 搜尋工具查找一位聯絡人的公開網路資訊
（例如現職公司、職稱異動、公開發表的新聞或文章、公開的專業背景介紹等），並整理成一篇簡短摘要。

規則：
- 全部使用繁體中文撰寫摘要
- 只根據搜尋工具實際查到的公開資訊撰寫，絕對不可憑空捏造或用一般常識腦補內容；如果搜尋不到與這位聯絡人高度相關、有足夠信心的公開資訊，
  必須直接回覆「${NO_RESULTS_MARKER}」，不要輸出其他內容
- 若同名同姓的人很多、無法確定搜尋結果是否為同一人，也視為查無相關資料，回覆「${NO_RESULTS_MARKER}」
- 摘要內容應聚焦在對人脈經營有幫助的資訊（職涯異動、公開活動、發表文章等），避免無關的八卦或隱私細節
- 摘要完成後，另起一行，以「來源：」開頭，逐行列出你實際查詢到並引用的完整網址（每行一個網址），供使用者自行查證；
  若回覆「${NO_RESULTS_MARKER}」則不需要來源清單`;

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

export interface ContactResearchResult {
  summary: string;
  sourceUrls: string[];
  noResultsFound: boolean;
}

/** 解析 Cloud Function 回傳的原始資料，判斷是否查無資料，並整理來源網址清單。 */
export function parseContactResearchResult(raw: unknown): ContactResearchResult {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
  const sourceUrls = Array.isArray(obj.sourceUrls)
    ? obj.sourceUrls.filter((u): u is string => typeof u === 'string' && u.length > 0)
    : [];

  const noResultsFound = summary.length === 0 || summary.includes(NO_RESULTS_MARKER);

  return {
    summary: noResultsFound ? NO_RESULTS_MARKER : summary,
    sourceUrls: noResultsFound ? [] : sourceUrls,
    noResultsFound,
  };
}

/** 將解析後的研究結果包裝成可附加到 Contact.researchLog 的新紀錄（見 spec.md §7）。 */
export function createResearchEntry(result: ContactResearchResult): ResearchEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    summary: result.summary,
    sourceUrls: result.sourceUrls,
    createdAt: Date.now(),
  };
}

/** 依時間排序，最新的研究紀錄在前（見 spec.md §5.8「持續累積」需求）。 */
export function sortResearchLogNewestFirst(log: ResearchEntry[]): ResearchEntry[] {
  return [...log].sort((a, b) => b.createdAt - a.createdAt);
}
