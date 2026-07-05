// 型別對照 spec.md §7 LogEntry。操作歷史紀錄（見 §5.10），只能新增，不可修改/刪除（見 firestore.rules）。

export type LogType = 'create' | 'update' | 'delete' | 'photo' | 'interaction';

export interface LogEntry {
  id: string;
  action: string; // 顯示用文字，例如「新增聯絡人」
  contactName: string;
  type: LogType;
  details: string;
  createdAt: number;
}

export type NewLogEntryInput = Omit<LogEntry, 'id' | 'createdAt'>;
