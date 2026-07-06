import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Link,
  Divider,
} from '@mui/material';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import { useTranslation } from 'react-i18next';
import { researchContactProfile, GeminiServiceError } from '@services/geminiService';
import { appendResearchEntry } from '@data/contactsRepository';
import { createResearchEntry, sortResearchLogNewestFirst } from '@domain/contactResearch';
import type { Contact } from '@domain/contact';

interface ContactResearchPanelProps {
  uid: string;
  contact: Contact;
  active: boolean;
}

/**
 * 聯絡人網路身分研究摘要面板（見 spec.md §5.8，僅文字摘要子功能，§11.5 Tabs 頁）：
 * 顯示累積的研究紀錄（新到舊），並提供「搜尋」按鈕觸發新一輪搜尋，結果一律附加而非覆蓋既有紀錄。
 * 抽成獨立元件供 §11.5 詳情頁與既有的 ContactResearchDialog 共用，避免邏輯重複。
 * 照片搜尋子功能（§5.8「照片搜尋」段落）需要額外的圖片搜尋 API/憑證，本次不實作。
 */
export function ContactResearchPanel({ uid, contact, active }: ContactResearchPanelProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) setError(null);
  }, [active]);

  if (!active) return null;

  const researchLog = sortResearchLogNewestFirst(contact.researchLog ?? []);

  async function handleSearch() {
    setLoading(true);
    setError(null);
    try {
      const result = await researchContactProfile(contact);
      const entry = createResearchEntry(result);
      const existingLog = contact.researchLog ?? [];
      await appendResearchEntry(uid, contact.id, existingLog, entry);
    } catch (err) {
      setError(err instanceof GeminiServiceError ? err.message : t('contactResearch.genericError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Alert severity="warning" sx={{ mb: 2 }}>
        {t('contactResearch.disclaimer')}
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {!loading && researchLog.length === 0 && (
        <Typography color="text.secondary">{t('contactResearch.empty')}</Typography>
      )}

      {!loading && researchLog.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
          {researchLog.map((entry, index) => (
            <Card key={entry.id} variant="elevation" elevation={index === 0 ? 2 : 1}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <TravelExploreIcon fontSize="small" color="primary" />
                  <Typography variant="caption" color="text.secondary">
                    {new Date(entry.createdAt).toLocaleString()}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: entry.sourceUrls.length > 0 ? 1 : 0 }}>
                  {entry.summary}
                </Typography>
                {entry.sourceUrls.length > 0 && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
                      {t('contactResearch.sources')}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                      {entry.sourceUrls.map((url) => (
                        <Link key={url} href={url} target="_blank" rel="noopener noreferrer" variant="body2">
                          {url}
                        </Link>
                      ))}
                    </Box>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Button variant="contained" onClick={handleSearch} disabled={loading}>
        {researchLog.length > 0 ? t('contactResearch.searchAgain') : t('contactResearch.search')}
      </Button>
    </>
  );
}
