import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from '@mui/material';
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
      <DialogTitle>{contact.name} 的下次聯絡提醒</DialogTitle>
      <DialogContent>
        <TextField
          label="提醒日期"
          type="date"
          fullWidth
          margin="dense"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </DialogContent>
      <DialogActions>
        {contact.nextContactReminder && <Button onClick={handleClear}>清除提醒</Button>}
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSave} variant="contained">
          儲存
        </Button>
      </DialogActions>
    </Dialog>
  );
}
