import { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@ui/store/authStore';
import { useContactsStore } from '@ui/store/contactsStore';
import { useInteractionsStore } from '@ui/store/interactionsStore';
import { RemindersPanel } from '@ui/components/RemindersPanel';
import { AISuggestionsPanel } from '@ui/components/AISuggestionsPanel';
import { RecentInteractionsPanel } from '@ui/components/RecentInteractionsPanel';
import { RecentlyAddedContactsPanel } from '@ui/components/RecentlyAddedContactsPanel';
import { UpcomingBirthdaysPanel } from '@ui/components/UpcomingBirthdaysPanel';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import ForumIcon from '@mui/icons-material/Forum';
import CakeIcon from '@mui/icons-material/Cake';
import StarIcon from '@mui/icons-material/Star';
import {
  isReminderDue,
  countRecentlyAddedContacts,
  countBirthdaysThisMonth,
  countImportantContacts,
  contactsAddedWithinHours,
  upcomingBirthdays,
} from '@domain/contact';
import { todayDateString } from '@domain/interaction';

function scrollToRef(ref: React.RefObject<HTMLDivElement>) {
  ref.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
}

/** 依現在時刻回傳日／夜問候語，供首頁大標題使用（見使用者提供的設計 mockup："Good morning, Marvin"）。 */
function greetingKeyForHour(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

/**
 * 首頁儀表板（視覺重新設計 v2，見使用者提供的逐頁設計 mockup）：從條列式清單改成
 * 「AI 人脈作業系統」的儀表板——問候語 + AI 建議 Hero 卡在最上面，接著是今日摘要統計卡
 * （2x2 grid：最近新增／最近互動／本月生日／待跟進），最後是最近互動紀錄清單。
 */
export function DashboardScreen() {
  const { user } = useAuthStore();
  const { contacts, subscribe } = useContactsStore();
  const { all: interactions, subscribeAll: subscribeInteractions } = useInteractionsStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const recentAddedRef = useRef<HTMLDivElement>(null);
  const birthdaysRef = useRef<HTMLDivElement>(null);
  const interactionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    return subscribe(user.uid);
  }, [user, subscribe]);

  useEffect(() => {
    if (!user) return;
    return subscribeInteractions(user.uid);
  }, [user, subscribeInteractions]);

  if (!user) return null;

  const today = todayDateString();
  const hasDue = contacts.some((c) => isReminderDue(c, today));
  const displayName = user.displayName || user.email?.split('@')[0] || '';

  // 「最近新增」「即將到來的生日」清單改用真正的滾動時間窗口（見 domain/contact.ts），
  // 不是「資料庫裡最新的固定 N 筆」——4 張統計卡的數字沿用各自原本的統計口徑（例如
  // 「本月生日」仍是月曆整月），但點擊卡片捲動到的清單用這裡算出的時間窗口結果。
  const recentlyAdded = contactsAddedWithinHours(contacts, Date.now(), 72);
  const birthdaysUpcoming = upcomingBirthdays(contacts, today, 14);

  const stats = [
    {
      key: 'recent',
      icon: PeopleAltIcon,
      value: countRecentlyAddedContacts(contacts),
      label: t('dashboard.statRecentContacts'),
      onClick: () => recentlyAdded.length > 0 && scrollToRef(recentAddedRef),
    },
    {
      key: 'interactions',
      icon: ForumIcon,
      value: interactions.length,
      label: t('dashboard.statInteractions'),
      onClick: () => interactions.length > 0 && scrollToRef(interactionsRef),
    },
    {
      key: 'birthdays',
      icon: CakeIcon,
      value: countBirthdaysThisMonth(contacts, today),
      label: t('dashboard.statBirthdays'),
      onClick: () => birthdaysUpcoming.length > 0 && scrollToRef(birthdaysRef),
    },
    {
      key: 'important',
      icon: StarIcon,
      value: countImportantContacts(contacts),
      label: t('dashboard.statImportant'),
      onClick: () => navigate('/contacts'),
    },
  ];

  return (
    <Box sx={{ pb: 10 }}>
      <Box sx={{ p: 2, pb: 0 }}>
        <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }}>
          {t(`dashboard.greeting.${greetingKeyForHour(new Date().getHours())}`, { name: displayName })}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('dashboard.subtitle')}
        </Typography>
      </Box>

      <AISuggestionsPanel uid={user.uid} />
      <RemindersPanel uid={user.uid} />
      {!hasDue && (
        <Typography color="text.secondary" sx={{ p: 2 }}>
          {t('dashboard.noReminders')}
        </Typography>
      )}

      <Box sx={{ px: 2, pt: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          {t('dashboard.todaySummary')}
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 1 }}>
          {stats.map(({ key, icon: Icon, value, label, onClick }) => (
            <Box
              key={key}
              onClick={onClick}
              sx={{
                bgcolor: 'background.paper',
                borderRadius: 3,
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                p: 1.75,
                cursor: 'pointer',
              }}
            >
              <Icon fontSize="small" sx={{ color: 'primary.main', mb: 0.5 }} />
              <Typography variant="h6" sx={{ fontSize: '1.3rem' }}>
                {value}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
                <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700 }}>
                  {t('dashboard.viewAll')}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Box ref={recentAddedRef}>
        <RecentlyAddedContactsPanel contacts={recentlyAdded} />
      </Box>
      <Box ref={birthdaysRef}>
        <UpcomingBirthdaysPanel birthdays={birthdaysUpcoming} />
      </Box>
      <Box ref={interactionsRef}>
        <RecentInteractionsPanel uid={user.uid} />
      </Box>
    </Box>
  );
}
