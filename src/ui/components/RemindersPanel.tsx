import { Card, CardContent, Typography, Stack, Chip, Button, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useContactsStore } from '@ui/store/contactsStore';
import { isReminderDue, sortByReminderDate } from '@domain/contact';
import { todayDateString } from '@domain/interaction';

interface RemindersPanelProps {
  uid: string;
}

/** 首頁待辦提醒清單（見 spec.md §5.4）：只顯示 nextContactReminder 已到期或逾期的聯絡人。 */
export function RemindersPanel({ uid }: RemindersPanelProps) {
  const { contacts, update } = useContactsStore();
  const { t } = useTranslation();
  const today = todayDateString();
  const due = sortByReminderDate(contacts.filter((c) => isReminderDue(c, today)));

  if (due.length === 0) return null;

  return (
    <Card sx={{ m: 2, mb: 0 }} elevation={2}>
      <CardContent>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          {t('reminders.title')}
        </Typography>
        <Stack spacing={1}>
          {due.map((contact) => (
            <Box key={contact.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip label={contact.name} size="small" />
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                {t('reminders.dateLabel', { date: contact.nextContactReminder })}
              </Typography>
              <Button size="small" onClick={() => update(uid, contact.id, { nextContactReminder: undefined })}>
                {t('reminders.markDone')}
              </Button>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
