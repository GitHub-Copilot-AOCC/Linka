// AI 服務呼叫層（對照 spec.md §5.5、§8.5）：只呼叫 geminiProxy Cloud Function 端點，金鑰只存在後端。
// 使用全域 fetch（瀏覽器與 React Native 皆有內建實作），不屬於 DOM-only API，符合 README 分層規則。

import type { Contact } from '@domain/contact';
import type { Interaction } from '@domain/interaction';
import type { TopicSuggestion } from '@domain/topicSuggestion';
import { buildTopicSuggestionPrompt, parseTopicSuggestions } from '@domain/topicSuggestion';
import type { BusinessCardFields } from '@domain/businessCard';
import { BUSINESS_CARD_EXTRACTION_PROMPT, parseBusinessCardFields } from '@domain/businessCard';

export class GeminiServiceError extends Error {}

function proxyUrl(): string {
  const url = import.meta.env.VITE_GEMINI_PROXY_URL;
  if (!url) {
    throw new GeminiServiceError('VITE_GEMINI_PROXY_URL is not configured');
  }
  return url;
}

async function callGeminiProxy(action: string, payload: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(proxyUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}) as Record<string, unknown>);
    const message = typeof body.error === 'string' ? body.error : `geminiProxy request failed (${response.status})`;
    throw new GeminiServiceError(message);
  }

  return response.json();
}

/** 建議話題（見 spec.md §5.5 項目4、§5.5a）：回傳固定 3 則話題建議，不寫入任何資料。 */
export async function suggestTopics(contact: Contact, interactions: Interaction[]): Promise<TopicSuggestion[]> {
  const { prompt, systemInstruction } = buildTopicSuggestionPrompt(contact, interactions);
  const raw = await callGeminiProxy('getSuggestedTopics', { prompt, systemInstruction });
  return parseTopicSuggestions(raw);
}

/** 名片 OCR（見 spec.md §5.5 項目1）：回傳辨識出的欄位供使用者確認，不寫入任何資料。 */
export async function scanBusinessCard(base64Data: string, mimeType: string): Promise<BusinessCardFields | null> {
  const raw = await callGeminiProxy('extractContactFromCard', {
    base64Data,
    mimeType,
    prompt: BUSINESS_CARD_EXTRACTION_PROMPT,
  });
  return parseBusinessCardFields(raw);
}
