import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useInteractionsStore } from '@ui/store/interactionsStore';
import { useContactsStore } from '@ui/store/contactsStore';
import { todayDateString } from '@domain/interaction';
import type { Contact } from '@domain/contact';
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

export function ContactInteractionsDialog({ uid, contactId, contactName, open, onClose }: ContactInteractionsDialogProps) {
  const { byContactId, subscribe, add, remove } = useInteractionsStore();
  const contacts = useContactsStore((state) => state.contacts);
  const interactions = byContactId[contactId] ?? [];
  const [type, setType] = useState<InteractionType>('meeting');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayDateString());
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const unsubscribe = subscribe(uid, contactId);
    return unsubscribe;
  }, [open, uid, contactId, subscribe]);

  useEffect(() => {
    const primaryContact = contacts.find((contact) => contact.id === contactId);
    setSelectedContacts(primaryContact ? [primaryContact] : []);
  }, [contactId, contacts, open]);

  const contactOptions = useMemo(() => contacts, [contacts]);

  async function handleAdd() {
    const result = await add(
      uid,
      {
        contactIds: selectedContacts.map((contact) => contact.id),
        type,
        description,
        date,
      },
      selectedContacts.map((contact) => contact.name).join('、') || contactName
    );

    if (result.ok) {
      setDescription('');
      setDate(todayDateString());
      setError(null);
    } else {
      setError(Object.values(result.errors ?? {})[0] ?? '新增互動失敗');
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{contactName} 的互動紀錄</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Autocomplete
          multiple
          options={contactOptions}
          value={selectedContacts}
          getOptionLabel={(option) => option.name}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          onChange={(_, value) => setSelectedContacts(value)}
          renderInput={(params) => <TextField {...params} label="綁定聯絡人" margin="dense" />}
          sx={{ mt: 1 }}
        />
        <TextField
          select
          label="互動類型"
          fullWidth
          margin="dense"
          value={type}
          onChange={(event) => setType(event.target.value as InteractionType)}
        >
          {Object.entries(TYPE_LABEL).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="互動描述"
          fullWidth
          margin="dense"
          multiline
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <TextField
          label="日期"
          type="date"
          fullWidth
          margin="dense"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Button variant="contained" onClick={handleAdd} sx={{ mt: 1 }}>
          新增互動
        </Button>

        <Divider sx={{ my: 2 }} />

        {interactions.length === 0 ? (
          <Typography color="text.secondary">目前還沒有互動紀錄。</Typography>
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
