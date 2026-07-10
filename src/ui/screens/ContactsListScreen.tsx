import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Badge,
  Stack,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  IconButton,
  Menu,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Chip,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import StarIcon from '@mui/icons-material/Star';
import HistoryIcon from '@mui/icons-material/History';
import AlarmIcon from '@mui/icons-material/Alarm';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DescriptionIcon from '@mui/icons-material/Description';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import { useTranslation } from 'react-i18next';
import { useContactsStore } from '@ui/store/contactsStore';
import { useTagsStore } from '@ui/store/tagsStore';
import { useInteractionsStore } from '@ui/store/interactionsStore';
import type { NewContactInput, ContactSortBy } from '@domain/contact';
import { filterContactsByKeyword, filterContactsByTag, findContactsByName, sortContacts } from '@domain/contact';
import { latestInteractionDateByContactId, isLongSilence, todayDateString } from '@domain/interaction';
import { ContactInteractionsDialog } from '@ui/components/ContactInteractionsDialog';
import { SetReminderDialog } from '@ui/components/SetReminderDialog';
import { EditContactDialog } from '@ui/components/EditContactDialog';
import { DeleteContactDialog } from '@ui/components/DeleteContactDialog';
import { TagsManagerDialog } from '@ui/components/TagsManagerDialog';
import { ImportContactsDialog } from '@ui/components/ImportContactsDialog';
import { SuggestedTopicsDialog } from '@ui/components/SuggestedTopicsDialog';
import { ContactResearchDialog } from '@ui/components/ContactResearchDialog';
import { BusinessCardScanDialog } from '@ui/components/BusinessCardScanDialog';
import { DocumentImportDialog } from '@ui/components/DocumentImportDialog';
import { QuickCaptureDialog } from '@ui/components/QuickCaptureDialog';
import { TagMultiSelect } from '@ui/components/TagMultiSelect';
import { avatarGradientFor } from '@ui/theme/avatarPalette';
import { PRIMARY_GRADIENT, PRIMARY_SOFT } from '@ui/theme/theme';

interface ContactsListScreenProps {
  uid: string;
}

