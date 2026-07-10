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
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import { useTranslation } from 'react-i18next';
import { useContactsStore } from '@ui/store/contactsStore';
import { validateContact, MAX_PHOTOS_PER_CONTACT } from '@domain/contact';
import type { Contact, ContactPhoto } from '@domain/contact';
import { compressImage } from '@platform/imageCompression';
import { pickFile } from '@platform/filePicker';
import { uploadContactPhoto, removeContactPhoto } from '@data/contactsRepository';
import { TagMultiSelect } from '@ui/components/TagMultiSelect';
import { avatarGradientFor } from '@ui/theme/avatarPalette';

interface ContactBasicInfoPanelProps {
  uid: string;
  contact: Contact;
  active: boolean;
}

/** iOS 風格「Grouped List」欄位群組容器（見使用者提供的設計 mockup：編輯表單改用分組卡片，
 * 不再是每個欄位各自一個紫色外框輸入框）。 */
function FormGroup({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 3,
        overflow: 'hidden',
        mb: 2,
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
      }}
    >
      {children}
    </Box>
  );
}

/** Grouped List 裡的單一列：左邊固定寬度的灰色標籤，右邊無邊框可編輯欄位，列與列之間用細分隔線。 */
function FormRow({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2,
        py: 1.1,
        borderBottom: last ? 'none' : '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography variant="body2" sx={{ color: 'text.secondary', width: 76, flexShrink: 0 }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

const ROW_INPUT_PROPS = { disableUnderline: true } as const;

/**
 * 聯絡人基本資料表單（見 spec.md §5.2、§11.5）：抽成獨立元件供 §11.5 聯絡人詳情
 * Tabs 頁與既有的 EditContactDialog 共用同一份欄位/驗證/照片管理邏輯，避免重複。
 * 視覺重新設計 v2：改用 iOS 原生 Grouped List 樣式呈現（見使用者提供的設計 mockup），
 * 頭像置中放大並附相機徽章，欄位群組化、無邊框內嵌編輯。
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
  const heroPhoto = livePhotos[0];
  const extraPhotos = livePhotos.slice(1);

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

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1 }}>
        <Box sx={{ position: 'relative' }}>
          <Avatar
            src={heroPhoto?.url}
            sx={{
              width: 96,
              height: 96,
              fontSize: '2.25rem',
              ...(heroPhoto ? {} : { backgroundImage: avatarGradientFor(contact.id), color: '#fff' }),
            }}
          >
            {contact.name.charAt(0)}
          </Avatar>
          {heroPhoto && (
            <IconButton
              aria-label={t('editContact.removePhoto')}
              onClick={() => handleRemovePhoto(heroPhoto)}
              size="small"
              sx={{
                position: 'absolute',
                top: -2,
                right: -2,
                bgcolor: 'background.paper',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                width: 28,
                height: 28,
                '&:hover': { bgcolor: 'background.paper' },
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
          <IconButton
            onClick={handlePhotoSelected}
            disabled={uploading || livePhotos.length >= MAX_PHOTOS_PER_CONTACT}
            size="small"
            sx={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              bgcolor: 'primary.main',
              color: '#fff',
              '&:hover': { bgcolor: 'primary.main' },
              width: 32,
              height: 32,
            }}
          >
            {uploading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <CameraAltIcon fontSize="small" />}
          </IconButton>
        </Box>

        {extraPhotos.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', mt: 1.5 }}>
            {extraPhotos.map((photo) => (
              <Box key={photo.addedAt} sx={{ position: 'relative' }}>
                <Avatar src={photo.url} variant="rounded" sx={{ width: 40, height: 40 }} />
                <IconButton
                  size="small"
                  onClick={() => handleRemovePhoto(photo)}
                  sx={{ position: 'absolute', top: -6, right: -6, bgcolor: 'background.paper', width: 18, height: 18 }}
                >
                  <DeleteIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('editContact.importance')}
          </Typography>
          <Rating value={importance} onChange={(_, value) => setImportance((value ?? 1) as Contact['importance'])} />
        </Box>
      </Box>

      <FormGroup>
        <FormRow label={t('contacts.name')}>
          <TextField variant="standard" fullWidth slotProps={{ input: ROW_INPUT_PROPS }} {...field('name')} />
        </FormRow>
        <FormRow label={t('editContact.role')}>
          <TextField variant="standard" fullWidth slotProps={{ input: ROW_INPUT_PROPS }} {...field('role')} />
        </FormRow>
        <FormRow label={t('contacts.company')} last>
          <TextField variant="standard" fullWidth slotProps={{ input: ROW_INPUT_PROPS }} {...field('company')} />
        </FormRow>
      </FormGroup>

      <FormGroup>
        <FormRow label={t('editContact.phone')}>
          <TextField variant="standard" fullWidth slotProps={{ input: ROW_INPUT_PROPS }} {...field('phone')} />
        </FormRow>
        <FormRow label={t('auth.email')} last>
          <TextField variant="standard" fullWidth slotProps={{ input: ROW_INPUT_PROPS }} {...field('email')} />
        </FormRow>
      </FormGroup>

      <FormGroup>
        <FormRow label={t('editContact.birthday')}>
          <TextField
            variant="standard"
            type="date"
            fullWidth
            slotProps={{ input: ROW_INPUT_PROPS, inputLabel: { shrink: true } }}
            {...field('birthday')}
          />
        </FormRow>
        <FormRow label={t('editContact.linkedin')}>
          <TextField variant="standard" fullWidth slotProps={{ input: ROW_INPUT_PROPS }} {...field('linkedin')} />
        </FormRow>
        <FormRow label={t('editContact.notes')} last>
          <TextField
            variant="standard"
            fullWidth
            multiline
            slotProps={{ input: ROW_INPUT_PROPS }}
            {...field('notes')}
          />
        </FormRow>
      </FormGroup>

      <Typography variant="body2" sx={{ mt: 1, mb: 1, color: 'text.secondary' }}>
        {t('editContact.tags')}
      </Typography>
      <Box sx={{ mb: 2 }}>
        <TagMultiSelect uid={uid} selectedIds={tagIds} onChange={setTagIds} />
      </Box>

      <Button onClick={handleSave} variant="contained" fullWidth>
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
