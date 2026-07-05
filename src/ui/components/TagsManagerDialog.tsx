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
import { useTagsStore } from '@ui/store/tagsStore';

interface TagsManagerDialogProps {
  uid: string;
  open: boolean;
  onClose: () => void;
}

/** 標籤管理（見 spec.md §5.2）：預設分類 + 使用者自訂標籤的新增/刪除。 */
export function TagsManagerDialog({ uid, open, onClose }: TagsManagerDialogProps) {
  const { tags, subscribe, add, remove } = useTagsStore();
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
      setError(result.error ?? '新增失敗');
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>標籤管理</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <TextField size="small" label="新標籤名稱" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
          <Button variant="contained" onClick={handleAdd}>
            新增
          </Button>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {tags.map((tag) => (
            <Chip key={tag.id} label={tag.name} onDelete={() => remove(uid, tag.id)} />
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>關閉</Button>
      </DialogActions>
    </Dialog>
  );
}
