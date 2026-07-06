import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ContactBasicInfoPanel } from '@ui/components/ContactBasicInfoPanel';
import type { Contact } from '@domain/contact';

interface EditContactDialogProps {
  uid: string;
  contact: Contact;
  open: boolean;
  onClose: () => void;
}

/**
 * 編輯聯絡人（見 spec.md §5.2）：列表頁的快速存取入口，內容委派給
 * ContactBasicInfoPanel（與 §11.5 聯絡人詳情 Tabs 頁共用同一份欄位/驗證/照片邏輯）。
 */
export function EditContactDialog({ uid, contact, open, onClose }: EditContactDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('editContact.title', { name: contact.name })}</DialogTitle>
      <DialogContent>
        <ContactBasicInfoPanel uid={uid} contact={contact} active={open} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
