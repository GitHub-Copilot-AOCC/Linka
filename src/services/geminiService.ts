// AI 服務呼叫層（對照 spec.md §5.5、§5.3a、§8.5）：只呼叫 geminiProxy Cloud Function 端點，金鑰只存在後端。
// 使用全域 fetch（瀏覽器與 React Native 皆有內建實作），不屬於 DOM-only API，符合 README 分層規則。

import type { Contact } from '@domain/contact';
import type { Interaction } from '@domain/interaction';
import type { TopicSuggestion } from '@domain/topicSuggestion';
import { buildTopicSuggestionPrompt, parseTopicSuggestions } from '@domain/topicSuggestion';

export class GeminiServiceError extends Error {}

const FUNCTIONS_REGION = 'us-central1';

/**
 * 解析 geminiProxy 的端點網址。優先採用明確設定的 VITE_GEMINI_PROXY_URL（例如本機接 emulator 時覆寫），
 * 否則依 VITE_FIREBASE_PROJECT_ID 自動推導正式環境網址，避免每個環境都要手動填一次完整 URL。
 */
function proxyUrl(): string {
  const override = import.meta.env.VITE_GEMINI_PROXY_URL;
  if (override) return override;

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new GeminiServiceError('Missing VITE_GEMINI_PROXY_URL or VITE_FIREBASE_PROJECT_ID for geminiProxy');
  }
  return `https://${FUNCTIONS_REGION}-${projectId}.cloudfunctions.net/geminiProxy`;
}

async function callGeminiProxy<T>(action: string, payload: object): Promise<T> {
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

  return response.json() as Promise<T>;
}

/** 建議話題（見 spec.md §5.5 項目4、§5.5a）：回傳固定 3 則話題建議，不寫入任何資料。 */
export async function suggestTopics(contact: Contact, interactions: Interaction[]): Promise<TopicSuggestion[]> {
  const { prompt, systemInstruction } = buildTopicSuggestionPrompt(contact, interactions);
  const raw = await callGeminiProxy<unknown>('getSuggestedTopics', { prompt, systemInstruction });
  return parseTopicSuggestions(raw);
}

// --- §5.3a AI 語音／自然語言快速記錄 ---

export type QuickCaptureConfidence = 'high' | 'medium' | 'low';
export type QuickCaptureInteractionType = 'meeting' | 'call' | 'email';

export interface QuickCaptureContactMatch {
  referenceId: string;
  matchedContactIds: string[];
  suggestedNewContactName?: string;
  confidence: QuickCaptureConfidence;
  reason: string;
}

export interface QuickCaptureInteractionSuggestion {
  contactReferenceIds: string[];
  type: QuickCaptureInteractionType;
  date: string;
  description: string;
  rawInput?: string;
}

export interface QuickCaptureReminderSuggestion {
  contactReferenceId: string;
  suggestedDate: string;
  reason: string;
}

export interface QuickCaptureImportanceSuggestion {
  contactReferenceId: string;
  suggestedImportance: 1 | 2 | 3 | 4 | 5;
  reason: string;
}

export interface QuickCapturePreview {
  summary: string;
  contactMatches: QuickCaptureContactMatch[];
  suggestedInteractions: QuickCaptureInteractionSuggestion[];
  reminderSuggestions: QuickCaptureReminderSuggestion[];
  importanceSuggestions: QuickCaptureImportanceSuggestion[];
}

interface ParseQuickCapturePayload {
  textInput?: string;
  audioBase64?: string;
  audioMimeType?: string;
  existingContacts: Array<
    Pick<Contact, 'id' | 'name' | 'company' | 'role' | 'importance' | 'nextContactReminder' | 'birthday'>
  >;
  today: string;
}

/** 語音／文字快速記錄解析（見 spec.md §5.3a）：只回傳預覽，不寫入任何資料，需使用者確認後才落地。 */
export async function parseQuickCapturePreview(payload: ParseQuickCapturePayload): Promise<QuickCapturePreview> {
  return callGeminiProxy<QuickCapturePreview>('parseQuickCapturePreview', payload);
}
