import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  Typography,
  Alert,
  Chip,
  Box,
  CircularProgress,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useTranslation } from 'react-i18next';
import {
  detectDocumentType,
  validateDocumentFileSize,
  MAX_DOCUMENT_FILE_SIZE_BYTES,
} from '@domain/documentImport';
import type { ParsedDocumentContact } from '@domain/documentImport';
import { findDuplicateContact } from '@domain/vcard';
import { parseContactDocument, GeminiServiceError } from '@services/geminiService';
import { useContactsStore } from '@ui/store/contactsStore';
import { pickFile } from '@platform/filePicker';

interface DocumentImportDialogProps {
  uid: string;
  open: boolean;
  onClose: () => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read file'));
        return;
      }
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * 文件通訊錄批次匯入（見 spec.md §5.7）：上傳文件 → Cloud Function 解析 + AI 抽取多筆聯絡人
 * → 預覽清單（比照 vCard 匯入的重複資料預警與勾選 UX）→ 使用者確認 → 批次寫入。
 * 未經預覽確認前，絕不靜默寫入。
 */
export function DocumentImportDialog({ uid, open, onClose }: DocumentImportDialogProps) {
  const { contacts, add } = useContactsStore();
  const { t } = useTranslation();
  const [parsed, setParsed] = useState<ParsedDocumentContact[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetState() {
    setParsed([]);
    setSelected(new Set());
    setLoading(false);
    setImporting(false);
    setError(null);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  async function handleFileSelected() {
    const file = await pickFile({ accept: '.pdf,.docx,.xlsx,.csv' });
    if (!file) return;

    setError(null);
    setParsed([]);
    setSelected(new Set());

    const docType = detectDocumentType(file.name);
    if (!docType) {
      setError(t('docImport.unsupportedType'));
      return;
    }

    if (!validateDocumentFileSize(file.size)) {
      setError(t('docImport.fileTooLarge', { maxMB: MAX_DOCUMENT_FILE_SIZE_BYTES / (1024 * 1024) }));
      return;
    }

    if (!navigator.onLine) {
      setError(t('docImport.offlineError'));
      return;
    }

    setLoading(true);
    try {
      const base64Data = await fileToBase64(file);
      const result = await parseContactDocument(base64Data, docType);
      if (result.length === 0) {
        setError(t('docImport.noContactsFound'));
      } else {
        setParsed(result);
        // 重複資料預設不勾選，避免使用者不小心建立重複聯絡人（比照 §5.9 vCard 匯入原則）。
        const nonDuplicateIndexes = result
          .map((c, i) => (findDuplicateContact(contacts, c) ? -1 : i))
          .filter((i) => i >= 0);
        setSelected(new Set(nonDuplicateIndexes));
      }
    } catch (err) {
      setError(err instanceof GeminiServiceError ? err.message : t('docImport.genericError'));
    } finally {
      setLoading(false);
    }
  }

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleImport() {
    setImporting(true);
    let successCount = 0;
    for (const index of selected) {
      const c = parsed[index];
      const result = await add(uid, {
        name: c.name,
        company: c.company,
        role: c.role,
        phone: c.phone,
        email: c.email,
        source: 'doc_import',
      });
      if (result.ok) successCount++;
    }
    setImporting(false);
    setParsed([]);
    setSelected(new Set());
    if (successCount > 0) onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('docImport.title')}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {parsed.length === 0 && !loading && (
          <>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {t('docImport.description')}
            </Typography>
            <Button variant="contained" startIcon={<UploadFileIcon />} onClick={handleFileSelected}>
              {t('docImport.chooseFile')}
            </Button>
          </>
        )}

        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 3 }}>
            <CircularProgress size={28} />
            <Typography color="text.secondary">{t('docImport.parsing')}</Typography>
          </Box>
        )}

        {parsed.length > 0 && (
          <>
            <Typography sx={{ mb: 1 }}>{t('docImport.foundCount', { count: parsed.length })}</Typography>
            <List dense>
              {parsed.map((c, i) => {
                const duplicate = findDuplicateContact(contacts, c);
                return (
                  <ListItem key={i} disablePadding>
                    <Checkbox checked={selected.has(i)} onChange={() => toggle(i)} />
                    <ListItemText
                      primary={c.name}
                      secondary={[c.role, c.company, c.phone, c.email].filter(Boolean).join(' · ')}
                    />
                    {duplicate && <Chip size="small" label={t('docImport.duplicate')} color="warning" />}
                  </ListItem>
                );
              })}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('common.cancel')}</Button>
        {parsed.length > 0 && (
          <Button variant="contained" onClick={handleImport} disabled={selected.size === 0 || importing}>
            {importing ? t('docImport.importing') : t('docImport.importSelected', { count: selected.size })}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