/** 聯絡人列表：卡片式呈現（見 spec.md §11.4），對照 §5.2 聯絡人管理。 */
export function ContactsListScreen({ uid }: ContactsListScreenProps) {
  const { contacts, subscribe, add } = useContactsStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [newContactTagIds, setNewContactTagIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [topicsContactId, setTopicsContactId] = useState<string | null>(null);
  const [researchContactId, setResearchContactId] = useState<string | null>(null);
  const [reminderContactId, setReminderContactId] = useState<string | null>(null);
  const [editContactId, setEditContactId] = useState<string | null>(null);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuContactId, setMenuContactId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [sortBy, setSortBy] = useState<ContactSortBy>('name');
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [tagsManagerOpen, setTagsManagerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [docImportOpen, setDocImportOpen] = useState(false);
  const { tags, subscribe: subscribeTags } = useTagsStore();
  const { all: allInteractions, subscribeAll: subscribeAllInteractions } = useInteractionsStore();

  useEffect(() => {
    const unsubscribe = subscribe(uid);
    return unsubscribe;
  }, [uid, subscribe]);

  useEffect(() => subscribeTags(uid), [uid, subscribeTags]);

  useEffect(() => subscribeAllInteractions(uid), [uid, subscribeAllInteractions]);

  const visibleContacts = sortContacts(
    filterContactsByTag(filterContactsByKeyword(contacts, keyword), activeTagId),
    sortBy
  );

  const latestInteractionByContact = useMemo(
    () => latestInteractionDateByContactId(allInteractions),
    [allInteractions]
  );
  const today = todayDateString();

  const duplicateNameMatches = useMemo(() => findContactsByName(contacts, name), [contacts, name]);

  async function handleSubmit() {
    const input: NewContactInput = {
      name,
      company: company || undefined,
      tags: newContactTagIds.length > 0 ? newContactTagIds : undefined,
    };
    const result = await add(uid, input);
    if (result.ok) {
      setName('');
      setCompany('');
      setNewContactTagIds([]);
      setFormError(null);
      setDialogOpen(false);
    } else {
      setFormError(Object.values(result.errors ?? {})[0] ?? t('contacts.addContact'));
    }
  }

  return (
    // maxWidth:100% + overflow-x:hidden 當最後一道防線：不管裡面哪個區塊算錯寬度，
    // 這個畫面本身都絕對不會超出可視範圍（見使用者回報：希望畫面固定大小，不要因為
    // 聯絡人欄位文字多寡而變動）。
    <Box sx={{ p: 2, pb: 14, maxWidth: '100%', overflowX: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">{t('contacts.title')}</Typography>
        <Box sx={{ display: 'flex' }}>
          <IconButton aria-label={t('businessCard.menuLabel')} onClick={() => setScanOpen(true)}>
            <CameraAltIcon fontSize="small" />
          </IconButton>
          <IconButton aria-label={t('import.menuLabel')} onClick={() => setImportOpen(true)}>
            <UploadFileIcon fontSize="small" />
          </IconButton>
          <IconButton aria-label={t('docImport.menuLabel')} onClick={() => setDocImportOpen(true)}>
            <DescriptionIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {contacts.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', width: '100%' }}>
          <TextField
            size="small"
            placeholder={t('contacts.searchPlaceholder')}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            slotProps={{ input: { startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1 }} /> } }}
            sx={{ flex: 1, minWidth: 200 }}
          />
          <ToggleButtonGroup
            size="small"
            exclusive
            value={sortBy}
            onChange={(_, value) => value && setSortBy(value)}
          >
            <ToggleButton value="name">{t('contacts.sortByName')}</ToggleButton>
            <ToggleButton value="importance">{t('contacts.sortByImportance')}</ToggleButton>
          </ToggleButtonGroup>
          <IconButton aria-label={t('contacts.tagsManager')} onClick={() => setTagsManagerOpen(true)}>
            <LocalOfferIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {/*
        視覺重新設計 v2：篩選晶片改成灰階，只有選中的那個用主色實心標示（見使用者提供的
        設計系統：色彩收斂到 4 色 + 灰階，不再是每個標籤各自配色的繽紛版本）。
      */}
      {contacts.length > 0 && tags.length > 0 && (
        <Box sx={{ display: 'flex', gap: { xs: 1, sm: 0.75 }, mb: 2, flexWrap: 'wrap', width: '100%' }}>
          <Chip
            label={t('contacts.allTags')}
            size="small"
            onClick={() => setActiveTagId(null)}
            sx={{
              fontSize: { xs: '0.9rem', sm: '0.8125rem' },
              height: { xs: 32, sm: 26 },
              ...(activeTagId === null
                ? { backgroundImage: PRIMARY_GRADIENT, color: '#fff' }
                : { bgcolor: '#F2F2F7', color: '#48484A' }),
            }}
          />
          {tags.map((tag) => {
            const active = activeTagId === tag.id;
            return (
              <Chip
                key={tag.id}
                label={tag.name}
                size="small"
                onClick={() => setActiveTagId(active ? null : tag.id)}
                sx={{
                  fontSize: { xs: '0.9rem', sm: '0.8125rem' },
                  height: { xs: 32, sm: 26 },
                  ...(active
                    ? { bgcolor: PRIMARY_SOFT, color: 'primary.main', fontWeight: 700 }
                    : { bgcolor: '#F2F2F7', color: '#48484A' }),
                }}
              />
            );
          })}
        </Box>
      )}

      {contacts.length === 0 && <Typography color="text.secondary">{t('contacts.empty')}</Typography>}

      {contacts.length > 0 && visibleContacts.length === 0 && (
        <Typography color="text.secondary">{t('contacts.noResults', { keyword })}</Typography>
      )}

      {/* 手機（xs）上放大字體/間距/頭像，讓密集的聯絡人列表在小螢幕上更好讀、觸控範圍更寬鬆
          （見使用者回報：手機上字體太小）；桌面（sm 以上）維持原本較緊湊的密度不變。 */}
      <Stack spacing={{ xs: 2, sm: 1.5 }}>
        {visibleContacts.map((contact) => {
          const stale = isLongSilence(latestInteractionByContact.get(contact.id), today);
          return (
          <Card key={contact.id} variant="elevation" elevation={1}>
            {/*
              手機（xs）強制用直向排列（姓名列在上、圖示列在下），桌面（sm+）維持左右並排。
              兩個子區塊在 xs 都明確給 width:100%，讓卡片寬度永遠固定等於卡片本身寬度，
              不會因為姓名/公司字數長短而變寬變窄（見使用者回報：版面會隨文字長度伸縮）；
              超出寬度的文字直接用 noWrap+ellipsis 截斷即可，不需要完整顯示。
            */}
            <CardContent
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'stretch', sm: 'center' },
                gap: 1,
                p: 2,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  width: { xs: '100%', sm: 'auto' },
                  flex: { sm: '1 1 200px' },
                  minWidth: 0,
                  cursor: 'pointer',
                }}
                onClick={() => navigate(`/contacts/${contact.id}`)}
              >
                <Tooltip title={stale ? t('contacts.longSilenceWarning') : ''} disableHoverListener={!stale}>
                  <Badge
                    color="error"
                    variant="dot"
                    invisible={!stale}
                    overlap="circular"
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  >
                    <Avatar
                      src={contact.photos?.[0]?.url}
                      sx={{
                        width: { xs: 48, sm: 40 },
                        height: { xs: 48, sm: 40 },
                        ...(contact.photos?.[0]?.url
                          ? {}
                          : { backgroundImage: avatarGradientFor(contact.id), color: '#fff' }),
                      }}
                    >
                      {contact.name.charAt(0)}
                    </Avatar>
                  </Badge>
                </Tooltip>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {/* 姓名與公司合併成同一行，讓每張卡片固定是「姓名列 + 圖示列」兩行；
                      列表只顯示公司，不顯示職稱（見使用者回報），職稱仍保留在詳情頁。 */}
                  <Typography
                    variant="subtitle1"
                    noWrap
                    sx={{ fontSize: { xs: '1.15rem', sm: '1rem' } }}
                  >
                    {contact.name}
                    {contact.company && (
                      <Typography
                        component="span"
                        color="text.secondary"
                        sx={{ fontSize: 'inherit' }}
                      >
                        {' · '}
                        {contact.company}
                      </Typography>
                    )}
                  </Typography>
                </Box>
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 0.5,
                  width: { xs: '100%', sm: 'auto' },
                  ml: { sm: 'auto' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 0.5 }}>
                  <StarIcon fontSize="small" sx={{ color: contact.importance >= 4 ? '#F9A825' : '#CBD5E0' }} />
                  <Typography variant="body2" sx={{ fontSize: { xs: '0.95rem', sm: '0.875rem' } }}>
                    {contact.importance}
                  </Typography>
                </Box>
                {/*
                  視覺重新設計 v2：快速操作圖示保留全部功能（見使用者要求），但改成低調的單色
                  線條圖示，不再是每個功能各自配一個淡色圓底（對照新設計系統：色彩收斂到 4 色 +
                  灰階）。提醒已設定時用主色標示，其餘維持中性灰，避免列表看起來五顏六色。
                */}
                <IconButton
                  aria-label={t('contacts.setReminder')}
                  onClick={() => setReminderContactId(contact.id)}
                  size="small"
                  sx={{ color: contact.nextContactReminder ? 'primary.main' : '#8E8E93' }}
                >
                  <AlarmIcon fontSize="small" />
                </IconButton>
                <IconButton
                  aria-label={t('contacts.interactions')}
                  onClick={() => setActiveContactId(contact.id)}
                  size="small"
                  sx={{ color: '#8E8E93' }}
                >
                  <HistoryIcon fontSize="small" />
                </IconButton>
                <IconButton
                  aria-label={t('contacts.suggestedTopics')}
                  onClick={() => setTopicsContactId(contact.id)}
                  size="small"
                  sx={{ color: '#8E8E93' }}
                >
                  <AutoAwesomeIcon fontSize="small" />
                </IconButton>
                <IconButton
                  aria-label={t('contacts.webResearch')}
                  onClick={() => setResearchContactId(contact.id)}
                  size="small"
                  sx={{ color: '#8E8E93' }}
                >
                  <TravelExploreIcon fontSize="small" />
                </IconButton>
                <IconButton
                  aria-label={t('contacts.moreActions')}
                  onClick={(e) => {
                    setMenuAnchor(e.currentTarget);
                    setMenuContactId(contact.id);
                  }}
                  size="small"
                  sx={{ color: '#8E8E93' }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Box>
            </CardContent>
          </Card>
          );
        })}
      </Stack>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            setEditContactId(menuContactId);
            setMenuAnchor(null);
          }}
        >
          {t('contacts.edit')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDeleteContactId(menuContactId);
            setMenuAnchor(null);
          }}
        >
          {t('common.delete')}
        </MenuItem>
      </Menu>

      {editContactId && (
        <EditContactDialog
          uid={uid}
          contact={contacts.find((c) => c.id === editContactId)!}
          open
          onClose={() => setEditContactId(null)}
        />
      )}

      {deleteContactId && (
        <DeleteContactDialog
          uid={uid}
          contactId={deleteContactId}
          contactName={contacts.find((c) => c.id === deleteContactId)?.name ?? ''}
          open
          onClose={() => setDeleteContactId(null)}
        />
      )}

      <TagsManagerDialog uid={uid} open={tagsManagerOpen} onClose={() => setTagsManagerOpen(false)} />

      <ImportContactsDialog uid={uid} open={importOpen} onClose={() => setImportOpen(false)} />

      <BusinessCardScanDialog uid={uid} open={scanOpen} onClose={() => setScanOpen(false)} />

      <DocumentImportDialog uid={uid} open={docImportOpen} onClose={() => setDocImportOpen(false)} />

      {activeContactId && (
        <ContactInteractionsDialog
          uid={uid}
          contactId={activeContactId}
          contactName={contacts.find((c) => c.id === activeContactId)?.name ?? ''}
          open
          onClose={() => setActiveContactId(null)}
        />
      )}

      {reminderContactId && (
        <SetReminderDialog
          uid={uid}
          contact={contacts.find((c) => c.id === reminderContactId)!}
          open
          onClose={() => setReminderContactId(null)}
        />
      )}

      {topicsContactId && (
        <SuggestedTopicsDialog
          uid={uid}
          contact={contacts.find((c) => c.id === topicsContactId)!}
          open
          onClose={() => setTopicsContactId(null)}
        />
      )}

      {researchContactId && (
        <ContactResearchDialog
          uid={uid}
          contact={contacts.find((c) => c.id === researchContactId)!}
          open
          onClose={() => setResearchContactId(null)}
        />
      )}

      <QuickCaptureDialog uid={uid} contacts={contacts} open={quickCaptureOpen} onClose={() => setQuickCaptureOpen(false)} />

      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 'calc(24px + env(safe-area-inset-bottom))', right: 24 }}
        onClick={() => setQuickCaptureOpen(true)}
        aria-label={t('contacts.quickCapture')}
      >
        <AutoAwesomeIcon />
      </Fab>

      <Fab
        color="default"
        size="small"
        sx={{ position: 'fixed', bottom: 'calc(92px + env(safe-area-inset-bottom))', right: 28 }}
        onClick={() => setDialogOpen(true)}
        aria-label={t('contacts.addContact')}
      >
        <PersonAddIcon fontSize="small" />
      </Fab>

      <Dialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setNewContactTagIds([]);
          setFormError(null);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{t('contacts.addContact')}</DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <TextField
            autoFocus
            label={t('contacts.name')}
            fullWidth
            margin="dense"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            label={t('contacts.company')}
            fullWidth
            margin="dense"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          {duplicateNameMatches.length > 0 && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {t('contacts.duplicateNameWarning', { name })}
            </Alert>
          )}
          <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>
            {t('editContact.tags')}
          </Typography>
          <TagMultiSelect uid={uid} selectedIds={newContactTagIds} onChange={setNewContactTagIds} />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDialogOpen(false);
              setNewContactTagIds([]);
              setFormError(null);
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} variant="contained">
            {t('common.add')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
