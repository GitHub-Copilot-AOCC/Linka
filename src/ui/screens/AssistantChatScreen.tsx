import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@ui/store/authStore';
import { useContactsStore } from '@ui/store/contactsStore';
import { fetchInteractionsForContacts } from '@data/interactionsRepository';
import { planContactQuery, answerContactQuestion, GeminiServiceError } from '@services/geminiService';
import { selectRelevantContacts, toContactLite, type ChatMessage } from '@domain/assistantChat';

/**
 * AI 個人秘書問答模式（見 spec.md §5.5a、§11.2 導覽目的地「AI 秘書問答」）。
 * 兩階段「先查詢、後生成」：先呼叫 planContactQuery 判斷相關聯絡人，
 * 再用線索從 Firestore 撈出子集，最後呼叫 answerContactQuestion 生成有引用來源的回答。
 */
export function AssistantChatScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { contacts, subscribe } = useContactsStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    return subscribe(user.uid);
  }, [user, subscribe]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSend() {
    const question = input.trim();
    if (!question || !user || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      // 第一階段：查詢規劃，只送輕量聯絡人清單（不含完整資料）。
      const plan = await planContactQuery(question, toContactLite(contacts));
      // 依規劃結果從記憶體中的聯絡人清單挑出相關子集。
      const relevantContacts = selectRelevantContacts(contacts, plan);
      // 第二階段前：一次性從 Firestore 撈出這個子集的互動紀錄（而非整個資料庫）。
      const interactionsByContactId = await fetchInteractionsForContacts(
        user.uid,
        relevantContacts.map((c) => c.id)
      );
      // 第二階段：生成有引用來源的回答。
      const result = await answerContactQuestion(question, relevantContacts, interactionsByContactId);

      setMessages((prev) => [...prev, { role: 'assistant', text: result.answer, citations: result.citations }]);
    } catch (err) {
      setError(err instanceof GeminiServiceError ? err.message : t('assistantChat.genericError'));
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', pb: { xs: 8, md: 0 } }}>
      <Typography variant="h5" sx={{ p: 2, pb: 1 }}>
        {t('assistantChat.title')}
      </Typography>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {messages.length === 0 && (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            {t('assistantChat.emptyHint')}
          </Typography>
        )}

        {messages.map((message, index) => (
          <Box
            key={index}
            sx={{
              display: 'flex',
              justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {message.role === 'assistant' ? (
              <Card variant="elevation" elevation={2} sx={{ maxWidth: '80%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <AutoAwesomeIcon fontSize="small" color="primary" />
                    <Typography variant="subtitle2">{t('assistantChat.assistantLabel')}</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {message.text}
                  </Typography>
                  {message.citations && message.citations.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1.5 }}>
                      {message.citations.map((citation, i) => (
                        <Chip
                          key={i}
                          size="small"
                          variant="outlined"
                          label={
                            citation.interactionDate
                              ? t('assistantChat.citationWithDate', {
                                  name: citation.contactName,
                                  date: citation.interactionDate,
                                })
                              : citation.contactName
                          }
                        />
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Box
                sx={{
                  maxWidth: '80%',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  borderRadius: 2,
                  px: 2,
                  py: 1,
                }}
              >
                <Typography variant="body2">{message.text}</Typography>
              </Box>
            )}
          </Box>
        ))}

        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              {t('assistantChat.thinking')}
            </Typography>
          </Box>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        <div ref={bottomRef} />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder={t('assistantChat.inputPlaceholder')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={loading}
        />
        <IconButton
          color="primary"
          aria-label={t('assistantChat.send')}
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
