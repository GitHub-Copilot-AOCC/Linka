import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Chip,
  Stack,
  Alert,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useTagsStore } from '@ui/store/tagsStore';
import { tagStyleFor } from '@ui/theme/tagPalette';

interface TagsManagerDialogProps {
  uid: string;
  open: boolean;
  onClose: () => void;
}

/** 標籤管理（見 spec.md §5.2）：預設分類 + 使用者自訂標籤的新增/刪除。 */
export function TagsManagerDialog({ uid, open, onClose }: TagsManagerDialogProps) {
  const { tags, subscribe, add, remove } = useTagsStore();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    return subscribe(uid);
  }, [open, uid, subscribe]);

  async function handleAdd() {
    const result = await add(uid, { name });
    if (result.ok) {
      setName('');
      setError(null);
    } else {
      setError(result.error ?? t('common.add'));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('tags.title')}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <TextField
            size="small"
            label={t('tags.newTagLabel')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />
          <Button variant="contained" onClick={handleAdd}>
            {t('common.add')}
          </Button>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {tags.map((tag) => {
            const style = tagStyleFor(tag.id);
            return (
              <Chip
                key={tag.id}
                label={tag.name}
                onDelete={() => remove(uid, tag.id)}
                sx={{ bgcolor: style.bg, color: style.fg }}
              />
            );
          })}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
