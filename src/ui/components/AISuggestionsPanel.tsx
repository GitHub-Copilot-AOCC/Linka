import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useTranslation } from 'react-i18next';
import type { AgentSuggestion } from '@domain/agentSuggestion';
import { todayDateString } from '@domain/interaction';
import { useContactsStore } from '@ui/store/contactsStore';
import { useSuggestionsStore } from '@ui/store/suggestionsStore';

interface AISuggestionsPanelProps {
  uid: string;
}

interface EditState {
  suggestion: AgentSuggestion;
  description: string;
  date: string;
  nextContactReminder: string;
}

/** 首頁「今天需要處理」的 AI 主動建議清單（見 spec.md §5.6、§11.3）。 */
export function AISuggestionsPanel({ uid }: AISuggestionsPanelProps) {
  const { t } = useTranslation();
  const contacts = useContactsStore((state) => state.contacts);
  const { suggestions, subscribe, dismiss, complete } = useSuggestionsStore();
  const [editState, setEditState] = useState<EditState | null>(null);

  const TYPE_LABEL: Record<AgentSuggestion['type'], string> = {
    birthday: t('aiSuggestions.typeBirthday'),
    long_silence: t('aiSuggestions.typeLongSilence'),
    manual_reminder_due: t('aiSuggestions.typeManualReminderDue'),
  };

  useEffect(() => subscribe(uid), [uid, subscribe]);

  const contactLookup = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts]);
  const pendingSuggestions = suggestions.filter((suggestion) => suggestion.status === 'pending');

  if (pendingSuggestions.length === 0) return null;

  return (
    <>
      <Card sx={{ m: 2, mb: 0 }} elevation={2}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <AutoAwesomeIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1">{t('aiSuggestions.title')}</Typography>
          </Box>

          <Stack spacing={1.5}>
            {pendingSuggestions.map((suggestion) => {
              const contact = contactLookup.get(suggestion.contactId);
              return (
                <Box
                  key={suggestion.id}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 1.5,
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2">
                        {contact?.name ?? t('aiSuggestions.unknownContact')} · {TYPE_LABEL[suggestion.type]}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {suggestion.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                        {t('aiSuggestions.triggerDate', { date: suggestion.triggerDate })}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() =>
                          complete(uid, suggestion, contact?.name ?? '', {
                            description: t('aiSuggestions.adoptedDescription', { message: suggestion.message }),
                          })
                        }
                      >
                        {t('aiSuggestions.adopt')}
                      </Button>
                      <Button
                        size="small"
                        onClick={() =>
                          setEditState({
                            suggestion,
                            description: suggestion.message,
                            date: todayDateString(),
                            nextContactReminder:
                              suggestion.type === 'manual_reminder_due'
                                ? ''
                                : (contact?.nextContactReminder ?? ''),
                          })
                        }
                      >
                        {t('aiSuggestions.edit')}
                      </Button>
                      <Button size="small" color="inherit" onClick={() => dismiss(uid, suggestion.id)}>
                        {t('aiSuggestions.dismiss')}
                      </Button>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={Boolean(editState)} onClose={() => setEditState(null)} fullWidth maxWidth="sm">
        <DialogTitle>{t('aiSuggestions.editTitle')}</DialogTitle>
        <DialogContent>
          {editState && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label={t('aiSuggestions.interactionDescription')}
                multiline
                minRows={3}
                value={editState.description}
                onChange={(event) => setEditState({ ...editState, description: event.target.value })}
              />
              <TextField
                label={t('aiSuggestions.interactionDate')}
                type="date"
                value={editState.date}
                onChange={(event) => setEditState({ ...editState, date: event.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label={t('aiSuggestions.nextReminderOptional')}
                type="date"
                value={editState.nextContactReminder}
                onChange={(event) => setEditState({ ...editState, nextContactReminder: event.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditState(null)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (!editState) return;
              const contactName = contactLookup.get(editState.suggestion.contactId)?.name ?? '';
              await complete(uid, editState.suggestion, contactName, {
                description: editState.description,
                date: editState.date,
                nextContactReminder: editState.nextContactReminder || undefined,
              });
              setEditState(null);
            }}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
