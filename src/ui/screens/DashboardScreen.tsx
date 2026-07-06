import { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@ui/store/authStore';
import { useContactsStore } from '@ui/store/contactsStore';
import { RemindersPanel } from '@ui/components/RemindersPanel';
import { AISuggestionsPanel } from '@ui/components/AISuggestionsPanel';
import { isReminderDue } from '@domain/contact';
import { todayDateString } from '@domain/interaction';

/** 首頁儀表板：AI 主動提醒建議清單（見 spec.md §5.6、§11.3）優先於手動提醒面板呈現。 */
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
    </Box>
  );
}
