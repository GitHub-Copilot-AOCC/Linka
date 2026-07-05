import { collection, addDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';
import type { LogEntry, NewLogEntryInput } from '@domain/logEntry';

// Firestore 路徑：users/{uid}/logs/{logId}（見 spec.md §7）。
// 只能新增（見 firestore.rules：logs 為 append-only，不可修改/刪除，保持操作歷史可信度）。

function logsCollection(uid: string) {
  if (!db) throw new Error('Firestore is not configured');
  return collection(db, 'users', uid, 'logs');
}

function fromFirestore(id: string, data: Record<string, unknown>): LogEntry {
  return {
    id,
    action: data.action as string,
    contactName: data.contactName as string,
    type: data.type as LogEntry['type'],
    details: data.details as string,
    createdAt: (data.createdAt as number) ?? Date.now(),
  };
}

export async function createLogEntry(uid: string, input: NewLogEntryInput): Promise<void> {
  await addDoc(logsCollection(uid), { ...input, createdAt: Date.now() });
}

/** 訂閱最近的操作歷史（見 spec.md §5.10），依時間新到舊，限制筆數避免一次載入過多。 */
export function subscribeRecentLogs(uid: string, onChange: (logs: LogEntry[]) => void, maxCount = 50): () => void {
  const q = query(logsCollection(uid), orderBy('createdAt', 'desc'), limit(maxCount));
  return onSnapshot(q, (snapshot) => {
    onChange(snapshot.docs.map((d) => fromFirestore(d.id, d.data())));
  });
}
