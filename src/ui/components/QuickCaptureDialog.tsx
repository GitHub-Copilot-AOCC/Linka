import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import type { Contact } from '@domain/contact';
import { todayDateString } from '@domain/interaction';
import { parseQuickCapturePreview, type QuickCapturePreview } from '@services/geminiProxy';
import { useContactsStore } from '@ui/store/contactsStore';
import { createInteraction } from '@data/interactionsRepository';
import { createLogEntry } from '@data/logsRepository';
import { updateContact } from '@data/contactsRepository';

interface QuickCaptureDialogProps {
  uid: string;
  contacts: Contact[];
  open: boolean;
  onClose: () => void;
}

type CaptureMode = 'text' | 'audio';

type PreviewSelectionState = {
  reminders: Record<string, boolean>;
  importance: Record<string, boolean>;
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read audio blob'));
        return;
      }
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read audio blob'));
    reader.readAsDataURL(blob);
  });
}

export function QuickCaptureDialog({ uid, contacts, open, onClose }: QuickCaptureDialogProps) {
  const addContact = useContactsStore((state) => state.add);
  const [mode, setMode] = useState<CaptureMode>('text');
  const [textInput, setTextInput] = useState('');
  const [preview, setPreview] = useState<QuickCapturePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string>('audio/webm');
  const [selection, setSelection] = useState<PreviewSelectionState>({ reminders: {}, importance: {} });
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const contactLookup = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts]);

  const resetState = () => {
    setMode('text');
    setTextInput('');
    setPreview(null);
    setLoading(false);
    setSaving(false);
    setError(null);
    setIsRecording(false);
    setAudioBlob(null);
    setAudioMimeType('audio/webm');
    setSelection({ reminders: {}, importance: {} });
  };

  const handleClose = () => {
    if (isRecording && recorderRef.current) {
      recorderRef.current.stop();
    }
    resetState();
    onClose();
  };

  async function handleStartRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setAudioBlob(blob);
        setAudioMimeType(recorder.mimeType || 'audio/webm');
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
      };
      recorderRef.current = recorder;
      recorder.start();
      setAudioBlob(null);
      setIsRecording(true);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleStopRecording() {
    recorderRef.current?.stop();
  }

  async function handleGeneratePreview() {
    if (!navigator.onLine) {
      setError('離線時無法使用 AI 快速記錄。');
      return;
    }
    if (mode === 'text' && textInput.trim().length === 0) {
      setError('請先輸入一段文字描述。');
      return;
    }
    if (mode === 'audio' && !audioBlob) {
      setError('請先完成一段錄音。');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const audioBase64 = audioBlob ? await blobToBase64(audioBlob) : undefined;
      const nextPreview = await parseQuickCapturePreview({
        textInput: textInput.trim() || undefined,
        audioBase64,
        audioMimeType: audioBase64 ? audioMimeType : undefined,
        existingContacts: contacts.map((contact) => ({
          id: contact.id,
          name: contact.name,
          company: contact.company,
          role: contact.role,
          importance: contact.importance,
          nextContactReminder: contact.nextContactReminder,
          birthday: contact.birthday,
        })),
        today: todayDateString(),
      });
      setPreview(nextPreview);
      setSelection({
        reminders: Object.fromEntries(nextPreview.reminderSuggestions.map((item) => [item.contactReferenceId, true])),
        importance: Object.fromEntries(nextPreview.importanceSuggestions.map((item) => [item.contactReferenceId, false])),
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;

    setSaving(true);
    setError(null);

    try {
      const referenceMap = new Map<string, string[]>();

      for (const match of preview.contactMatches) {
        if (match.matchedContactIds.length > 0) {
          referenceMap.set(match.referenceId, match.matchedContactIds);
          continue;
        }

        if (!match.suggestedNewContactName) {
          referenceMap.set(match.referenceId, []);
          continue;
        }

        const created = await addContact(uid, {
          name: match.suggestedNewContactName,
        });
        if (!created.ok || !created.id) {
          throw new Error(`無法建立新聯絡人：${match.suggestedNewContactName}`);
        }
        referenceMap.set(match.referenceId, [created.id]);
      }

      for (const interaction of preview.suggestedInteractions) {
        const contactIds = interaction.contactReferenceIds.flatMap((referenceId) => referenceMap.get(referenceId) ?? []);
        if (contactIds.length === 0) continue;

        await createInteraction(uid, {
          contactIds,
          type: interaction.type,
          description: interaction.description,
          date: interaction.date,
          source: 'ai_quick_capture',
          rawInput: textInput.trim() || interaction.rawInput,
        });
      }

      for (const reminder of preview.reminderSuggestions) {
        if (!selection.reminders[reminder.contactReferenceId]) continue;
        const [contactId] = referenceMap.get(reminder.contactReferenceId) ?? [];
        if (!contactId) continue;
        await updateContact(uid, contactId, { nextContactReminder: reminder.suggestedDate });
      }

      for (const suggestion of preview.importanceSuggestions) {
        if (!selection.importance[suggestion.contactReferenceId]) continue;
        const [contactId] = referenceMap.get(suggestion.contactReferenceId) ?? [];
        if (!contactId) continue;
        await updateContact(uid, contactId, { importance: suggestion.suggestedImportance });
      }

      await createLogEntry(uid, {
        action: 'AI 快速記錄',
        contactName: preview.contactMatches
          .map((item) => {
            const matched = item.matchedContactIds
              .map((id) => contactLookup.get(id)?.name)
              .filter(Boolean)
              .join('、');
            return matched || item.suggestedNewContactName || '未命名';
          })
          .join('、'),
        type: 'interaction',
        details: preview.summary,
      });

      handleClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle>AI 快速記錄</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <ToggleButtonGroup
            size="small"
            exclusive
            value={mode}
            onChange={(_, value) => value && setMode(value)}
          >
            <ToggleButton value="text">文字</ToggleButton>
            <ToggleButton value="audio">語音</ToggleButton>
          </ToggleButtonGroup>

          {mode === 'text' ? (
            <TextField
              label="輸入剛剛發生的互動"
              multiline
              minRows={4}
              value={textInput}
              onChange={(event) => setTextInput(event.target.value)}
              placeholder="例如：今天和王小明吃午餐，他說下週會介紹產品經理給我，兩週後提醒我再跟進。"
            />
          ) : (
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="subtitle2">語音輸入</Typography>
                    <Typography variant="body2" color="text.secondary">
                      直接錄下一段描述，AI 會拆成互動、提醒與建議。
                    </Typography>
                  </Box>
                  {isRecording ? (
                    <Button color="error" variant="contained" startIcon={<StopIcon />} onClick={handleStopRecording}>
                      停止
                    </Button>
                  ) : (
                    <Button variant="contained" startIcon={<MicIcon />} onClick={handleStartRecording}>
                      開始錄音
                    </Button>
                  )}
                </Stack>
                {audioBlob && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    已錄製 {Math.max(1, Math.round(audioBlob.size / 1024))} KB 音訊
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}

          <Button
            variant="contained"
            startIcon={<AutoAwesomeIcon />}
            onClick={handleGeneratePreview}
            disabled={loading || saving || isRecording}
          >
            {loading ? '產生預覽中…' : '產生預覽'}
          </Button>

          {preview && (
            <Stack spacing={2}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    AI 預覽摘要
                  </Typography>
                  <Typography variant="body2">{preview.summary}</Typography>
                </CardContent>
              </Card>

              <Card elevation={2}>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    聯絡人比對
                  </Typography>
                  <Stack spacing={1}>
                    {preview.contactMatches.map((match) => (
                      <Box key={match.referenceId}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                          <Chip label={match.confidence} size="small" color={match.confidence === 'high' ? 'success' : 'default'} />
                          {match.matchedContactIds.map((contactId) => (
                            <Chip key={contactId} label={contactLookup.get(contactId)?.name ?? contactId} size="small" />
                          ))}
                          {match.suggestedNewContactName && (
                            <Chip label={`新聯絡人：${match.suggestedNewContactName}`} size="small" color="primary" variant="outlined" />
                          )}
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {match.reason}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>

              <Card elevation={2}>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    建議寫入的互動
                  </Typography>
                  <Stack spacing={1}>
                    {preview.suggestedInteractions.map((interaction, index) => (
                      <Box key={`${interaction.date}-${index}`}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                          <Chip label={interaction.type} size="small" />
                          <Chip label={interaction.date} size="small" variant="outlined" />
                        </Stack>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {interaction.description}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>

              {preview.reminderSuggestions.length > 0 && (
                <Card elevation={2}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      提醒建議
                    </Typography>
                    <Stack spacing={1}>
                      {preview.reminderSuggestions.map((suggestion) => (
                        <FormControlLabel
                          key={suggestion.contactReferenceId}
                          control={
                            <Checkbox
                              checked={Boolean(selection.reminders[suggestion.contactReferenceId])}
                              onChange={(event) =>
                                setSelection((state) => ({
                                  ...state,
                                  reminders: {
                                    ...state.reminders,
                                    [suggestion.contactReferenceId]: event.target.checked,
                                  },
                                }))
                              }
                            />
                          }
                          label={`${suggestion.suggestedDate} · ${suggestion.reason}`}
                        />
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {preview.importanceSuggestions.length > 0 && (
                <Card elevation={2}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      星級建議
                    </Typography>
                    <Stack spacing={1}>
                      {preview.importanceSuggestions.map((suggestion) => (
                        <FormControlLabel
                          key={suggestion.contactReferenceId}
                          control={
                            <Checkbox
                              checked={Boolean(selection.importance[suggestion.contactReferenceId])}
                              onChange={(event) =>
                                setSelection((state) => ({
                                  ...state,
                                  importance: {
                                    ...state.importance,
                                    [suggestion.contactReferenceId]: event.target.checked,
                                  },
                                }))
                              }
                            />
                          }
                          label={`建議星級 ${suggestion.suggestedImportance} · ${suggestion.reason}`}
                        />
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>取消</Button>
        <Button variant="contained" onClick={handleConfirm} disabled={!preview || loading || saving}>
          {saving ? '寫入中…' : '確認寫入'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
