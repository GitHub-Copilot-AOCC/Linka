import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useTranslation } from 'react-i18next';
import { useInteractionsStore } from '@ui/store/interactionsStore';
import { suggestTopics, GeminiServiceError } from '@services/geminiService';
import type { Contact } from '@domain/contact';
import type { TopicSuggestion } from '@domain/topicSuggestion';

interface SuggestedTopicsDialogProps {
  uid: string;
  contact: Contact;
  open: boolean;
  onClose: () => void;
}

/** 建議話題對話框（見 spec.md §5.5 項目4、§11.6 AI 卡片樣式）：唯讀建議，不寫入資料庫。 */
export function SuggestedTopicsDialog({ uid, contact, open, onClose }: SuggestedTopicsDialogProps) {
  const { t } = useTranslation();
  const { byContactId, subscribe } = useInteractionsStore();
  const interactions = byContactId[contact.id] ?? [];
  const [suggestions, setSuggestions] = useState<TopicSuggestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const unsubscribe = subscribe(uid, contact.id);
    return unsubscribe;
  }, [open, uid, contact.id, subscribe]);

  useEffect(() => {
    if (!open) {
      setSuggestions(null);
      setError(null);
    }
  }, [open]);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const result = await suggestTopics(contact, interactions);
      setSuggestions(result);
    } catch (err) {
      setError(err instanceof GeminiServiceError ? err.message : t('suggestedTopics.genericError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('suggestedTopics.title', { name: contact.name })}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!suggestions && !loading && (
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {t('suggestedTopics.description')}
          </Typography>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {suggestions && suggestions.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {suggestions.map((s, i) => (
              <Card key={i} variant="elevation" elevation={2}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <AutoAwesomeIcon fontSize="small" color="primary" />
                    <Typography variant="subtitle1">{s.topic}</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {s.reason}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}

        {suggestions && suggestions.length === 0 && (
          <Typography color="text.secondary">{t('suggestedTopics.empty')}</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
        <Button variant="contained" onClick={handleGenerate} disabled={loading}>
          {suggestions ? t('suggestedTopics.regenerate') : t('suggestedTopics.generate')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
