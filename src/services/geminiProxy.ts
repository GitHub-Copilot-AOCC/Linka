import { isFirebaseConfigured } from '@data/firebase';
import type { Contact } from '@domain/contact';

type QuickCaptureConfidence = 'high' | 'medium' | 'low';
type QuickCaptureInteractionType = 'meeting' | 'call' | 'email';

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

const REGION = 'us-central1';

function getFunctionsBaseUrl(): string {
  const override = import.meta.env.VITE_FUNCTIONS_BASE_URL as string | undefined;
  if (override) {
    return override.replace(/\/$/, '');
  }

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  if (!projectId) {
    throw new Error('Missing VITE_FIREBASE_PROJECT_ID for geminiProxy');
  }

  return `https://${REGION}-${projectId}.cloudfunctions.net`;
}

async function callGeminiProxy<T>(action: string, payload: unknown): Promise<T> {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured');
  }

  const response = await fetch(`${getFunctionsBaseUrl()}/geminiProxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, payload }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorData.error ?? `geminiProxy failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function parseQuickCapturePreview(payload: ParseQuickCapturePayload): Promise<QuickCapturePreview> {
  return callGeminiProxy<QuickCapturePreview>('parseQuickCapturePreview', payload);
}
