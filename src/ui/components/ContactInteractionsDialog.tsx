import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Divider,
  Typography,
  Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useInteractionsStore } from '@ui/store/interactionsStore';
import { todayDateString } from '@domain/interaction';
import type { InteractionType } from '@domain/interaction';

interface ContactInteractionsDialogProps {
  uid: string;
  contactId: string;
  contactName: string;
  open: boolean;
  onClose: () => void;
}

const TYPE_LABEL: Record<InteractionType, string> = {
  meeting: '會議',
  call: '通話',
  email: 'Email',
};

/** 互動紀錄對話框（見 spec.md §5.3）：顯示歷史 + 新增表單，日期預設今天、無獨立標題欄位。 */
export function ContactInteractionsDialog({ uid, contactId, contactName, open, onClose }: ContactInteractionsDialogProps) {
  const { byContactId, subscribe, add, remove } = useInteractionsStore();
  const interactions = byContactId[contactId] ?? [];
  const [type, setType] = useState<InteractionType>('meeting');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayDateString());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const unsubscribe = subscribe(uid, contactId);
    return unsubscribe;
  }, [open, uid, contactId, subscribe]);

  async function handleAdd() {
    const result = await add(uid, { contactIds: [contactId], type, description, date });
    if (result.ok) {
      setDescription('');
      setDate(todayDateString());
      setError(null);
    } else {
      setError(Object.values(result.errors ?? {})[0] ?? '新增失敗');
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{contactName} 的互動紀錄</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <TextField
          select
          label="類型"
          fullWidth
          margin="dense"
          value={type}
          onChange={(e) => setType(e.target.value as InteractionType)}
        >
          {Object.entries(TYPE_LABEL).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="描述"
          fullWidth
          margin="dense"
          multiline
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <TextField
          label="日期"
          type="date"
          fullWidth
          margin="dense"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Button variant="contained" onClick={handleAdd} sx={{ mt: 1 }}>
          新增互動
        </Button>

        <Divider sx={{ my: 2 }} />

        {interactions.length === 0 ? (
          <Typography color="text.secondary">還沒有互動紀錄</Typography>
        ) : (
          <List dense>
            {interactions.map((interaction) => (
              <ListItem
                key={interaction.id}
                secondaryAction={
                  <IconButton edge="end" onClick={() => remove(uid, interaction.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={`${interaction.date} · ${TYPE_LABEL[interaction.type]}`}
                  secondary={interaction.description}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>關閉</Button>
      </DialogActions>
    </Dialog>
  );
}
