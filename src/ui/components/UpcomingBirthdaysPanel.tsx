import { useEffect } from 'react';
import { Card, CardContent, Typography, Stack, Box } from '@mui/material';
import CakeIcon from '@mui/icons-material/Cake';
import { useTranslation } from 'react-i18next';
import { useContactsStore } from '@ui/store/contactsStore';
import { upcomingBirthdays } from '@domain/contact';
import { todayDateString } from '@domain/interaction';

interface UpcomingBirthdaysPanelProps {
  uid: string;
}

/**
 * 首頁「即將到來的生日」清單（使用者需求）：唯讀預覽，涵蓋未來 14 天。
 * 與 §5.6 AI 主動提醒（生日前 3 天才建立可採納/忽略的建議卡片）是分開的兩個功能，互不影響。
 */
export function UpcomingBirthdaysPanel({ uid }: UpcomingBirthdaysPanelProps) {
  const { contacts, subscribe } = useContactsStore();
  const { t } = useTranslation();

  useEffect(() => subscribe(uid), [uid, subscribe]);

  const today = todayDateString();
  const upcoming = upcomingBirthdays(contacts, today, 14);
  if (upcoming.length === 0) return null;

  return (
    <Card sx={{ m: 2, mb: 0 }} elevation={2}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <CakeIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1">{t('dashboard.upcomingBirthdaysTitle')}</Typography>
        </Box>
        <Stack spacing={1}>
          {upcoming.map(({ contact, daysUntil }) => (
            <Box key={contact.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant="body2">{contact.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {daysUntil === 0
                  ? t('dashboard.birthdayToday')
                  : t('dashboard.daysUntilBirthday', { days: daysUntil })}
              </Typography>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
