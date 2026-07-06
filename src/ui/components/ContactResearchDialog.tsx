import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ContactResearchPanel } from '@ui/components/ContactResearchPanel';
import type { Contact } from '@domain/contact';

interface ContactResearchDialogProps {
  uid: string;
  contact: Contact;
  open: boolean;
  onClose: () => void;
}

/**
 * 聯絡人網路身分研究摘要對話框（見 spec.md §5.8）：列表頁的快速存取入口，
 * 內容委派給 ContactResearchPanel（與 §11.5 聯絡人詳情 Tabs 頁共用同一份邏輯）。
 */
export function ContactResearchDialog({ uid, contact, open, onClose }: ContactResearchDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('contactResearch.title', { name: contact.name })}</DialogTitle>
      <DialogContent>
        <ContactResearchPanel uid={uid} contact={contact} active={open} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
