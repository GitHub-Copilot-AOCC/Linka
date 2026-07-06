import { collection, doc, addDoc, deleteDoc, deleteField, onSnapshot, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import type { Tag, NewTagInput } from '@domain/tag';
import { DEFAULT_TAG_NAMES } from '@domain/tag';

// Firestore 路徑：users/{uid}/tags/{tagId}（見 spec.md §7）

function tagsCollection(uid: string) {
  if (!db) throw new Error('Firestore is not configured');
  return collection(db, 'users', uid, 'tags');
}

function fromFirestore(id: string, data: Record<string, unknown>): Tag {
  return {
    id,
    name: data.name as string,
    icon: data.icon as string | undefined,
    createdAt: (data.createdAt as number) ?? Date.now(),
  };
}

export function subscribeTags(uid: string, onChange: (tags: Tag[]) => void): () => void {
  return onSnapshot(tagsCollection(uid), (snapshot) => {
    onChange(snapshot.docs.map((d) => fromFirestore(d.id, d.data())));
  });
}

export async function createTag(uid: string, input: NewTagInput): Promise<string> {
  const data: Record<string, unknown> = { name: input.name, createdAt: Date.now() };
  if (input.icon !== undefined) data.icon = input.icon;
  const ref = await addDoc(tagsCollection(uid), data);
  return ref.id;
}

/**
 * 刪除標籤，並清除所有引用這個標籤的聯絡人身上的對應 id（見使用者回報的 corner case：
 * 原本只刪標籤文件本身，聯絡人的 tags 陣列會留下指不到任何標籤的孤兒 id）。
 */
export async function deleteTag(uid: string, tagId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not configured');

  const batch = writeBatch(db);
  batch.delete(doc(db, 'users', uid, 'tags', tagId));

  const contactsQuery = query(
    collection(db, 'users', uid, 'contacts'),
    where('tags', 'array-contains', tagId)
  );
  const contactsSnapshot = await getDocs(contactsQuery);
  for (const contactDoc of contactsSnapshot.docs) {
    const tags = (contactDoc.data().tags as string[]) ?? [];
    const remaining = tags.filter((id) => id !== tagId);
    batch.update(contactDoc.ref, { tags: remaining.length > 0 ? remaining : deleteField() });
  }

  await batch.commit();
}

/** 新使用者第一次進入時，若尚無任何標籤，建立 v1 預設分類（見 spec.md §5.2）。 */
export async function ensureDefaultTags(uid: string): Promise<void> {
  const snapshot = await getDocs(tagsCollection(uid));
  if (!snapshot.empty) return;
  await Promise.all(DEFAULT_TAG_NAMES.map((name) => createTag(uid, { name })));
}
