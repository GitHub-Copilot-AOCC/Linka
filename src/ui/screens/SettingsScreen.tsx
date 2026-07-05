import { useEffect, useState } from 'react';
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
  LinearProgress,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@ui/store/authStore';
import { useUsageQuotaStore } from '@ui/store/usageQuotaStore';
import { SyncStatusChip } from '@ui/components/SyncStatusChip';
import { OperationLogDialog } from '@ui/components/OperationLogDialog';

/** 設定畫面：帳號資訊、同步狀態、AI 用量、操作歷史入口、語言切換、登出（見 spec.md §11.2、§3、§5.12）。 */
export function SettingsScreen() {
  const { user, logout } = useAuthStore();
  const { t, i18n } = useTranslation();
  const { quota, subscribe: subscribeQuota } = useUsageQuotaStore();
  const [logOpen, setLogOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeQuota(user.uid);
  }, [user, subscribeQuota]);

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
        <ListItem>
          <ListItemText
            primary={t('settings.aiUsage')}
            secondary={
              quota ? (
                <Box sx={{ mt: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('settings.aiUsageCount', { used: quota.aiCallsUsed, limit: quota.aiCallsLimit })}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, (quota.aiCallsUsed / quota.aiCallsLimit) * 100)}
                    sx={{ mt: 0.5 }}
                  />
                </Box>
              ) : (
                t('settings.aiUsageUnavailable')
              )
            }
          />
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
