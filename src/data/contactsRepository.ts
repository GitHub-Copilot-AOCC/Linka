import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';
import type { Contact, ContactPhoto, NewContactInput, ResearchEntry } from '@domain/contact';
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
    researchLog: (data.researchLog as Contact['researchLog']) ?? undefined,
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

/**
 * 刪除聯絡人。互動紀錄「歷史內容」刻意保留、不因刪除聯絡人而消失
 * （見 deleteContact 對話框文案：「此操作無法復原（互動紀錄不會自動刪除）」，
 * 這是既有明確對使用者承諾的行為，不能因為這次的孤兒資料清理而破壞）。
 * 這裡只清掉沒有這種保留承諾、刪除聯絡人後就完全失去意義的 AI 建議
 * （AgentSuggestion 永遠指向已不存在的聯絡人，見使用者回報的 corner case）。
 */
export async function deleteContact(uid: string, contactId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not configured');

  const batch = writeBatch(db);
  batch.delete(doc(db, 'users', uid, 'contacts', contactId));

  const suggestionsQuery = query(
    collection(db, 'users', uid, 'suggestions'),
    where('contactId', '==', contactId)
  );
  const suggestionsSnapshot = await getDocs(suggestionsQuery);
  for (const suggestionDoc of suggestionsSnapshot.docs) {
    batch.delete(suggestionDoc.ref);
  }

  await batch.commit();
}

/**
 * 上傳聯絡人照片到 Firebase Storage（見 spec.md §5.2、§7：路徑
 * users/{uid}/contacts/{contactId}/photos/{photoId}.jpg），並把下載 URL 加進
 * Contact.photos 陣列。呼叫端負責先做 MAX_PHOTOS_PER_CONTACT 上限檢查。
 */
export async function uploadContactPhoto(
  uid: string,
  contactId: string,
  blob: Blob,
  existingPhotos: ContactPhoto[]
): Promise<ContactPhoto> {
  if (!storage) throw new Error('Firebase Storage is not configured');
  const photoId = `${Date.now()}`;
  const path = `users/${uid}/contacts/${contactId}/photos/${photoId}.jpg`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(fileRef);

  const photo: ContactPhoto = { url, source: 'upload', addedAt: Date.now() };
  await updateContact(uid, contactId, { photos: [...existingPhotos, photo] });
  return photo;
}

/**
 * 新增一筆網路身分研究摘要紀錄（見 spec.md §5.8）：一律附加到 researchLog 陣列尾端，
 * 絕不覆蓋既有紀錄，讓使用者可回顧歷次搜尋結果隨時間的變化。
 */
export async function appendResearchEntry(
  uid: string,
  contactId: string,
  existingLog: ResearchEntry[],
  entry: ResearchEntry
): Promise<void> {
  await updateContact(uid, contactId, { researchLog: [...existingLog, entry] });
}

/** 刪除一張已上傳的聯絡人照片（Storage 檔案 + Firestore 陣列項目）。 */
export async function removeContactPhoto(
  uid: string,
  contactId: string,
  photo: ContactPhoto,
  existingPhotos: ContactPhoto[]
): Promise<void> {
  if (storage) {
    try {
      await deleteObject(storageRef(storage, photo.url));
    } catch {
      // 用 download URL 建立 ref 在某些情況下無法直接刪除底層檔案，
      // 此時僅移除 Firestore 紀錄，不視為致命錯誤（避免留下孤兒檔案但擋住使用者操作）。
    }
  }
  const remaining = existingPhotos.filter((p) => p.addedAt !== photo.addedAt);
  await updateContact(uid, contactId, { photos: remaining.length > 0 ? remaining : undefined });
}
