import { Avatar, Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { UpcomingBirthday } from '@domain/contact';
import { avatarGradientFor } from '@ui/theme/avatarPalette';

interface UpcomingBirthdaysPanelProps {
  birthdays: UpcomingBirthday[];
}

/** 首頁「即將到來的生日」清單（未來 windowDays 天內，見 domain/contact.ts 的 upcomingBirthdays）。 */
export function UpcomingBirthdaysPanel({ birthdays }: UpcomingBirthdaysPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (birthdays.length === 0) return null;

  return (
    <Card sx={{ m: 2, mb: 0 }} elevation={2}>
      <CardContent>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          {t('dashboard.upcomingBirthdaysListTitle')}
        </Typography>
        <Stack spacing={1.25}>
          {birthdays.map(({ contact, daysUntil }) => (
            <Box
              key={contact.id}
              onClick={() => navigate(`/contacts/${contact.id}`)}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
            >
              <Avatar
                src={contact.photos?.[0]?.url}
                sx={{
                  width: 36,
                  height: 36,
                  fontSize: '0.9rem',
                  ...(contact.photos?.[0]?.url ? {} : { backgroundImage: avatarGradientFor(contact.id), color: '#fff' }),
                }}
              >
                {contact.name.charAt(0)}
              </Avatar>
              <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                {contact.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, flexShrink: 0 }}>
                {daysUntil === 0 ? t('dashboard.birthdayToday') : t('dashboard.daysUntilBirthday', { days: daysUntil })}
              </Typography>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
