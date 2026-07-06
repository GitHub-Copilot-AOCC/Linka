import { useEffect, useState } from 'react';
import {
  TextField,
  Button,
  Alert,
  Rating,
  Box,
  Typography,
  Avatar,
  IconButton,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import { useTranslation } from 'react-i18next';
import { useContactsStore } from '@ui/store/contactsStore';
import { validateContact, MAX_PHOTOS_PER_CONTACT } from '@domain/contact';
import type { Contact, ContactPhoto } from '@domain/contact';
import { compressImage } from '@platform/imageCompression';
import { pickFile } from '@platform/filePicker';
import { uploadContactPhoto, removeContactPhoto } from '@data/contactsRepository';
import { TagMultiSelect } from '@ui/components/TagMultiSelect';

interface ContactBasicInfoPanelProps {
  uid: string;
  contact: Contact;
  active: boolean;
}

/**
 * 聯絡人基本資料表單（見 spec.md §5.2、§11.5）：抽成獨立元件供 §11.5 聯絡人詳情
 * Tabs 頁與既有的 EditContactDialog 共用同一份欄位/驗證/照片管理邏輯，避免重複。
 */
export function ContactBasicInfoPanel({ uid, contact, active }: ContactBasicInfoPanelProps) {
  const { update } = useContactsStore();
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: contact.name,
    role: contact.role ?? '',
    company: contact.company ?? '',
    phone: contact.phone ?? '',
    email: contact.email ?? '',
    birthday: contact.birthday ?? '',
    linkedin: contact.linkedin ?? '',
    notes: contact.notes ?? '',
  });
  const [importance, setImportance] = useState<Contact['importance']>(contact.importance);
  const [tagIds, setTagIds] = useState<string[]>(contact.tags ?? []);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const contacts = useContactsStore((s) => s.contacts);
  const livePhotos = contacts.find((c) => c.id === contact.id)?.photos ?? contact.photos ?? [];

  // 切換聯絡人（例如從列表點進不同人）時，表單需要重新以該聯絡人的資料初始化。
  useEffect(() => {
    setForm({
      name: contact.name,
      role: contact.role ?? '',
      company: contact.company ?? '',
      phone: contact.phone ?? '',
      email: contact.email ?? '',
      birthday: contact.birthday ?? '',
      linkedin: contact.linkedin ?? '',
      notes: contact.notes ?? '',
    });
    setImportance(contact.importance);
    setTagIds(contact.tags ?? []);
  }, [contact.id]);

  if (!active) return null;

  async function handlePhotoSelected() {
    const file = await pickFile({ accept: 'image/*' });
    if (!file) return;
    if (livePhotos.length >= MAX_PHOTOS_PER_CONTACT) {
      setError(t('editContact.maxPhotosError', { max: MAX_PHOTOS_PER_CONTACT }));
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const compressed = await compressImage(file);
      await uploadContactPhoto(uid, contact.id, compressed, livePhotos);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemovePhoto(photo: ContactPhoto) {
    await removeContactPhoto(uid, contact.id, photo, livePhotos);
  }

  function field(key: keyof typeof form) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  async function handleSave() {
    const patch = {
      name: form.name,
      role: form.role || undefined,
      company: form.company || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      birthday: form.birthday || undefined,
      linkedin: form.linkedin || undefined,
      notes: form.notes || undefined,
      importance,
      tags: tagIds.length > 0 ? tagIds : undefined,
    };

    const result = validateContact({ ...patch, name: patch.name });
    if (!result.valid) {
      setError(Object.values(result.errors)[0] ?? t('common.save'));
      return;
    }

    await update(uid, contact.id, patch);
    setError(null);
    setSaved(true);
  }

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="body2">{t('editContact.importance')}</Typography>
        <Rating value={importance} onChange={(_, value) => setImportance((value ?? 1) as Contact['importance'])} />
      </Box>

      <Typography variant="body2" sx={{ mb: 1 }}>
        {t('editContact.photos', { max: MAX_PHOTOS_PER_CONTACT })}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {livePhotos.map((photo) => (
          <Box key={photo.addedAt} sx={{ position: 'relative' }}>
            <Avatar src={photo.url} variant="rounded" sx={{ width: 64, height: 64 }} />
            <IconButton
              size="small"
              onClick={() => handleRemovePhoto(photo)}
              sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'background.paper' }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        {livePhotos.length < MAX_PHOTOS_PER_CONTACT && (
          <IconButton
            onClick={handlePhotoSelected}
            disabled={uploading}
            sx={{ width: 64, height: 64, border: '1px dashed', borderColor: 'divider' }}
          >
            {uploading ? <CircularProgress size={20} /> : <AddPhotoAlternateIcon />}
          </IconButton>
        )}
      </Box>

      <TextField label={t('contacts.name')} fullWidth margin="dense" {...field('name')} />
      <TextField label={t('editContact.role')} fullWidth margin="dense" {...field('role')} />
      <TextField label={t('contacts.company')} fullWidth margin="dense" {...field('company')} />
      <TextField label={t('editContact.phone')} fullWidth margin="dense" {...field('phone')} />
      <TextField label={t('auth.email')} fullWidth margin="dense" {...field('email')} />
      <TextField
        label={t('editContact.birthday')}
        type="date"
        fullWidth
        margin="dense"
        {...field('birthday')}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField label={t('editContact.linkedin')} fullWidth margin="dense" {...field('linkedin')} />
      <TextField label={t('editContact.notes')} fullWidth margin="dense" multiline rows={2} {...field('notes')} />

      <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>
        {t('editContact.tags')}
      </Typography>
      <Box sx={{ mb: 2 }}>
        <TagMultiSelect uid={uid} selectedIds={tagIds} onChange={setTagIds} />
      </Box>

      <Button onClick={handleSave} variant="contained">
        {t('common.save')}
      </Button>

      <Snackbar
        open={saved}
        autoHideDuration={2000}
        onClose={() => setSaved(false)}
        message={t('common.saved')}
      />
    </>
  );
}
