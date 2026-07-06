import * as XLSX from 'xlsx';
import type { Contact } from '@domain/contact';
import type { Interaction } from '@domain/interaction';
import type { Tag } from '@domain/tag';
import {
  buildContactExportRows,
  buildInteractionExportRows,
  CONTACT_EXPORT_COLUMNS,
  INTERACTION_EXPORT_COLUMNS,
} from '@domain/contactExport';

interface ExportSheetLabels {
  contactColumnLabels: string[]; // 對應 CONTACT_EXPORT_COLUMNS 順序的已翻譯欄位標題
  interactionColumnLabels: string[]; // 對應 INTERACTION_EXPORT_COLUMNS 順序的已翻譯欄位標題
  contactsSheetName: string;
  interactionsSheetName: string;
  interactionTypeLabels: Record<Interaction['type'], string>;
  deletedContactLabel: string;
}

/**
 * Web 實作：用 SheetJS 產生 Excel 檔並觸發瀏覽器下載（使用者需求：聯絡人資料庫可匯出成 Excel）。
 * 未來 RN 版需提供對應原生實作（例如寫入檔案系統後呼叫分享 sheet）。
 */
export function exportContactsToExcel(
  contacts: Contact[],
  interactions: Interaction[],
  tags: Tag[],
  labels: ExportSheetLabels
): void {
  const contactRows = buildContactExportRows(contacts, tags);
  const interactionRows = buildInteractionExportRows(interactions, contacts, labels.deletedContactLabel);

  const contactSheet = XLSX.utils.aoa_to_sheet([
    labels.contactColumnLabels,
    ...contactRows.map((row) => CONTACT_EXPORT_COLUMNS.map((col) => row[col.key])),
  ]);

  const interactionSheet = XLSX.utils.aoa_to_sheet([
    labels.interactionColumnLabels,
    ...interactionRows.map((row) =>
      INTERACTION_EXPORT_COLUMNS.map((col) =>
        col.key === 'type' ? labels.interactionTypeLabels[row.type] : row[col.key]
      )
    ),
  ]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, contactSheet, labels.contactsSheetName);
  XLSX.utils.book_append_sheet(workbook, interactionSheet, labels.interactionsSheetName);

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `linka-contacts-${today}.xlsx`);
}
