import { useEffect } from 'react';
import { Card, CardContent, Typography, Stack, Box, Avatar } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useContactsStore } from '@ui/store/contactsStore';
import { recentContacts } from '@domain/contact';
import { avatarGradientFor } from '@ui/theme/avatarPalette';

interface RecentContactsPanelProps {
  uid: string;
}

/** 首頁「最近新增的聯絡人」清單（使用者需求：首頁近況摘要）。 */
export function RecentContactsPanel({ uid }: RecentContactsPanelProps) {
  const { contacts, subscribe } = useContactsStore();
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => subscribe(uid), [uid, subscribe]);

  const recent = recentContacts(contacts, 5);
  if (recent.length === 0) return null;

  return (
    <Card sx={{ m: 2, mb: 0 }} elevation={2}>
      <CardContent>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          {t('dashboard.recentContactsTitle')}
        </Typography>
        <Stack spacing={1}>
          {recent.map((contact) => (
            <Box
              key={contact.id}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
              onClick={() => navigate(`/contacts/${contact.id}`)}
            >
              <Avatar
                src={contact.photos?.[0]?.url}
                sx={{
                  width: 32,
                  height: 32,
                  ...(contact.photos?.[0]?.url
                    ? {}
                    : { backgroundImage: avatarGradientFor(contact.id), color: '#fff' }),
                }}
              >
                {contact.name.charAt(0)}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2">{contact.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {[contact.role, contact.company].filter(Boolean).join(' · ') || ' '}
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
