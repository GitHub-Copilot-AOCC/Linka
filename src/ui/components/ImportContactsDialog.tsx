import { useRef, useState } from 'react';
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
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { parseVCardFile, findDuplicateContact } from '@domain/vcard';
import type { ParsedVCardContact } from '@domain/vcard';
import { useContactsStore } from '@ui/store/contactsStore';

interface ImportContactsDialogProps {
  uid: string;
  open: boolean;
  onClose: () => void;
}

/**
 * vCard (.vcf) 匯入（見 spec.md §5.9）：解析 → 預覽清單（重複資料預設不勾選）→ 使用者確認 → 批次寫入。
 * 不可解析完直接靜默寫入，比照 §5.7 批次匯入的預覽確認原則。
 */
export function ImportContactsDialog({ uid, open, onClose }: ImportContactsDialogProps) {
  const { contacts, add } = useContactsStore();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedVCardContact[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      const result = parseVCardFile(text);
      if (result.length === 0) {
        setError(t('import.noContactsFound'));
        return;
      }
      setParsed(result);
      // 重複資料預設不勾選，避免使用者不小心建立重複聯絡人（見 spec.md §5.9）。
      const nonDuplicateIndexes = result
        .map((c, i) => (findDuplicateContact(contacts, c) ? -1 : i))
        .filter((i) => i >= 0);
      setSelected(new Set(nonDuplicateIndexes));
    } catch (err) {
      setError((err as Error).message);
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
        source: 'vcard_import',
      });
      if (result.ok) successCount++;
    }
    setImporting(false);
    setParsed([]);
    setSelected(new Set());
    if (successCount > 0) onClose();
  }

  function handleClose() {
    setParsed([]);
    setSelected(new Set());
    setError(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('import.title')}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {parsed.length === 0 ? (
          <>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {t('import.description')}
            </Typography>
            <Button variant="contained" onClick={() => fileInputRef.current?.click()}>
              {t('import.chooseFile')}
            </Button>
            <input ref={fileInputRef} type="file" accept=".vcf,text/vcard" hidden onChange={handleFileSelected} />
          </>
        ) : (
          <>
            <Typography sx={{ mb: 1 }}>{t('import.foundCount', { count: parsed.length })}</Typography>
            <List dense>
              {parsed.map((c, i) => {
                const duplicate = findDuplicateContact(contacts, c);
                return (
                  <ListItem key={i} disablePadding>
                    <Checkbox checked={selected.has(i)} onChange={() => toggle(i)} />
                    <ListItemText
                      primary={c.name}
                      secondary={[c.company, c.phone, c.email].filter(Boolean).join(' · ')}
                    />
                    {duplicate && <Chip size="small" label={t('import.duplicate')} color="warning" />}
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
            {t('import.importSelected', { count: selected.size })}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
