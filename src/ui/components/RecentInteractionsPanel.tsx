import { useEffect, useMemo } from 'react';
import { Card, CardContent, Typography, Stack, Box, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useContactsStore } from '@ui/store/contactsStore';
import { useInteractionsStore } from '@ui/store/interactionsStore';
import { recentInteractions } from '@domain/interaction';

interface RecentInteractionsPanelProps {
  uid: string;
}

/** 首頁「最近的互動紀錄」清單（使用者需求：首頁近況摘要）。 */
export function RecentInteractionsPanel({ uid }: RecentInteractionsPanelProps) {
  const contacts = useContactsStore((s) => s.contacts);
  const { all, subscribeAll } = useInteractionsStore();
  const { t } = useTranslation();

  useEffect(() => subscribeAll(uid), [uid, subscribeAll]);

  const typeLabel: Record<string, string> = {
    meeting: t('interactionsDialog.typeMeeting'),
    call: t('interactionsDialog.typeCall'),
    email: t('interactionsDialog.typeEmail'),
  };

  const contactLookup = useMemo(() => new Map(contacts.map((c) => [c.id, c.name])), [contacts]);
  const recent = recentInteractions(all, 5);
  if (recent.length === 0) return null;

  return (
    <Card sx={{ m: 2, mb: 0 }} elevation={2}>
      <CardContent>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          {t('dashboard.recentInteractionsTitle')}
        </Typography>
        <Stack spacing={1.5}>
          {recent.map((interaction) => (
            <Box key={interaction.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                {interaction.contactIds.map((id) => (
                  <Chip key={id} label={contactLookup.get(id) ?? t('common.deletedContact')} size="small" />
                ))}
                <Typography variant="caption" color="text.secondary">
                  {typeLabel[interaction.type]} · {interaction.date}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {interaction.description}
              </Typography>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
