import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import type { UsageQuota } from '@domain/usageQuota';

// Firestore 路徑：users/{uid}/usage/{periodId}（見 spec.md §7）。唯讀，見 domain/usageQuota.ts 說明。

/** 訂閱目前計費週期的用量文件；文件尚未被 Cloud Function 建立前會收到 null（不是錯誤）。 */
export function subscribeUsageQuota(
  uid: string,
  periodId: string,
  onChange: (quota: UsageQuota | null) => void
): () => void {
  if (!db) return () => {};
  return onSnapshot(doc(db, 'users', uid, 'usage', periodId), (snapshot) => {
    onChange(snapshot.exists() ? (snapshot.data() as UsageQuota) : null);
  });
}
