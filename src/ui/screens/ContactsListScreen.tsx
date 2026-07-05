import { useEffect, useMemo, useState } from 'react';
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
  Tooltip,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import StarIcon from '@mui/icons-material/Star';
import HistoryIcon from '@mui/icons-material/History';
import AlarmIcon from '@mui/icons-material/Alarm';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import { useContactsStore } from '@ui/store/contactsStore';
import { useTagsStore } from '@ui/store/tagsStore';
import type { NewContactInput, ContactSortBy } from '@domain/contact';
import { filterContactsByKeyword, filterContactsByTag, sortContacts } from '@domain/contact';
import { ContactInteractionsDialog } from '@ui/components/ContactInteractionsDialog';
import { SetReminderDialog } from '@ui/components/SetReminderDialog';
import { EditContactDialog } from '@ui/components/EditContactDialog';
import { DeleteContactDialog } from '@ui/components/DeleteContactDialog';
import { TagsManagerDialog } from '@ui/components/TagsManagerDialog';
import { QuickCaptureDialog } from '@ui/components/QuickCaptureDialog';

interface ContactsListScreenProps {
  uid: string;
}

export function ContactsListScreen({ uid }: ContactsListScreenProps) {
  const { contacts, subscribe, add } = useContactsStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [reminderContactId, setReminderContactId] = useState<string | null>(null);
  const [editContactId, setEditContactId] = useState<string | null>(null);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuContactId, setMenuContactId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [sortBy, setSortBy] = useState<ContactSortBy>('name');
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [tagsManagerOpen, setTagsManagerOpen] = useState(false);
  const { tags, subscribe: subscribeTags } = useTagsStore();

  useEffect(() => {
    const unsubscribe = subscribe(uid);
    return unsubscribe;
  }, [uid, subscribe]);

  useEffect(() => subscribeTags(uid), [uid, subscribeTags]);

  const visibleContacts = useMemo(
    () => sortContacts(filterContactsByTag(filterContactsByKeyword(contacts, keyword), activeTagId), sortBy),
    [contacts, keyword, activeTagId, sortBy]
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
      setFormError(Object.values(result.errors ?? {})[0] ?? '新增聯絡人失敗');
    }
  }

  return (
    <Box sx={{ p: 2, pb: 14 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        聯絡人
      </Typography>

      {contacts.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="搜尋姓名、公司或職稱"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            slotProps={{ input: { startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1 }} /> } }}
            sx={{ flex: 1, minWidth: 200 }}
          />
          <ToggleButtonGroup
            size="small"
            exclusive
            value={sortBy}
            onChange={(_, value) => value && setSortBy(value)}
          >
            <ToggleButton value="name">姓名</ToggleButton>
            <ToggleButton value="importance">星級</ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title="管理標籤">
            <IconButton aria-label="管理標籤" onClick={() => setTagsManagerOpen(true)}>
              <LocalOfferIcon fontSize="small" />
            </IconButton>
          </Tooltip>
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

      {contacts.length === 0 && <Typography color="text.secondary">還沒有聯絡人，先新增第一筆資料吧。</Typography>}

      {contacts.length > 0 && visibleContacts.length === 0 && (
        <Typography color="text.secondary">目前沒有符合篩選條件的聯絡人。</Typography>
      )}

      <Stack spacing={1.5}>
        {visibleContacts.map((contact) => (
          <Card key={contact.id} variant="elevation" elevation={1}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar>{contact.name.charAt(0)}</Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1">{contact.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {[contact.role, contact.company].filter(Boolean).join(' · ') || '未填寫職稱或公司'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <StarIcon fontSize="small" color={contact.importance >= 4 ? 'warning' : 'disabled'} />
                <Typography variant="body2">{contact.importance}</Typography>
              </Box>
              <Tooltip title="設定提醒">
                <IconButton
                  aria-label="設定提醒"
                  onClick={() => setReminderContactId(contact.id)}
                  color={contact.nextContactReminder ? 'primary' : 'default'}
                >
                  <AlarmIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="互動紀錄">
                <IconButton aria-label="互動紀錄" onClick={() => setActiveContactId(contact.id)}>
                  <HistoryIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="更多操作">
                <IconButton
                  aria-label="更多操作"
                  onClick={(event) => {
                    setMenuAnchor(event.currentTarget);
                    setMenuContactId(contact.id);
                  }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Tooltip>
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
          編輯
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDeleteContactId(menuContactId);
            setMenuAnchor(null);
          }}
        >
          刪除
        </MenuItem>
      </Menu>

      {editContactId && (
        <EditContactDialog
          uid={uid}
          contact={contacts.find((contact) => contact.id === editContactId)!}
          open
          onClose={() => setEditContactId(null)}
        />
      )}

      {deleteContactId && (
        <DeleteContactDialog
          uid={uid}
          contactId={deleteContactId}
          contactName={contacts.find((contact) => contact.id === deleteContactId)?.name ?? ''}
          open
          onClose={() => setDeleteContactId(null)}
        />
      )}

      <TagsManagerDialog uid={uid} open={tagsManagerOpen} onClose={() => setTagsManagerOpen(false)} />

      {activeContactId && (
        <ContactInteractionsDialog
          uid={uid}
          contactId={activeContactId}
          contactName={contacts.find((contact) => contact.id === activeContactId)?.name ?? ''}
          open
          onClose={() => setActiveContactId(null)}
        />
      )}

      {reminderContactId && (
        <SetReminderDialog
          uid={uid}
          contact={contacts.find((contact) => contact.id === reminderContactId)!}
          open
          onClose={() => setReminderContactId(null)}
        />
      )}

      <QuickCaptureDialog uid={uid} contacts={contacts} open={quickCaptureOpen} onClose={() => setQuickCaptureOpen(false)} />

      <Tooltip title="AI 快速記錄">
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 24, right: 24 }}
          onClick={() => setQuickCaptureOpen(true)}
          aria-label="AI 快速記錄"
        >
          <AutoAwesomeIcon />
        </Fab>
      </Tooltip>

      <Tooltip title="新增聯絡人">
        <Fab
          color="default"
          sx={{ position: 'fixed', bottom: 96, right: 24 }}
          onClick={() => setDialogOpen(true)}
          aria-label="新增聯絡人"
        >
          <PersonAddIcon />
        </Fab>
      </Tooltip>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>新增聯絡人</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}
          <TextField
            autoFocus
            label="姓名"
            fullWidth
            margin="dense"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <TextField
            label="公司"
            fullWidth
            margin="dense"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button onClick={handleSubmit} variant="contained">
            新增
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
