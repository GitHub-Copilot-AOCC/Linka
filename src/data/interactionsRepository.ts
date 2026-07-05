import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
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

/**
 * 一次性撈出「綁定至少一位指定聯絡人」的互動紀錄（見 spec.md §5.5a 檢索策略第 2 步：
 * 用查詢規劃線索對 Firestore 做範圍查詢，而非訂閱整個集合）。Firestore 的
 * `array-contains-any` 最多支援 10 個值，呼叫端若聯絡人數超過需自行分批。
 */
export async function fetchInteractionsForContacts(
  uid: string,
  contactIds: string[]
): Promise<Record<string, Interaction[]>> {
  const result: Record<string, Interaction[]> = {};
  if (contactIds.length === 0) return result;

  const batches: string[][] = [];
  for (let i = 0; i < contactIds.length; i += 10) {
    batches.push(contactIds.slice(i, i + 10));
  }

  const allInteractions: Interaction[] = [];
  for (const batch of batches) {
    const q = query(interactionsCollection(uid), where('contactIds', 'array-contains-any', batch));
    const snapshot = await getDocs(q);
    allInteractions.push(...snapshot.docs.map((d) => fromFirestore(d.id, d.data())));
  }

  for (const contactId of contactIds) {
    result[contactId] = allInteractions.filter((i) => i.contactIds.includes(contactId));
  }
  return result;
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
