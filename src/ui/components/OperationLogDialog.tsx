import { useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, List, ListItem, ListItemText, Typography } from '@mui/material';
import { useLogsStore } from '@ui/store/logsStore';

interface OperationLogDialogProps {
  uid: string;
  open: boolean;
  onClose: () => void;
}

/** 操作歷史紀錄（見 spec.md §5.10），唯讀清單，最新在前。 */
export function OperationLogDialog({ uid, open, onClose }: OperationLogDialogProps) {
  const { logs, subscribe } = useLogsStore();

  useEffect(() => {
    if (!open) return;
    return subscribe(uid);
  }, [open, uid, subscribe]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>操作歷史</DialogTitle>
      <DialogContent>
        {logs.length === 0 ? (
          <Typography color="text.secondary">還沒有任何操作紀錄。</Typography>
        ) : (
          <List dense>
            {logs.map((log) => (
              <ListItem key={log.id}>
                <ListItemText
                  primary={`${log.action} — ${log.contactName}`}
                  secondary={`${log.details} · ${new Date(log.createdAt).toLocaleString('zh-TW')}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>關閉</Button>
      </DialogActions>
    </Dialog>
  );
}
