import { useState } from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { useAuthStore } from '@ui/store/authStore';
import { ContactsListScreen } from '@ui/screens/ContactsListScreen';
import { RemindersPanel } from '@ui/components/RemindersPanel';
import { AISuggestionsPanel } from '@ui/components/AISuggestionsPanel';
import { SyncStatusChip } from '@ui/components/SyncStatusChip';
import { OperationLogDialog } from '@ui/components/OperationLogDialog';

export function HomeScreen() {
  const { user, logout } = useAuthStore();
  const [logOpen, setLogOpen] = useState(false);
  if (!user) return null;

  return (
    <Box>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Typography variant="h6">Linka</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SyncStatusChip />
            <Button size="small" onClick={() => setLogOpen(true)}>
              操作紀錄
            </Button>
            <Typography variant="body2" color="text.secondary">
              {user.email}
            </Typography>
            <Button size="small" onClick={() => logout()}>
              登出
            </Button>
          </Box>
        </Toolbar>
      </AppBar>
      <AISuggestionsPanel uid={user.uid} />
      <RemindersPanel uid={user.uid} />
      <ContactsListScreen uid={user.uid} />
      <OperationLogDialog uid={user.uid} open={logOpen} onClose={() => setLogOpen(false)} />
    </Box>
  );
}
