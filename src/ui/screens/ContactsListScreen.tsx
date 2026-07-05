import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
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
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useTranslation } from 'react-i18next';
import { useContactsStore } from '@ui/store/contactsStore';
import { useTagsStore } from '@ui/store/tagsStore';
import type { NewContactInput, ContactSortBy } from '@domain/contact';
import { filterContactsByKeyword, filterContactsByTag, sortContacts } from '@domain/contact';
import { ContactInteractionsDialog } from '@ui/components/ContactInteractionsDialog';
import { SetReminderDialog } from '@ui/components/SetReminderDialog';
import { EditContactDialog } from '@ui/components/EditContactDialog';
import { DeleteContactDialog } from '@ui/components/DeleteContactDialog';
import { TagsManagerDialog } from '@ui/components/TagsManagerDialog';
import { ImportContactsDialog } from '@ui/components/ImportContactsDialog';
import { SuggestedTopicsDialog } from '@ui/components/SuggestedTopicsDialog';
import { QuickCaptureDialog } from '@ui/components/QuickCaptureDialog';

interface ContactsListScreenProps {
  uid: string;
}

/** 聯絡人列表：卡片式呈現（見 spec.md §11.4），對照 §5.2 聯絡人管理。 */
export function ContactsListScreen({ uid }: ContactsListScreenProps) {
  const { contacts, subscribe, add } = useContactsStore();
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [topicsContactId, setTopicsContactId] = useState<string | null>(null);
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
  const { tags, subscribe: subscribeTags } = useTagsStore();

  useEffect(() => {
    const unsubscribe = subscribe(uid);
    return unsubscribe;
  }, [uid, subscribe]);

  useEffect(() => subscribeTags(uid), [uid, subscribeTags]);

  const visibleContacts = sortContacts(
    filterContactsByTag(filterContactsByKeyword(contacts, keyword), activeTagId),
    sortBy
  );

  async function handleSubmit() {
    const input: NewContactInput = { name, company: company || undefined };
    const result = await add(uid, input);
    if (result.ok) {
      setName('');
      setCompany('');
      setFormError(null);
      setDialogOpen(false);
    } else {
      setFormError(Object.values(result.errors ?? {})[0] ?? t('contacts.addContact'));
    }
  }

  return (
    <Box sx={{ p: 2, pb: 14 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">{t('contacts.title')}</Typography>
        <IconButton aria-label={t('import.menuLabel')} onClick={() => setImportOpen(true)}>
          <UploadFileIcon fontSize="small" />
        </IconButton>
      </Box>

      {contacts.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
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

      {contacts.length > 0 && tags.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {tags.map((tag) => (
            <Chip
              key={tag.id}
              label={tag.name}
              size="small"
              onClick={() => setActiveTagId(activeTagId === tag.id ? null : tag.id)}
              color={activeTagId === tag.id ? 'primary' : 'default'}
              variant={activeTagId === tag.id ? 'filled' : 'outlined'}
            />
          ))}
        </Box>
      )}

      {contacts.length === 0 && <Typography color="text.secondary">{t('contacts.empty')}</Typography>}

      {contacts.length > 0 && visibleContacts.length === 0 && (
        <Typography color="text.secondary">{t('contacts.noResults', { keyword })}</Typography>
      )}

      <Stack spacing={1.5}>
        {visibleContacts.map((contact) => (
          <Card key={contact.id} variant="elevation" elevation={1}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar src={contact.photos?.[0]?.url}>{contact.name.charAt(0)}</Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1">{contact.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {[contact.role, contact.company].filter(Boolean).join(' · ') || ' '}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <StarIcon fontSize="small" color={contact.importance >= 4 ? 'warning' : 'disabled'} />
                <Typography variant="body2">{contact.importance}</Typography>
              </Box>
              <IconButton
                aria-label={t('contacts.setReminder')}
                onClick={() => setReminderContactId(contact.id)}
                color={contact.nextContactReminder ? 'primary' : 'default'}
              >
                <AlarmIcon fontSize="small" />
              </IconButton>
              <IconButton aria-label={t('contacts.interactions')} onClick={() => setActiveContactId(contact.id)}>
                <HistoryIcon fontSize="small" />
              </IconButton>
              <IconButton
                aria-label={t('contacts.suggestedTopics')}
                onClick={() => setTopicsContactId(contact.id)}
              >
                <AutoAwesomeIcon fontSize="small" />
              </IconButton>
              <IconButton
                aria-label={t('contacts.moreActions')}
                onClick={(e) => {
                  setMenuAnchor(e.currentTarget);
                  setMenuContactId(contact.id);
                }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </CardContent>
          </Card>
        ))}
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

      <QuickCaptureDialog uid={uid} contacts={contacts} open={quickCaptureOpen} onClose={() => setQuickCaptureOpen(false)} />

      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        onClick={() => setQuickCaptureOpen(true)}
        aria-label={t('contacts.quickCapture')}
      >
        <AutoAwesomeIcon />
      </Fab>

      <Fab
        color="default"
        size="small"
        sx={{ position: 'fixed', bottom: 92, right: 28 }}
        onClick={() => setDialogOpen(true)}
        aria-label={t('contacts.addContact')}
      >
        <PersonAddIcon fontSize="small" />
      </Fab>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} variant="contained">
            {t('common.add')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
