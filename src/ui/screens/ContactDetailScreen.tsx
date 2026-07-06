import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Tabs, Tab, Typography, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useTranslation } from 'react-i18next';
import { useContactsStore } from '@ui/store/contactsStore';
import { ContactBasicInfoPanel } from '@ui/components/ContactBasicInfoPanel';
import { ContactInteractionsPanel } from '@ui/components/ContactInteractionsPanel';
import { ContactResearchPanel } from '@ui/components/ContactResearchPanel';

interface ContactDetailScreenProps {
  uid: string;
}

type TabKey = 'basic' | 'interactions' | 'research';

/**
 * 聯絡人詳情頁（見 spec.md §11.5）：以 Material Tabs 呈現「基本資料」「互動紀錄」
 * 「網路研究摘要」，取代舊版單頁長捲軸。各分頁只在啟用時掛載內容（lazy load）。
 */
export function ContactDetailScreen({ uid }: ContactDetailScreenProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { contactId } = useParams<{ contactId: string }>();
  const contact = useContactsStore((s) => s.contacts.find((c) => c.id === contactId));
  const [tab, setTab] = useState<TabKey>('basic');

  if (!contact) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary">{t('contactDetail.notFound')}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, pb: 0 }}>
        <IconButton aria-label={t('common.back')} onClick={() => navigate('/contacts')}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5">{contact.name}</Typography>
      </Box>

      <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="fullWidth" sx={{ mt: 1 }}>
        <Tab value="basic" label={t('contactDetail.tabBasic')} />
        <Tab value="interactions" label={t('contactDetail.tabInteractions')} />
        <Tab value="research" label={t('contactDetail.tabResearch')} />
      </Tabs>

      <Box sx={{ p: 2 }}>
        <ContactBasicInfoPanel uid={uid} contact={contact} active={tab === 'basic'} />
        <ContactInteractionsPanel
          uid={uid}
          contactId={contact.id}
          contactName={contact.name}
          active={tab === 'interactions'}
        />
        <ContactResearchPanel uid={uid} contact={contact} active={tab === 'research'} />
      </Box>
    </Box>
  );
}
