import { onSnapshotsInSync } from 'firebase/firestore';
import { db } from './firebase';

/**
 * 訂閱 Firestore 本地快取與伺服器的同步狀態（見 spec.md §5.11：離線中/同步中/已同步）。
 * `onSnapshotsInSync` 在快取追上伺服器狀態時觸發，藉此推斷「已同步」；
 * 離線狀態由呼叫端（UI 層）另外用 src/platform/connectivity 偵測後合併判斷。
 */
export function subscribeFirestoreSync(onSynced: () => void): () => void {
  if (!db) return () => {};
  return onSnapshotsInSync(db, onSynced);
}
