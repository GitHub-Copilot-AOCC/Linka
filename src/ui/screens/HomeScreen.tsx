import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { useAuthStore } from '@ui/store/authStore';
import { ContactsListScreen } from '@ui/screens/ContactsListScreen';
import { RemindersPanel } from '@ui/components/RemindersPanel';

/** 首頁殼層：暫時的頂部列 + 登出（完整導覽見 spec.md §11.2，後續功能再補）。 */
export function HomeScreen() {
  const { user, logout } = useAuthStore();
  if (!user) return null;

  return (
    <Box>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Typography variant="h6">Linka</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {user.email}
            </Typography>
            <Button size="small" onClick={() => logout()}>
              登出
            </Button>
          </Box>
        </Toolbar>
      </AppBar>
      <RemindersPanel uid={user.uid} />
      <ContactsListScreen uid={user.uid} />
    </Box>
  );
}
