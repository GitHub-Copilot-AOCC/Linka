import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Locale, UserProfile } from '@domain/user';
import { applyUserProfileDefaults } from '@domain/user';

// Firestore 路徑：users/{uid}（見 spec.md §7）

function requireDb() {
  if (!db) throw new Error('Firestore is not configured');
  return db;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(requireDb(), 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

/**
 * 第一次登入時建立 UserProfile 文件（見 spec.md §7），已存在則不覆寫。
 * `locale` 由呼叫端（UI 層）偵測後傳入，此層不直接存取瀏覽器 API（見 CLAUDE.md §1）。
 */
export async function ensureUserProfile(
  uid: string,
  email: string,
  locale: Locale,
  displayName?: string,
  photoURL?: string
): Promise<UserProfile> {
  const existing = await getUserProfile(uid);
  if (existing) return existing;

  const profile = applyUserProfileDefaults(uid, email, locale, displayName, photoURL);
  await setDoc(doc(requireDb(), 'users', uid), profile);
  return profile;
}
