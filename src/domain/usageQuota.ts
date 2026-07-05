// 型別對照 spec.md §7 UsageQuota、§3 商業模式。純 TypeScript，不依賴任何平台 API。
//
// 重要：Firestore Security Rules（見 firestore.rules）將 users/{uid}/usage/{periodId}
// 設為前端唯讀（allow write: if false），只有 Cloud Function（Admin SDK）能寫入。
// 這代表配額文件的建立與增量都是後端工作，前端只負責顯示目前用量。

export interface UsageQuota {
  uid: string;
  periodStart: number; // 當月起算日 epoch ms
  aiCallsUsed: number;
  aiCallsLimit: number; // v1 定案 free=1000（見 spec.md §3）
  contactsCount: number;
  contactsLimit?: number; // v1 不啟用，見 spec.md §3
}

/** 目前計費週期的文件 ID，格式 YYYY-MM（例如 "2026-07"）。
 * 這是前後端都要遵守的慣例：Cloud Function 建立/更新配額文件時，
 * periodId 必須用同一種格式，否則前端讀不到對應文件。 */
export function currentPeriodId(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function isOverQuota(quota: UsageQuota): boolean {
  return quota.aiCallsUsed >= quota.aiCallsLimit;
}
