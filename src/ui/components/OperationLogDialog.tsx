import { useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, List, ListItem, ListItemText, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useLogsStore } from '@ui/store/logsStore';

interface OperationLogDialogProps {
  uid: string;
  open: boolean;
  onClose: () => void;
}

/**
 * 操作歷史紀錄（見 spec.md §5.10），唯讀清單，最新在前。
 * 注意：`log.action`/`log.details` 是寫入當下就決定好的文字（見 contactsStore/interactionsStore），
 * 不會隨語言切換即時翻譯；只有這個對話框本身的外框文字（標題、空狀態、按鈕）跟時間格式會跟著語言切換。
 */
export function OperationLogDialog({ uid, open, onClose }: OperationLogDialogProps) {
  const { logs, subscribe } = useLogsStore();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    if (!open) return;
    return subscribe(uid);
  }, [open, uid, subscribe]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('operationLog.title')}</DialogTitle>
      <DialogContent>
        {logs.length === 0 ? (
          <Typography color="text.secondary">{t('operationLog.empty')}</Typography>
        ) : (
          <List dense>
            {logs.map((log) => (
              <ListItem key={log.id}>
                <ListItemText
                  primary={`${log.action} — ${log.contactName}`}
                  secondary={`${log.details} · ${new Date(log.createdAt).toLocaleString(i18n.language)}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
