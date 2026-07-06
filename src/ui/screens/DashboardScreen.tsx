import { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@ui/store/authStore';
import { useContactsStore } from '@ui/store/contactsStore';
import { RemindersPanel } from '@ui/components/RemindersPanel';
import { AISuggestionsPanel } from '@ui/components/AISuggestionsPanel';
import { UpcomingBirthdaysPanel } from '@ui/components/UpcomingBirthdaysPanel';
import { RecentContactsPanel } from '@ui/components/RecentContactsPanel';
import { RecentInteractionsPanel } from '@ui/components/RecentInteractionsPanel';
import { isReminderDue } from '@domain/contact';
import { todayDateString } from '@domain/interaction';

/**
 * 首頁儀表板：AI 主動提醒建議清單（見 spec.md §5.6、§11.3）與手動提醒優先呈現，
 * 其後是唯讀的近況摘要（即將到來的生日／最近新增的聯絡人／最近的互動紀錄，使用者需求）。
 */
export function DashboardScreen() {
  const { user } = useAuthStore();
  const { contacts, subscribe } = useContactsStore();
  const { t } = useTranslation();

  useEffect(() => {
    if (!user) return;
    return subscribe(user.uid);
  }, [user, subscribe]);

  if (!user) return null;

  const today = todayDateString();
  const hasDue = contacts.some((c) => isReminderDue(c, today));

  return (
    <Box sx={{ pb: 10 }}>
      <Typography variant="h5" sx={{ p: 2, pb: 0 }}>
        {t('dashboard.title')}
      </Typography>
      <AISuggestionsPanel uid={user.uid} />
      <RemindersPanel uid={user.uid} />
      {!hasDue && (
        <Typography color="text.secondary" sx={{ p: 2 }}>
          {t('dashboard.noReminders')}
        </Typography>
      )}
      <UpcomingBirthdaysPanel uid={user.uid} />
      <RecentContactsPanel uid={user.uid} />
      <RecentInteractionsPanel uid={user.uid} />
    </Box>
  );
}
