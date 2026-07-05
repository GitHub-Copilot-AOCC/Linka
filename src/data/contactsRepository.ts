import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Contact, NewContactInput } from '@domain/contact';
import { applyContactDefaults } from '@domain/contact';

// Firestore 路徑：users/{uid}/contacts/{contactId}（見 spec.md §7）

function contactsCollection(uid: string) {
  if (!db) throw new Error('Firestore is not configured');
  return collection(db, 'users', uid, 'contacts');
}

function fromFirestore(id: string, data: Record<string, unknown>): Contact {
  const toMillis = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : (v as number) ?? Date.now());
  return {
    id,
    name: data.name as string,
    role: data.role as string | undefined,
    company: data.company as string | undefined,
    phone: data.phone as string | undefined,
    email: data.email as string | undefined,
    birthday: data.birthday as string | undefined,
    linkedin: data.linkedin as string | undefined,
    facebook: data.facebook as string | undefined,
    twitter: data.twitter as string | undefined,
    notes: data.notes as string | undefined,
    tags: (data.tags as string[]) ?? undefined,
    importance: (data.importance as Contact['importance']) ?? 3,
    photos: (data.photos as Contact['photos']) ?? undefined,
    nextContactReminder: data.nextContactReminder as string | undefined,
    source: data.source as Contact['source'],
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  };
}

/** 訂閱使用者的聯絡人列表（依姓名排序），供 UI store 使用；回傳取消訂閱函式。 */
export function subscribeContacts(uid: string, onChange: (contacts: Contact[]) => void): () => void {
  const q = query(contactsCollection(uid), orderBy('name'));
  return onSnapshot(q, (snapshot) => {
    onChange(snapshot.docs.map((d) => fromFirestore(d.id, d.data())));
  });
}

export async function createContact(uid: string, input: NewContactInput): Promise<string> {
  const contact = applyContactDefaults(input);
  const ref = await addDoc(contactsCollection(uid), contact);
  return ref.id;
}

export async function updateContact(
  uid: string,
  contactId: string,
  patch: Partial<Omit<Contact, 'id' | 'createdAt'>>
): Promise<void> {
  if (!db) throw new Error('Firestore is not configured');
  // 呼叫端傳入 undefined 代表「清除這個欄位」，轉成 Firestore 的 deleteField()
  // sentinel；updateDoc（不同於 addDoc/setDoc）遇到真正的 undefined 值仍會拋錯。
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    sanitized[key] = value === undefined ? deleteField() : value;
  }
  await updateDoc(doc(db, 'users', uid, 'contacts', contactId), {
    ...sanitized,
    updatedAt: Date.now(),
  });
}

export async function deleteContact(uid: string, contactId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not configured');
  await deleteDoc(doc(db, 'users', uid, 'contacts', contactId));
}
