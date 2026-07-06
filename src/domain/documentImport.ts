// 文件通訊錄批次匯入（見 spec.md §5.7）。純 TypeScript：組 prompt、解析 AI 回應、驗證檔案大小限制，不依賴任何平台 API。

export type DocumentTypeHint = 'pdf' | 'docx' | 'xlsx' | 'csv';

/** 單檔大小上限（見 spec.md §5.7、§10 待確認事項 3：v1 定案 10MB）。 */
export const MAX_DOCUMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export interface ParsedDocumentContact {
  name: string;
  role?: string;
  company?: string;
  phone?: string;
  email?: string;
}

/** 依副檔名判斷文件類型提示，供 Cloud Function 選擇對應的解析器；不支援的副檔名回傳 null。 */
export function detectDocumentType(fileName: string): DocumentTypeHint | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.xlsx')) return 'xlsx';
  if (lower.endsWith('.csv')) return 'csv';
  return null;
}

/** 檔案大小檢查（見 spec.md §5.7：單檔 <= 10MB，避免超大檔案解析逾時或費用暴增）。 */
export function validateDocumentFileSize(fileSizeBytes: number): boolean {
  return fileSizeBytes > 0 && fileSizeBytes <= MAX_DOCUMENT_FILE_SIZE_BYTES;
}

/** 解析 Cloud Function 回傳的聯絡人陣列，過濾掉沒有姓名的項目並清理空字串欄位。 */
export function parseDocumentContacts(raw: unknown): ParsedDocumentContact[] {
  if (!Array.isArray(raw)) return [];

  const clean = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const results: ParsedDocumentContact[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const data = item as Record<string, unknown>;
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name) continue;
    results.push({
      name,
      role: clean(data.role),
      company: clean(data.company),
      phone: clean(data.phone),
      email: clean(data.email),
    });
  }
  return results;
}
