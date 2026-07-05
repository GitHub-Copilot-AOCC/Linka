import { useEffect, useState } from 'react';
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
} from '@mui/material';
import { useContactsStore } from '@ui/store/contactsStore';
import { useTagsStore } from '@ui/store/tagsStore';
import { validateContact } from '@domain/contact';
import type { Contact } from '@domain/contact';

interface EditContactDialogProps {
  uid: string;
  contact: Contact;
  open: boolean;
  onClose: () => void;
}

/** 編輯聯絡人完整欄位（見 spec.md §5.2）：職稱、公司、電話、Email、生日、社交連結、備註、星級。 */
export function EditContactDialog({ uid, contact, open, onClose }: EditContactDialogProps) {
  const { update } = useContactsStore();
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
  const { tags, subscribe } = useTagsStore();

  useEffect(() => subscribe(uid), [uid, subscribe]);

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
      setError(Object.values(result.errors)[0] ?? '儲存失敗');
      return;
    }

    await update(uid, contact.id, patch);
    setError(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>編輯 {contact.name}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="body2">重要性星級</Typography>
          <Rating
            value={importance}
            onChange={(_, value) => setImportance((value ?? 1) as Contact['importance'])}
          />
        </Box>

        <TextField label="姓名" fullWidth margin="dense" {...field('name')} />
        <TextField label="職稱" fullWidth margin="dense" {...field('role')} />
        <TextField label="公司" fullWidth margin="dense" {...field('company')} />
        <TextField label="電話" fullWidth margin="dense" {...field('phone')} />
        <TextField label="Email" fullWidth margin="dense" {...field('email')} />
        <TextField
          label="生日"
          type="date"
          fullWidth
          margin="dense"
          {...field('birthday')}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField label="LinkedIn" fullWidth margin="dense" {...field('linkedin')} />
        <TextField label="備註" fullWidth margin="dense" multiline rows={2} {...field('notes')} />

        <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>
          標籤
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
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSave} variant="contained">
          儲存
        </Button>
      </DialogActions>
    </Dialog>
  );
}
