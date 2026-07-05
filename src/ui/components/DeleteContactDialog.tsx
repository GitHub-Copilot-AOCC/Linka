import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
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

  async function handleConfirm() {
    await remove(uid, contactId);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>刪除聯絡人？</DialogTitle>
      <DialogContent>
        <Typography>
          確定要刪除「{contactName}」嗎？此操作無法復原（互動紀錄不會自動刪除）。
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleConfirm} color="error" variant="contained">
          刪除
        </Button>
      </DialogActions>
    </Dialog>
  );
}
