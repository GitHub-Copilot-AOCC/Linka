import { useState } from 'react';
import { Box, Typography, Button, List, ListItem, ListItemText, Divider } from '@mui/material';
import { useAuthStore } from '@ui/store/authStore';
import { SyncStatusChip } from '@ui/components/SyncStatusChip';
import { OperationLogDialog } from '@ui/components/OperationLogDialog';

/** 設定畫面：帳號資訊、同步狀態、操作歷史入口、登出（見 spec.md §11.2 導覽架構）。 */
export function SettingsScreen() {
  const { user, logout } = useAuthStore();
  const [logOpen, setLogOpen] = useState(false);
  if (!user) return null;

  return (
    <Box sx={{ p: 2, pb: 10 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        設定
      </Typography>

      <List>
        <ListItem>
          <ListItemText primary="帳號" secondary={user.email} />
        </ListItem>
        <Divider component="li" />
        <ListItem
          secondaryAction={<SyncStatusChip />}
        >
          <ListItemText primary="同步狀態" />
        </ListItem>
        <Divider component="li" />
        <ListItem
          secondaryAction={
            <Button size="small" onClick={() => setLogOpen(true)}>
              查看
            </Button>
          }
        >
          <ListItemText primary="操作歷史" />
        </ListItem>
      </List>

      <Button variant="outlined" color="error" onClick={() => logout()} sx={{ mt: 2 }}>
        登出
      </Button>

      <OperationLogDialog uid={user.uid} open={logOpen} onClose={() => setLogOpen(false)} />
    </Box>
  );
}
