import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ContactInteractionsPanel } from '@ui/components/ContactInteractionsPanel';

interface ContactInteractionsDialogProps {
  uid: string;
  contactId: string;
  contactName: string;
  open: boolean;
  onClose: () => void;
}

/**
 * 互動紀錄對話框（見 spec.md §5.3）：列表頁的快速存取入口，內容委派給
 * ContactInteractionsPanel（與 §11.5 聯絡人詳情 Tabs 頁共用同一份邏輯）。
 */
export function ContactInteractionsDialog({ uid, contactId, contactName, open, onClose }: ContactInteractionsDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('interactionsDialog.title', { name: contactName })}</DialogTitle>
      <DialogContent>
        <ContactInteractionsPanel uid={uid} contactId={contactId} contactName={contactName} active={open} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
