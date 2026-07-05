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
import { useTranslation } from 'react-i18next';
import { useInteractionsStore } from '@ui/store/interactionsStore';
import { useContactsStore } from '@ui/store/contactsStore';
import { todayDateString } from '@domain/interaction';
import type { InteractionType } from '@domain/interaction';
import type { Contact } from '@domain/contact';

interface ContactInteractionsDialogProps {
  uid: string;
  contactId: string;
  contactName: string;
  open: boolean;
  onClose: () => void;
}

/** 互動紀錄對話框（見 spec.md §5.3）：顯示歷史 + 新增表單，日期預設今天、無獨立標題欄位，可綁定多位聯絡人（見 §7 Interaction）。 */
export function ContactInteractionsDialog({ uid, contactId, contactName, open, onClose }: ContactInteractionsDialogProps) {
  const { byContactId, subscribe, add, remove } = useInteractionsStore();
  const contacts = useContactsStore((state) => state.contacts);
  const { t } = useTranslation();
  const interactions = byContactId[contactId] ?? [];
  const [type, setType] = useState<InteractionType>('meeting');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayDateString());
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);

  const TYPE_LABEL: Record<InteractionType, string> = {
    meeting: t('interactionsDialog.typeMeeting'),
    call: t('interactionsDialog.typeCall'),
    email: t('interactionsDialog.typeEmail'),
  };

  useEffect(() => {
    if (!open) return;
    const unsubscribe = subscribe(uid, contactId);
    return unsubscribe;
  }, [open, uid, contactId, subscribe]);

  useEffect(() => {
    if (!open) return;
    const primaryContact = contacts.find((contact) => contact.id === contactId);
    setSelectedContacts(primaryContact ? [primaryContact] : []);
  }, [contactId, contacts, open]);

  const contactOptions = useMemo(() => contacts, [contacts]);

  async function handleAdd() {
    const contactIds = selectedContacts.length > 0 ? selectedContacts.map((contact) => contact.id) : [contactId];
    const label = selectedContacts.map((contact) => contact.name).join('、') || contactName;
    const result = await add(uid, { contactIds, type, description, date }, label);
    if (result.ok) {
      setDescription('');
      setDate(todayDateString());
      setError(null);
    } else {
      setError(Object.values(result.errors ?? {})[0] ?? t('interactionsDialog.addInteraction'));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('interactionsDialog.title', { name: contactName })}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Autocomplete
          multiple
          options={contactOptions}
          value={selectedContacts}
          getOptionLabel={(option) => option.name}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          onChange={(_, value) => setSelectedContacts(value)}
          renderInput={(params) => <TextField {...params} label={t('interactionsDialog.boundContacts')} margin="dense" />}
          sx={{ mt: 1 }}
        />
        <TextField
          select
          label={t('interactionsDialog.type')}
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
          label={t('interactionsDialog.description')}
          fullWidth
          margin="dense"
          multiline
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <TextField
          label={t('interactionsDialog.date')}
          type="date"
          fullWidth
          margin="dense"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Button variant="contained" onClick={handleAdd} sx={{ mt: 1 }}>
          {t('interactionsDialog.addInteraction')}
        </Button>

        <Divider sx={{ my: 2 }} />

        {interactions.length === 0 ? (
          <Typography color="text.secondary">{t('interactionsDialog.empty')}</Typography>
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
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
