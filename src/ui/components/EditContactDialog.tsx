import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Rating,
  Box,
  Typography,
  Chip,
  Avatar,
  IconButton,
  CircularProgress,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import { useTranslation } from 'react-i18next';
import { useContactsStore } from '@ui/store/contactsStore';
import { useTagsStore } from '@ui/store/tagsStore';
import { validateContact, MAX_PHOTOS_PER_CONTACT } from '@domain/contact';
import type { Contact, ContactPhoto } from '@domain/contact';
import { compressImage } from '@platform/imageCompression';
import { uploadContactPhoto, removeContactPhoto } from '@data/contactsRepository';

interface EditContactDialogProps {
  uid: string;
  contact: Contact;
  open: boolean;
  onClose: () => void;
}

/** 編輯聯絡人完整欄位（見 spec.md §5.2）：職稱、公司、電話、Email、生日、社交連結、備註、星級。 */
export function EditContactDialog({ uid, contact, open, onClose }: EditContactDialogProps) {
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { tags, subscribe } = useTagsStore();
  const contacts = useContactsStore((s) => s.contacts);
  const livePhotos = contacts.find((c) => c.id === contact.id)?.photos ?? contact.photos ?? [];

  useEffect(() => subscribe(uid), [uid, subscribe]);

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
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

  function toggleTag(tagId: string) {
    setTagIds((ids) => (ids.includes(tagId) ? ids.filter((id) => id !== tagId) : [...ids, tagId]));
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
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('editContact.title', { name: contact.name })}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="body2">{t('editContact.importance')}</Typography>
          <Rating
            value={importance}
            onChange={(_, value) => setImportance((value ?? 1) as Contact['importance'])}
          />
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
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              sx={{ width: 64, height: 64, border: '1px dashed', borderColor: 'divider' }}
            >
              {uploading ? <CircularProgress size={20} /> : <AddPhotoAlternateIcon />}
            </IconButton>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handlePhotoSelected} />
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
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {tags.map((tag) => (
            <Chip
              key={tag.id}
              label={tag.name}
              onClick={() => toggleTag(tag.id)}
              color={tagIds.includes(tag.id) ? 'primary' : 'default'}
              variant={tagIds.includes(tag.id) ? 'filled' : 'outlined'}
            />
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={handleSave} variant="contained">
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
