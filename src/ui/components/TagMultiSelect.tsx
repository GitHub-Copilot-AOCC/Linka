import { useEffect, useState } from 'react';
import { Box, Chip, TextField } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import { useTagsStore } from '@ui/store/tagsStore';
import { tagStyleFor } from '@ui/theme/tagPalette';

interface TagMultiSelectProps {
  uid: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

/**
 * 標籤複選元件（使用者需求：標籤可複選，且能隨時新增供後續聯絡人使用）。
 * 共用於新增聯絡人表單與聯絡人編輯表單，避免重複實作標籤選取/建立邏輯。
 */
export function TagMultiSelect({ uid, selectedIds, onChange }: TagMultiSelectProps) {
  const { tags, subscribe, add } = useTagsStore();
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribe(uid), [uid, subscribe]);

  function toggle(tagId: string) {
    onChange(selectedIds.includes(tagId) ? selectedIds.filter((id) => id !== tagId) : [...selectedIds, tagId]);
  }

  async function handleCreate() {
    const result = await add(uid, { name: newName });
    if (result.ok) {
      setNewName('');
      setAdding(false);
      setError(null);
    } else {
      setError(result.error ?? t('common.add'));
    }
  }

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
      {tags.map((tag) => {
        const style = tagStyleFor(tag.id);
        const Icon = style.icon;
        const selected = selectedIds.includes(tag.id);
        return (
          <Chip
            key={tag.id}
            icon={<Icon sx={{ fontSize: 'inherit !important', color: `${style.fg} !important` }} />}
            label={tag.name}
            onClick={() => toggle(tag.id)}
            sx={{
              bgcolor: style.bg,
              color: style.fg,
              border: selected ? `2px solid ${style.fg}` : '2px solid transparent',
            }}
          />
        );
      })}
      {adding ? (
        <TextField
          size="small"
          autoFocus
          placeholder={t('tags.newTagLabel')}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          error={Boolean(error)}
          helperText={error ?? undefined}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCreate();
            }
            if (e.key === 'Escape') {
              setAdding(false);
              setNewName('');
              setError(null);
            }
          }}
          onBlur={() => {
            if (!newName) setAdding(false);
          }}
          sx={{ width: 160 }}
        />
      ) : (
        <Chip icon={<AddIcon />} label={t('tags.addInline')} variant="outlined" onClick={() => setAdding(true)} />
      )}
    </Box>
  );
}
