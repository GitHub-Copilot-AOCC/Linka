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

const TYPE_LABEL: Record<AgentSuggestion['type'], string> = {
  birthday: '生日提醒',
  long_silence: '久未聯絡',
  manual_reminder_due: '手動提醒到期',
};

export function AISuggestionsPanel({ uid }: AISuggestionsPanelProps) {
  const contacts = useContactsStore((state) => state.contacts);
  const { suggestions, subscribe, dismiss, complete } = useSuggestionsStore();
  const [editState, setEditState] = useState<EditState | null>(null);

  useEffect(() => subscribe(uid), [uid, subscribe]);

  const contactLookup = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts]);
  const pendingSuggestions = suggestions.filter((suggestion) => suggestion.status === 'pending');

  if (pendingSuggestions.length === 0) return null;

  return (
    <>
      <Card sx={{ m: 2, mb: 0 }} elevation={2}>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: 'center' }}>
            <AutoAwesomeIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1">今天需要處理</Typography>
          </Stack>

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
                  <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2">
                        {contact?.name ?? '未知聯絡人'} · {TYPE_LABEL[suggestion.type]}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {suggestion.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                        觸發日期：{suggestion.triggerDate}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() =>
                          complete(uid, suggestion, contact?.name ?? '', {
                            description: `已採納 AI 建議：${suggestion.message}`,
                          })
                        }
                      >
                        採納
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
                                : contact?.nextContactReminder ?? '',
                          })
                        }
                      >
                        修改
                      </Button>
                      <Button size="small" color="inherit" onClick={() => dismiss(uid, suggestion.id)}>
                        忽略
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={Boolean(editState)} onClose={() => setEditState(null)} fullWidth maxWidth="sm">
        <DialogTitle>調整 AI 建議</DialogTitle>
        <DialogContent>
          {editState && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="互動描述"
                multiline
                minRows={3}
                value={editState.description}
                onChange={(event) => setEditState({ ...editState, description: event.target.value })}
              />
              <TextField
                label="互動日期"
                type="date"
                value={editState.date}
                onChange={(event) => setEditState({ ...editState, date: event.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="下次提醒日期（可留白）"
                type="date"
                value={editState.nextContactReminder}
                onChange={(event) => setEditState({ ...editState, nextContactReminder: event.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditState(null)}>取消</Button>
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
            儲存
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
