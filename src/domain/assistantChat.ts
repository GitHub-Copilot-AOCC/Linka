// 對照 spec.md §5.5a「AI 個人秘書 — 問答模式」與 §8.5 檢索策略。純 TypeScript：
// 組兩階段（查詢規劃 → 生成回答）prompt、解析 AI 回應，不依賴任何平台 API。
//
// 設計理由（見 spec.md §5.5a）：v1 聯絡人數量無上限，不可能把所有聯絡人完整資料塞進每次
// AI 呼叫的 prompt。因此採「先查詢、後生成」兩階段：
//   1. planContactQuery：把使用者問題 + 一份「輕量」聯絡人清單（僅姓名/公司/職稱）交給 Gemini，
//      判斷哪些聯絡人可能相關，回傳姓名/關鍵字線索。
//   2. 前端依線索對 Firestore 做範圍查詢，撈出這些聯絡人的完整資料（含互動紀錄）。
//   3. answerContactQuestion：把問題 + 撈出的子集交給 Gemini 生成最終回答，並要求註明引用來源。

import type { Contact } from './contact';
import type { Interaction } from './interaction';

/** 查詢規劃階段用的輕量聯絡人摘要，刻意不含電話/Email/備註等完整欄位，控制 prompt 大小。 */
export interface ContactLite {
  id: string;
  name: string;
  company?: string;
  role?: string;
}

export interface ContactQueryPlan {
  /** Gemini 判斷可能相關的聯絡人姓名（與 ContactLite.name 比對用） */
  relevantNames: string[];
  /** Gemini 判斷的關鍵字（公司名、職稱、主題等），供欄位比對 fallback 使用 */
  keywords: string[];
  /** 是否為「泛用問題」（例如列出所有久未聯絡的人），此時前端可退回全量查詢而非僅用姓名比對 */
  needsFullScan: boolean;
}

export interface AssistantAnswer {
  answer: string;
  /** 回答所引用的來源，至少須註明聯絡人姓名，互動日期為選填（見 spec.md §5.5a「須註明資訊來源」） */
  citations: AssistantCitation[];
}

export interface AssistantCitation {
  contactName: string;
  interactionDate?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  citations?: AssistantCitation[];
}

const PLAN_SYSTEM_INSTRUCTION = `你是 Linka 個人人脈管理 App 的 AI 秘書查詢規劃器。
使用者會提出一個關於自己人脈資料庫的問題，並附上目前所有聯絡人的「輕量清單」（僅含姓名、公司、職稱，不含詳細資料）。
你的任務不是回答問題，而是判斷「回答這個問題需要查詢哪些聯絡人」。

規則：
- 只能回傳 JSON 物件：{"relevantNames": string[], "keywords": string[], "needsFullScan": boolean}
- relevantNames：從提供的聯絡人清單中，挑出姓名與問題明確相關的聯絡人姓名（例如問題提到人名時）
- keywords：從問題中萃取的關鍵字（例如公司名、職稱、產業、話題），用於欄位比對輔助篩選
- needsFullScan：若問題本質上需要掃描「全部」聯絡人才能回答（例如「幫我列出所有超過 60 天沒聯絡的人」「我最重要的朋友有誰最近沒聯絡」這類需要比較全體才能回答的問題），設為 true；若問題明確指向特定的人或條件，設為 false
- 找不到任何明確相關聯絡人時，relevantNames 回傳空陣列即可，不要亂猜
- 全部使用繁體中文`;

const ANSWER_SYSTEM_INSTRUCTION = `你是 Linka 個人人脈管理 App 的 AI 秘書。使用者會提出一個關於人脈資料庫的問題，
並附上一份「已篩選過的相關聯絡人資料子集」（含基本資料、互動紀錄）。請僅根據提供的資料回答，不可憑空捏造未提供的資訊。

規則：
- 只能回傳 JSON 物件：{"answer": string, "citations": [{"contactName": string, "interactionDate": string}]}
- answer 為完整的回答內容，全部使用繁體中文
- citations 必須列出回答所依據的聯絡人姓名；若引用了特定互動紀錄，附上該筆互動的日期（YYYY-MM-DD），否則 interactionDate 可省略
- 若提供的資料子集中找不到足以回答問題的資訊，answer 需誠實說明「目前資料中查無相關資訊」，citations 回傳空陣列，不可編造答案
- 若使用者問「下次該聊什麼」等建議性問題，可結合聯絡人職稱/公司/過往互動給出合理建議，並註明依據的聯絡人`;

/** 組查詢規劃階段（第一階段）的 prompt。輕量聯絡人清單刻意只含姓名/公司/職稱，控制 prompt 大小。 */
export function buildQueryPlanPrompt(
  question: string,
  contacts: ContactLite[]
): { prompt: string; systemInstruction: string } {
  const listText = contacts
    .map((c) => `- ${c.name}${c.company ? `｜${c.company}` : ''}${c.role ? `｜${c.role}` : ''}`)
    .join('\n');

  const prompt = `使用者問題：${question}

目前所有聯絡人（僅姓名/公司/職稱）：
${listText || '（目前沒有任何聯絡人）'}

請輸出查詢規劃 JSON。`;

  return { prompt, systemInstruction: PLAN_SYSTEM_INSTRUCTION };
}

