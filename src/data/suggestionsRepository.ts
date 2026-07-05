import { collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { AgentSuggestion, AgentSuggestionStatus } from '@domain/agentSuggestion';

function suggestionsCollection(uid: string) {
  if (!db) throw new Error('Firestore is not configured');
  return collection(db, 'users', uid, 'suggestions');
}

function fromFirestore(id: string, data: Record<string, unknown>): AgentSuggestion {
  return {
    id,
    contactId: data.contactId as string,
    type: data.type as AgentSuggestion['type'],
    message: data.message as string,
    status: (data.status as AgentSuggestionStatus) ?? 'pending',
    triggerDate: data.triggerDate as string,
    createdAt: (data.createdAt as number) ?? Date.now(),
  };
}

export function subscribeSuggestions(uid: string, onChange: (suggestions: AgentSuggestion[]) => void): () => void {
  const q = query(suggestionsCollection(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    onChange(snapshot.docs.map((item) => fromFirestore(item.id, item.data())));
  });
}

export async function updateSuggestionStatus(
  uid: string,
  suggestionId: string,
  status: AgentSuggestionStatus
): Promise<void> {
  if (!db) throw new Error('Firestore is not configured');
  await updateDoc(doc(db, 'users', uid, 'suggestions', suggestionId), { status });
}
