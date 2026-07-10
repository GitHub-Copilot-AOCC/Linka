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
  Avatar,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@ui/store/authStore';
import { useUsageQuotaStore } from '@ui/store/usageQuotaStore';
import { useContactsStore } from '@ui/store/contactsStore';
import { useInteractionsStore } from '@ui/store/interactionsStore';
import { useTagsStore } from '@ui/store/tagsStore';
import { SyncStatusChip } from '@ui/components/SyncStatusChip';
import { OperationLogDialog } from '@ui/components/OperationLogDialog';
import { exportContactsToExcel } from '@platform/exportContacts';
import { avatarGradientFor } from '@ui/theme/avatarPalette';

/** iOS 風格「Grouped List」欄位群組容器，跟編輯聯絡人表單共用同一套視覺語言（見使用者提供
 * 的設計 mockup：設定頁改成個人資料列 + 分組卡片，而不是單一長串清單）。 */
function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 3,
        overflow: 'hidden',
        mb: 2,
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
      }}
    >
      <List disablePadding>{children}</List>
    </Box>
  );
}

/** 設定畫面：帳號資訊、同步狀態、AI 用量、操作歷史入口、語言切換、資料匯出、登出（見 spec.md §11.2、§3、§5.12）。 */
export function SettingsScreen() {
  const { user, logout } = useAuthStore();
  const { t, i18n } = useTranslation();
  const { quota, subscribe: subscribeQuota } = useUsageQuotaStore();
  const { contacts, subscribe: subscribeContacts } = useContactsStore();
  const { all: interactions, subscribeAll: subscribeInteractions } = useInteractionsStore();
  const { tags, subscribe: subscribeTags } = useTagsStore();
  const [logOpen, setLogOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeQuota(user.uid);
  }, [user, subscribeQuota]);

  useEffect(() => {
    if (!user) return;
    return subscribeContacts(user.uid);
  }, [user, subscribeContacts]);

  useEffect(() => {
    if (!user) return;
    return subscribeInteractions(user.uid);
  }, [user, subscribeInteractions]);

  useEffect(() => {
    if (!user) return;
    return subscribeTags(user.uid);
  }, [user, subscribeTags]);

  if (!user) return null;

  function handleExport() {
    exportContactsToExcel(contacts, interactions, tags, {
      contactColumnLabels: [
        t('contacts.name'),
        t('editContact.role'),
        t('contacts.company'),
        t('editContact.phone'),
        t('auth.email'),
        t('editContact.birthday'),
        t('editContact.linkedin'),
        t('editContact.tags'),
        t('editContact.importance'),
        t('editContact.notes'),
      ],
      interactionColumnLabels: [
        t('export.colContactName'),
        t('interactionsDialog.type'),
        t('interactionsDialog.date'),
        t('interactionsDialog.description'),
      ],
      contactsSheetName: t('export.sheetContacts'),
      interactionsSheetName: t('export.sheetInteractions'),
      interactionTypeLabels: {
        meeting: t('interactionsDialog.typeMeeting'),
        call: t('interactionsDialog.typeCall'),
        email: t('interactionsDialog.typeEmail'),
      },
      deletedContactLabel: t('common.deletedContact'),
    });
  }

  return (
    <Box sx={{ p: 2, pb: 10 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        {t('settings.title')}
      </Typography>

      <SettingsGroup>
        <ListItem sx={{ py: 1.5 }}>
          <Avatar
            sx={{ width: 48, height: 48, mr: 2, backgroundImage: avatarGradientFor(user.uid), color: '#fff' }}
          >
            {(user.email ?? '?').charAt(0).toUpperCase()}
          </Avatar>
          <ListItemText primary={user.email} secondary={t('settings.account')} />
          <ChevronRightIcon sx={{ color: 'text.secondary' }} />
        </ListItem>
      </SettingsGroup>

      <SettingsGroup>
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
      </SettingsGroup>

      <SettingsGroup>
        <ListItem
          secondaryAction={
            <Button size="small" onClick={() => setLogOpen(true)}>
              {t('settings.view')}
            </Button>
          }
        >
          <ListItemText primary={t('settings.operationLog')} />
        </ListItem>
        <Divider component="li" />
        <ListItem
          secondaryAction={
            <Button size="small" variant="outlined" onClick={handleExport} disabled={contacts.length === 0}>
              {t('settings.exportButton')}
            </Button>
          }
        >
          <ListItemText primary={t('settings.exportContacts')} secondary={t('settings.exportDescription')} />
        </ListItem>
      </SettingsGroup>

      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 3,
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        }}
      >
        <Button
          fullWidth
          color="error"
          onClick={() => logout()}
          sx={{ py: 1.5, fontWeight: 700, borderRadius: 3 }}
        >
          {t('settings.logout')}
        </Button>
      </Box>

      <OperationLogDialog uid={user.uid} open={logOpen} onClose={() => setLogOpen(false)} />
    </Box>
  );
}
