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
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import { useTranslation } from 'react-i18next';
import { researchContactProfile, GeminiServiceError } from '@services/geminiService';
import { appendResearchEntry, updateContact } from '@data/contactsRepository';
import { createResearchEntry, sortResearchLogNewestFirst, type ExtractedContactFields } from '@domain/contactResearch';
import type { Contact } from '@domain/contact';

interface ContactResearchPanelProps {
  uid: string;
  contact: Contact;
  active: boolean;
}

type ExtractableKey = keyof ExtractedContactFields;

const FIELD_LABEL_KEYS: Record<ExtractableKey, string> = {
  role: 'editContact.role',
  company: 'contacts.company',
  linkedin: 'editContact.linkedin',
  facebook: 'editContact.facebook',
  twitter: 'editContact.twitter',
  birthday: 'editContact.birthday',
};

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
  const [pendingFields, setPendingFields] = useState<ExtractedContactFields | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<ExtractableKey>>(new Set());
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!active) setError(null);
  }, [active]);

  if (!active) return null;

  const researchLog = sortResearchLogNewestFirst(contact.researchLog ?? []);

  async function handleSearch() {
    setLoading(true);
    setError(null);
    setPendingFields(null);
    try {
      const result = await researchContactProfile(contact);
      const entry = createResearchEntry(result);
      const existingLog = contact.researchLog ?? [];
      await appendResearchEntry(uid, contact.id, existingLog, entry);

      if (entry.extractedFields && Object.keys(entry.extractedFields).length > 0) {
        // 只自動勾選聯絡人「目前欄位是空白」的候選；已經有值的欄位仍顯示候選，但預設
        // 不勾選，需要使用者主動勾選才會覆蓋既有資料（跟 iOS 版一致的覆蓋行為）。
        const initialSelected = new Set<ExtractableKey>();
        for (const key of Object.keys(entry.extractedFields) as ExtractableKey[]) {
          if (!contact[key]) initialSelected.add(key);
        }
        setPendingFields(entry.extractedFields);
        setSelectedKeys(initialSelected);
      }
    } catch (err) {
      setError(err instanceof GeminiServiceError ? err.message : t('contactResearch.genericError'));
    } finally {
      setLoading(false);
    }
  }

  function toggleField(key: ExtractableKey) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleApplyFields() {
    if (!pendingFields) return;
    setApplying(true);
    try {
      const patch: Partial<Contact> = {};
      for (const key of selectedKeys) {
        const value = pendingFields[key];
        if (value) patch[key] = value;
      }
      if (Object.keys(patch).length > 0) {
        await updateContact(uid, contact.id, patch);
      }
      setPendingFields(null);
    } finally {
      setApplying(false);
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

      {pendingFields && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t('contactResearch.fieldsFoundTitle')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {(Object.keys(pendingFields) as ExtractableKey[]).map((key) => {
                const newValue = pendingFields[key];
                if (!newValue) return null;
                const currentValue = contact[key] as string | undefined;
                return (
                  <FormControlLabel
                    key={key}
                    control={<Checkbox checked={selectedKeys.has(key)} onChange={() => toggleField(key)} />}
                    label={
                      <Box>
                        <Typography variant="body2">{t(FIELD_LABEL_KEYS[key])}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {currentValue
                            ? t('contactResearch.fieldChangeFrom', { value: currentValue })
                            : t('contactResearch.fieldEmptyValue')}
                          {' → '}
                          {newValue}
                        </Typography>
                      </Box>
                    }
                  />
                );
              })}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
              <Button onClick={() => setPendingFields(null)}>{t('contactResearch.dismissFields')}</Button>
              <Button
                variant="contained"
                onClick={handleApplyFields}
                disabled={applying || selectedKeys.size === 0}
              >
                {t('contactResearch.applyFields')}
              </Button>
            </Box>
          </CardContent>
        </Card>
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
