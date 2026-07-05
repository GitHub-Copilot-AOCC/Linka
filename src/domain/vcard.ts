// vCard (.vcf) 解析，對照 spec.md §5.9：手機通訊錄匯入的 fallback 方式（Contact Picker API 不支援時）。
// 只處理常見欄位（FN、ORG、TITLE、TEL、EMAIL），不追求完整 RFC 6350 相容。

import type { Contact } from './contact';

export interface ParsedVCardContact {
  name: string;
  company?: string;
  role?: string;
  phone?: string;
  email?: string;
}

function unfoldLines(text: string): string[] {
  // vCard 規格允許長行以換行+空白摺行（folding），先還原成單行。
  const raw = text.split(/\r\n|\n|\r/);
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

/** 解析一份 .vcf 檔案內容，可能包含多筆 VCARD 區塊。 */
export function parseVCardFile(text: string): ParsedVCardContact[] {
  const lines = unfoldLines(text);
  const contacts: ParsedVCardContact[] = [];
  let current: ParsedVCardContact | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toUpperCase() === 'BEGIN:VCARD') {
      current = { name: '' };
      continue;
    }
    if (trimmed.toUpperCase() === 'END:VCARD') {
      if (current && current.name) contacts.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;
    const rawKey = trimmed.slice(0, colonIndex);
    const value = trimmed.slice(colonIndex + 1).trim();
    const key = rawKey.split(';')[0].toUpperCase();

    switch (key) {
      case 'FN':
        current.name = value;
        break;
      case 'ORG':
        current.company = value.split(';')[0];
        break;
      case 'TITLE':
        current.role = value;
        break;
      case 'TEL':
        if (!current.phone) current.phone = value;
        break;
      case 'EMAIL':
        if (!current.email) current.email = value;
        break;
    }
  }

  return contacts;
}

/** 判斷重複資料所需的最小欄位形狀，供多種匯入來源（vCard、文件批次匯入等）共用。 */
export interface DuplicateCandidateFields {
  name: string;
  phone?: string;
  email?: string;
}

/**
 * 依「姓名 + 電話或 Email」判斷是否已存在（見 spec.md §5.9、§5.7 共用的重複資料處理原則）。
 * 為通用 domain helper，vCard 匯入與文件批次匯入皆可重用，不侷限於 ParsedVCardContact 型別。
 */
export function findDuplicateContact(existing: Contact[], candidate: DuplicateCandidateFields): Contact | undefined {
  return existing.find(
    (c) =>
      c.name.trim().toLowerCase() === candidate.name.trim().toLowerCase() &&
      ((candidate.phone && c.phone === candidate.phone) || (candidate.email && c.email === candidate.email))
  );
}
