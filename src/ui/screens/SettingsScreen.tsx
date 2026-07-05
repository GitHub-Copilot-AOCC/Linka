import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@ui/store/authStore';
import { SyncStatusChip } from '@ui/components/SyncStatusChip';
import { OperationLogDialog } from '@ui/components/OperationLogDialog';

/** 設定畫面：帳號資訊、同步狀態、操作歷史入口、語言切換、登出（見 spec.md §11.2、§5.12）。 */
export function SettingsScreen() {
  const { user, logout } = useAuthStore();
  const { t, i18n } = useTranslation();
  const [logOpen, setLogOpen] = useState(false);
  if (!user) return null;

  return (
    <Box sx={{ p: 2, pb: 10 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        {t('settings.title')}
      </Typography>

      <List>
        <ListItem>
          <ListItemText primary={t('settings.account')} secondary={user.email} />
        </ListItem>
        <Divider component="li" />
        <ListItem
          secondaryAction={
            <ToggleButtonGroup
              size="small"
              exclusive
              value={i18n.language}
              onChange={(_, value) => value && i18n.changeLanguage(value)}
            >
              <ToggleButton value="zh-TW">中文</ToggleButton>
              <ToggleButton value="en">EN</ToggleButton>
            </ToggleButtonGroup>
          }
        >
          <ListItemText primary={t('settings.language')} />
        </ListItem>
        <Divider component="li" />
        <ListItem secondaryAction={<SyncStatusChip />}>
          <ListItemText primary={t('settings.syncStatus')} />
        </ListItem>
        <Divider component="li" />
        <ListItem
          secondaryAction={
            <Button size="small" onClick={() => setLogOpen(true)}>
              {t('settings.view')}
            </Button>
          }
        >
          <ListItemText primary={t('settings.operationLog')} />
        </ListItem>
      </List>

      <Button variant="outlined" color="error" onClick={() => logout()} sx={{ mt: 2 }}>
        {t('settings.logout')}
      </Button>

      <OperationLogDialog uid={user.uid} open={logOpen} onClose={() => setLogOpen(false)} />
    </Box>
  );
}
