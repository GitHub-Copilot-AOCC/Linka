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
  Avatar,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import CakeIcon from '@mui/icons-material/Cake';
import StarIcon from '@mui/icons-material/Star';
import ForumIcon from '@mui/icons-material/Forum';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@ui/store/authStore';
import { useContactsStore } from '@ui/store/contactsStore';
import { useInteractionsStore } from '@ui/store/interactionsStore';
import { fetchInteractionsForContacts } from '@data/interactionsRepository';
import { planContactQuery, answerContactQuestion, GeminiServiceError } from '@services/geminiService';
import { selectRelevantContacts, toContactLite, type ChatMessage } from '@domain/assistantChat';
import { countBirthdaysThisMonth, countImportantContacts } from '@domain/contact';
import { countLongSilenceContacts, todayDateString } from '@domain/interaction';
import { PRIMARY_GRADIENT, PRIMARY_SOFT } from '@ui/theme/theme';

const SUGGESTED_QUESTIONS_KEYS = [
  'suggestVipQuiet',
  'suggestBirthdaysUpcoming',
  'suggestRecentSummary',
  'suggestSameCompany',
] as const;

/**
 * AI 個人秘書問答模式（見 spec.md §5.5a、§11.2 導覽目的地「AI 秘書問答」）。
 * 兩階段「先查詢、後生成」：先呼叫 planContactQuery 判斷相關聯絡人，
 * 再用線索從 Firestore 撈出子集，最後呼叫 answerContactQuestion 生成有引用來源的回答。
 * 視覺重新設計 v2（見使用者提供的設計 mockup）：空狀態不再是空白對話框，改成「猜你想問」
 * 建議晶片 + 快速統計，降低使用者自己想 prompt 的門檻。
 */
export function AssistantChatScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { contacts, subscribe } = useContactsStore();
  const { all: interactions, subscribeAll: subscribeInteractions } = useInteractionsStore();
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
    if (!user) return;
    return subscribeInteractions(user.uid);
  }, [user, subscribeInteractions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function ask(question: string) {
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

  const today = todayDateString();
  const longSilenceCount = countLongSilenceContacts(
    contacts.map((c) => c.id),
    interactions,
    today
  );
  const birthdayCount = countBirthdaysThisMonth(contacts, today);
  const importantCount = countImportantContacts(contacts);

  const quickActions = [
    { icon: PersonOffIcon, label: t('assistantChat.quickActionQuiet'), value: longSilenceCount },
    { icon: CakeIcon, label: t('assistantChat.quickActionBirthday'), value: birthdayCount },
    { icon: StarIcon, label: t('assistantChat.quickActionImportant'), value: importantCount },
    { icon: ForumIcon, label: t('assistantChat.quickActionInteractions'), value: interactions.length },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', pb: { xs: 8, md: 0 } }}>
      <Typography variant="h5" sx={{ p: 2, pb: 1 }}>
        {t('assistantChat.title')}
      </Typography>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {messages.length === 0 && (
          <>
            <Box
              sx={{
                borderRadius: 4,
                p: 2.5,
                mb: 1,
                background: `linear-gradient(180deg, ${PRIMARY_SOFT}, transparent)`,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Avatar sx={{ width: 44, height: 44, backgroundImage: PRIMARY_GRADIENT }}>
                <AutoAwesomeIcon />
              </Avatar>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {t('assistantChat.greeting')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('assistantChat.greetingSub')}
                </Typography>
              </Box>
            </Box>

            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
              {t('assistantChat.suggestionsTitle')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {SUGGESTED_QUESTIONS_KEYS.map((key) => (
                <Box
                  key={key}
                  onClick={() => ask(t(`assistantChat.${key}`))}
                  sx={{
                    bgcolor: PRIMARY_SOFT,
                    color: 'primary.main',
                    borderRadius: 3,
                    px: 2,
                    py: 1.25,
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t(`assistantChat.${key}`)}
                </Box>
              ))}
            </Box>

            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
              {t('assistantChat.quickActionsTitle')}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              {quickActions.map(({ icon: Icon, label, value }) => (
                <Box
                  key={label}
                  onClick={() => navigate('/contacts')}
                  sx={{
                    bgcolor: 'background.paper',
                    borderRadius: 3,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                    p: 1.75,
                    cursor: 'pointer',
                  }}
                >
                  <Icon fontSize="small" sx={{ color: 'primary.main', mb: 0.5 }} />
                  <Typography variant="h6" sx={{ fontSize: '1.2rem' }}>
                    {value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
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
              <Card variant="elevation" elevation={0} sx={{ maxWidth: '80%' }}>
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
                  borderRadius: 3,
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
              ask(input.trim());
            }
          }}
          disabled={loading}
        />
        <IconButton
          color="primary"
          aria-label={t('assistantChat.send')}
          onClick={() => ask(input.trim())}
          disabled={loading || !input.trim()}
          sx={{ bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }}
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