/** 解析第一階段查詢規劃的回應。格式不符時回傳保守的「需要全量掃描」規劃，避免遺漏相關聯絡人。 */
export function parseQueryPlan(raw: unknown): ContactQueryPlan {
  const fallback: ContactQueryPlan = { relevantNames: [], keywords: [], needsFullScan: true };
  if (typeof raw !== 'object' || raw === null) return fallback;
  const data = raw as Record<string, unknown>;

  const relevantNames = Array.isArray(data.relevantNames)
    ? data.relevantNames.filter((v): v is string => typeof v === 'string')
    : [];
  const keywords = Array.isArray(data.keywords)
    ? data.keywords.filter((v): v is string => typeof v === 'string')
    : [];
  const needsFullScan = typeof data.needsFullScan === 'boolean' ? data.needsFullScan : relevantNames.length === 0;

  return { relevantNames, keywords, needsFullScan };
}

export const MAX_CONTACTS_IN_ANSWER_CONTEXT = 15;
export const MAX_INTERACTIONS_PER_CONTACT_IN_CONTEXT = 8;

/**
 * 依查詢規劃結果，從完整聯絡人清單中挑出相關子集（見 spec.md §5.5a 第 2 步：
 * 「用該線索對 Firestore 做範圍查詢」）。此函式操作記憶體中的陣列，實際 Firestore
 * 範圍查詢由 data 層負責；此處純粹是規劃結果 → 挑選子集的比對邏輯，屬於 domain 規則。
 */
export function selectRelevantContacts(contacts: Contact[], plan: ContactQueryPlan): Contact[] {
  if (plan.needsFullScan) {
    return contacts.slice(0, MAX_CONTACTS_IN_ANSWER_CONTEXT);
  }

  const lowerNames = plan.relevantNames.map((n) => n.toLowerCase());
  const lowerKeywords = plan.keywords.map((k) => k.toLowerCase());

  const matches = contacts.filter((c) => {
    const name = c.name.toLowerCase();
    if (lowerNames.some((n) => name.includes(n) || n.includes(name))) return true;
    const haystack = [c.company, c.role, c.notes].filter(Boolean).join(' ').toLowerCase();
    return lowerKeywords.some((k) => k.length > 0 && haystack.includes(k));
  });

  return matches.slice(0, MAX_CONTACTS_IN_ANSWER_CONTEXT);
}

/** 組生成回答階段（第二階段）的 prompt，僅包含篩選後的聯絡人子集，控制 prompt 大小。 */
export function buildAnswerPrompt(
  question: string,
  contacts: Contact[],
  interactionsByContactId: Record<string, Interaction[]>
): { prompt: string; systemInstruction: string } {
  const contactBlocks = contacts.map((c) => {
    const interactions = (interactionsByContactId[c.id] ?? [])
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, MAX_INTERACTIONS_PER_CONTACT_IN_CONTEXT)
      .map((i) => `  - ${i.date}（${i.type}）：${i.description}`)
      .join('\n');

    const profileLines = [
      `姓名：${c.name}`,
      c.role ? `職稱：${c.role}` : null,
      c.company ? `公司：${c.company}` : null,
      c.notes ? `備註：${c.notes}` : null,
      `重要性星級：${c.importance}`,
      c.nextContactReminder ? `下次聯絡提醒：${c.nextContactReminder}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    return `【聯絡人：${c.name}】\n${profileLines}\n互動紀錄：\n${interactions || '  （尚無互動紀錄）'}`;
  });

  const prompt = `使用者問題：${question}

相關聯絡人資料：
${contactBlocks.join('\n\n') || '（查無相關聯絡人資料）'}

請輸出回答 JSON。`;

  return { prompt, systemInstruction: ANSWER_SYSTEM_INSTRUCTION };
}

/** 解析第二階段生成回答的回應。 */
export function parseAssistantAnswer(raw: unknown): AssistantAnswer {
  const fallbackText = '目前資料中查無相關資訊。';
  if (typeof raw !== 'object' || raw === null) {
    return { answer: fallbackText, citations: [] };
  }
  const data = raw as Record<string, unknown>;
  const answer = typeof data.answer === 'string' && data.answer.trim() ? data.answer : fallbackText;

  const citations: AssistantCitation[] = Array.isArray(data.citations)
    ? data.citations
        .filter(
          (item): item is Record<string, unknown> =>
            typeof item === 'object' && item !== null && typeof (item as Record<string, unknown>).contactName === 'string'
        )
        .map((item) => ({
          contactName: item.contactName as string,
          interactionDate: typeof item.interactionDate === 'string' ? item.interactionDate : undefined,
        }))
    : [];

  return { answer, citations };
}

/** 將聯絡人清單轉為查詢規劃階段用的輕量摘要（見 ContactLite）。 */
export function toContactLite(contacts: Contact[]): ContactLite[] {
  return contacts.map((c) => ({ id: c.id, name: c.name, company: c.company, role: c.role }));
}
