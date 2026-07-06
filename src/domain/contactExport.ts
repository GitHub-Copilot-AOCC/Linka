// 聯絡人/互動紀錄匯出成 Excel 用的資料整形邏輯（使用者需求：可在設定頁下載）。純資料轉換，不依賴任何平台 API。

import type { Contact } from './contact';
import type { Interaction } from './interaction';
import type { Tag } from './tag';

export interface ContactExportRow {
  name: string;
  role: string;
  company: string;
  phone: string;
  email: string;
  birthday: string;
  linkedin: string;
  tags: string;
  importance: number;
  notes: string;
}

/** 欄位順序 + 對應的既有 i18n key（沿用聯絡人表單既有翻譯，避免重複維護文字）。 */
export const CONTACT_EXPORT_COLUMNS: Array<{ key: keyof ContactExportRow; labelKey: string }> = [
  { key: 'name', labelKey: 'contacts.name' },
  { key: 'role', labelKey: 'editContact.role' },
  { key: 'company', labelKey: 'contacts.company' },
  { key: 'phone', labelKey: 'editContact.phone' },
  { key: 'email', labelKey: 'auth.email' },
  { key: 'birthday', labelKey: 'editContact.birthday' },
  { key: 'linkedin', labelKey: 'editContact.linkedin' },
  { key: 'tags', labelKey: 'editContact.tags' },
  { key: 'importance', labelKey: 'editContact.importance' },
  { key: 'notes', labelKey: 'editContact.notes' },
];

/** 組出聯絡人匯出資料列，標籤 id 轉換為可讀名稱。 */
export function buildContactExportRows(contacts: Contact[], tags: Tag[]): ContactExportRow[] {
  const tagLookup = new Map(tags.map((tag) => [tag.id, tag.name]));
  return contacts.map((contact) => ({
    name: contact.name,
    role: contact.role ?? '',
    company: contact.company ?? '',
    phone: contact.phone ?? '',
    email: contact.email ?? '',
    birthday: contact.birthday ?? '',
    linkedin: contact.linkedin ?? '',
    tags: (contact.tags ?? []).map((id) => tagLookup.get(id) ?? id).join(', '),
    importance: contact.importance,
    notes: contact.notes ?? '',
  }));
}

export interface InteractionExportRow {
  contactName: string;
  type: Interaction['type'];
  date: string;
  description: string;
}

export const INTERACTION_EXPORT_COLUMNS: Array<{ key: keyof InteractionExportRow; labelKey: string }> = [
  { key: 'contactName', labelKey: 'export.colContactName' },
  { key: 'type', labelKey: 'interactionsDialog.type' },
  { key: 'date', labelKey: 'interactionsDialog.date' },
  { key: 'description', labelKey: 'interactionsDialog.description' },
];

/**
 * 組出互動紀錄匯出資料列；一筆互動綁定多位聯絡人時，各自展開成一列。
 * `deletedContactLabel`：互動紀錄本身不會因聯絡人被刪除而消失（見 contactsRepository.deleteContact
 * 的說明），這裡遇到查無對應聯絡人時顯示可讀的提示文字，而不是洩漏原始 Firestore document id。
 */
export function buildInteractionExportRows(
  interactions: Interaction[],
  contacts: Contact[],
  deletedContactLabel: string
): InteractionExportRow[] {
  const nameLookup = new Map(contacts.map((contact) => [contact.id, contact.name]));
  const rows: InteractionExportRow[] = [];
  for (const interaction of interactions) {
    for (const contactId of interaction.contactIds) {
      rows.push({
        contactName: nameLookup.get(contactId) ?? deletedContactLabel,
        type: interaction.type,
        date: interaction.date,
        description: interaction.description,
      });
    }
  }
  return rows;
}
