// 對照 spec.md §5.5 項目4「建議話題」。純 TypeScript：組 prompt 與解析 AI 回應，不依賴任何平台 API。

import type { Contact } from './contact';
import type { Interaction } from './interaction';

export interface TopicSuggestion {
  topic: string;
  reason: string;
}

export const MAX_TOPIC_SUGGESTIONS = 3;
export const MAX_RECENT_INTERACTIONS_IN_PROMPT = 5;

const SYSTEM_INSTRUCTION = `你是 Linka 個人人脈管理 App 的 AI 助手。使用者會提供一位聯絡人的基本資料與最近互動紀錄，
請根據這些資訊，產生 ${MAX_TOPIC_SUGGESTIONS} 個適合下次見面或聯絡時聊的話題建議（破冰或延續話題皆可）。

規則：
- 只能回傳 JSON 陣列，陣列長度固定為 ${MAX_TOPIC_SUGGESTIONS}，每個元素為 {"topic": string, "reason": string}
- topic 為簡短的話題本身（例如「詢問新專案進度」），reason 為一句話說明為何適合聊這個話題
- 全部使用繁體中文
- 若可用資訊很少（例如沒有互動紀錄），仍需根據職稱/公司等現有欄位給出合理的通用建議，不可回傳空陣列`;

/** 依聯絡人與最近互動紀錄組出送給 Gemini 的 prompt 與 systemInstruction。 */
export function buildTopicSuggestionPrompt(
  contact: Contact,
  interactions: Interaction[]
): { prompt: string; systemInstruction: string } {
  const recentInteractions = [...interactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_RECENT_INTERACTIONS_IN_PROMPT)
    .map((i) => `- ${i.date}（${i.type}）：${i.description}`)
    .join('\n');

  const profileLines = [
    `姓名：${contact.name}`,
    contact.role ? `職稱：${contact.role}` : null,
    contact.company ? `公司：${contact.company}` : null,
    contact.notes ? `備註：${contact.notes}` : null,
  ].filter(Boolean);

  const prompt = `聯絡人資料：
${profileLines.join('\n')}

最近互動紀錄：
${recentInteractions || '（尚無互動紀錄）'}

請產生話題建議。`;

  return { prompt, systemInstruction: SYSTEM_INSTRUCTION };
}

/** 解析 Cloud Function 回傳的原始資料，過濾格式不符的項目，並截斷至上限筆數。 */
export function parseTopicSuggestions(raw: unknown): TopicSuggestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is TopicSuggestion =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).topic === 'string' &&
        typeof (item as Record<string, unknown>).reason === 'string'
    )
    .slice(0, MAX_TOPIC_SUGGESTIONS);
}
