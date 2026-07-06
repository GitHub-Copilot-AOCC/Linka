import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
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

interface ContactInteractionsPanelProps {
  uid: string;
  contactId: string;
  contactName: string;
  active: boolean;
}

/**
 * 互動紀錄面板（見 spec.md §5.3、§11.5）：顯示歷史 + 新增表單，可綁定多位聯絡人。
 * 抽成獨立元件供 §11.5 聯絡人詳情 Tabs 頁與既有的 ContactInteractionsDialog 共用，避免邏輯重複。
 * `active` 對應 §11.5「各自 lazy load」要求：非啟用中的分頁不訂閱資料。
 */
export function ContactInteractionsPanel({ uid, contactId, contactName, active }: ContactInteractionsPanelProps) {
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
    if (!active) return;
    const unsubscribe = subscribe(uid, contactId);
    return unsubscribe;
  }, [active, uid, contactId, subscribe]);

  useEffect(() => {
    if (!active) return;
    const primaryContact = contacts.find((contact) => contact.id === contactId);
    setSelectedContacts(primaryContact ? [primaryContact] : []);
  }, [contactId, contacts, active]);

  const contactOptions = useMemo(() => contacts, [contacts]);

  if (!active) return null;

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
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Autocomplete
        multiple
        options={contactOptions}
        value={selectedContacts}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        onChange={(_, value) => setSelectedContacts(value)}
        renderInput={(params) => <TextField {...params} label={t('interactionsDialog.boundContacts')} margin="dense" />}
        renderOption={(props, option) => (
          // 下拉選單附上公司名輔助辨識，避免同名聯絡人在清單裡長得一模一樣
          // （見使用者回報的 corner case；已選取後的 Chip 底層仍以 id 區分，不受影響）。
          <Box component="li" {...props} key={option.id}>
            <Box>
              <Typography variant="body2">{option.name}</Typography>
              {option.company && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {option.company}
                </Typography>
              )}
            </Box>
          </Box>
        )}
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
    </>
  );
}
