import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useContactsStore } from '@ui/store/contactsStore';

interface DeleteContactDialogProps {
  uid: string;
  contactId: string;
  contactName: string;
  open: boolean;
  onClose: () => void;
}

/** 刪除聯絡人前的確認對話框（見 spec.md §5.2）。 */
export function DeleteContactDialog({ uid, contactId, contactName, open, onClose }: DeleteContactDialogProps) {
  const { remove } = useContactsStore();
  const { t } = useTranslation();

  async function handleConfirm() {
    await remove(uid, contactId);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('deleteContact.title')}</DialogTitle>
      <DialogContent>
        <Typography>{t('deleteContact.confirm', { name: contactName })}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={handleConfirm} color="error" variant="contained">
          {t('common.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
