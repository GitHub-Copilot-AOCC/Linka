import { Avatar, Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Contact } from '@domain/contact';
import { avatarGradientFor } from '@ui/theme/avatarPalette';

interface RecentlyAddedContactsPanelProps {
  contacts: Contact[];
}

/**
 * 首頁「最近新增的聯絡人」清單：只列出真正落在時間窗口內新增的聯絡人（見 DashboardScreen
 * 用 contactsAddedWithinHours 算出的清單），不是資料庫裡最新的固定 N 筆（見使用者回報的舊 bug）。
 */
export function RecentlyAddedContactsPanel({ contacts }: RecentlyAddedContactsPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (contacts.length === 0) return null;

  return (
    <Card sx={{ m: 2, mb: 0 }} elevation={2}>
      <CardContent>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          {t('dashboard.recentContactsListTitle')}
        </Typography>
        <Stack spacing={1.25}>
          {contacts.map((contact) => (
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
                {contact.company && (
                  <Typography component="span" color="text.secondary" sx={{ fontSize: 'inherit' }}>
                    {' · '}
                    {contact.company}
                  </Typography>
                )}
              </Typography>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
