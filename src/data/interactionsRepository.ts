import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Interaction, NewInteractionInput } from '@domain/interaction';

// Firestore 路徑：users/{uid}/interactions/{interactionId}（見 spec.md §7，v1 獨立集合）

function interactionsCollection(uid: string) {
  if (!db) throw new Error('Firestore is not configured');
  return collection(db, 'users', uid, 'interactions');
}

function fromFirestore(id: string, data: Record<string, unknown>): Interaction {
  return {
    id,
    contactIds: (data.contactIds as string[]) ?? [],
    type: data.type as Interaction['type'],
    description: data.description as string,
    date: data.date as string,
    source: (data.source as Interaction['source']) ?? 'manual',
    rawInput: data.rawInput as string | undefined,
    createdAt: (data.createdAt as number) ?? Date.now(),
  };
}

/** 訂閱某位聯絡人的所有互動紀錄（依日期新到舊排序）。對應 §10 待確認事項：contactIds array-contains 查詢已建索引。 */
export function subscribeInteractionsForContact(
  uid: string,
  contactId: string,
  onChange: (interactions: Interaction[]) => void
): () => void {
  const q = query(
    interactionsCollection(uid),
    where('contactIds', 'array-contains', contactId),
    orderBy('date', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    onChange(snapshot.docs.map((d) => fromFirestore(d.id, d.data())));
  });
}

/** 訂閱使用者所有互動紀錄（不限單一聯絡人），供 §11.4 列表久未聯絡色彩警示計算「每位聯絡人最近互動日期」使用。 */
export function subscribeAllInteractions(uid: string, onChange: (interactions: Interaction[]) => void): () => void {
  const q = query(interactionsCollection(uid), orderBy('date', 'desc'));
  return onSnapshot(q, (snapshot) => {
    onChange(snapshot.docs.map((d) => fromFirestore(d.id, d.data())));
  });
}

export async function createInteraction(uid: string, input: NewInteractionInput): Promise<string> {
  const ref = await addDoc(interactionsCollection(uid), {
    ...input,
    source: 'manual',
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function deleteInteraction(uid: string, interactionId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not configured');
  await deleteDoc(doc(db, 'users', uid, 'interactions', interactionId));
}
