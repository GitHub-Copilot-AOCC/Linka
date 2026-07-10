import { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import type { AgentSuggestion } from '@domain/agentSuggestion';
import { todayDateString } from '@domain/interaction';
import { useContactsStore } from '@ui/store/contactsStore';
import { useSuggestionsStore } from '@ui/store/suggestionsStore';
import { avatarGradientFor } from '@ui/theme/avatarPalette';
import { PRIMARY_SOFT } from '@ui/theme/theme';

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
      {/*
        視覺重新設計 v2（見使用者提供的設計 mockup）：AI 建議從「清單卡片」改成醒目的
        淡紫漸層 Hero 卡，頭像 + 訊息 + 一個主要動作按鈕（建立提醒），修改/忽略降為次要
        文字按鈕。多筆待處理建議時，每筆各自一張 Hero 卡、直向堆疊，保留完整功能。
      */}
      <Stack spacing={1.5} sx={{ px: 2, pt: 2 }}>
        {pendingSuggestions.map((suggestion) => {
          const contact = contactLookup.get(suggestion.contactId);
          return (
            <Box
              key={suggestion.id}
              sx={{
                borderRadius: 4,
                p: 2,
                background: `linear-gradient(180deg, ${PRIMARY_SOFT}, transparent)`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <AutoAwesomeIcon color="primary" fontSize="small" />
                <Typography variant="subtitle2" sx={{ color: 'primary.main', fontWeight: 700 }}>
                  {t('aiSuggestions.title')} · {TYPE_LABEL[suggestion.type]}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar
                  src={contact?.photos?.[0]?.url}
                  sx={{
                    width: 44,
                    height: 44,
                    ...(contact?.photos?.[0]?.url
                      ? {}
                      : { backgroundImage: avatarGradientFor(suggestion.contactId), color: '#fff' }),
                  }}
                >
                  {(contact?.name ?? '?').charAt(0)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
                    {contact?.name ?? t('aiSuggestions.unknownContact')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {suggestion.message}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
                <Button
                  variant="contained"
                  size="small"
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
                  startIcon={<EditIcon fontSize="small" />}
                  onClick={() =>
                    setEditState({
                      suggestion,
                      description: suggestion.message,
                      date: todayDateString(),
                      nextContactReminder:
                        suggestion.type === 'manual_reminder_due' ? '' : (contact?.nextContactReminder ?? ''),
                    })
                  }
                >
                  {t('aiSuggestions.edit')}
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<CloseIcon fontSize="small" />}
                  onClick={() => dismiss(uid, suggestion.id)}
                >
                  {t('aiSuggestions.dismiss')}
                </Button>
              </Box>
            </Box>
          );
        })}
      </Stack>

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
