import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useContactsStore } from '@ui/store/contactsStore';
import type { Contact } from '@domain/contact';

interface SetReminderDialogProps {
  uid: string;
  contact: Contact;
  open: boolean;
  onClose: () => void;
}

/** 設定「下次聯絡提醒日期」（見 spec.md §5.4，使用者手動設定）。 */
export function SetReminderDialog({ uid, contact, open, onClose }: SetReminderDialogProps) {
  const { update } = useContactsStore();
  const { t } = useTranslation();
  const [date, setDate] = useState(contact.nextContactReminder ?? '');

  async function handleSave() {
    await update(uid, contact.id, { nextContactReminder: date || undefined });
    onClose();
  }

  async function handleClear() {
    await update(uid, contact.id, { nextContactReminder: undefined });
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('setReminder.title', { name: contact.name })}</DialogTitle>
      <DialogContent>
        <TextField
          label={t('setReminder.dateLabel')}
          type="date"
          fullWidth
          margin="dense"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </DialogContent>
      <DialogActions>
        {contact.nextContactReminder && <Button onClick={handleClear}>{t('setReminder.clear')}</Button>}
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={handleSave} variant="contained">
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
