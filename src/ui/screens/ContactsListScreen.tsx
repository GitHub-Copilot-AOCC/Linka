import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Stack,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import StarIcon from '@mui/icons-material/Star';
import { useContactsStore } from '@ui/store/contactsStore';
import type { NewContactInput } from '@domain/contact';

interface ContactsListScreenProps {
  uid: string;
}

/** 聯絡人列表：卡片式呈現（見 spec.md §11.4），對照 §5.2 聯絡人管理。 */
export function ContactsListScreen({ uid }: ContactsListScreenProps) {
  const { contacts, subscribe, add } = useContactsStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribe(uid);
    return unsubscribe;
  }, [uid, subscribe]);

  async function handleSubmit() {
    const input: NewContactInput = { name, company: company || undefined };
    const result = await add(uid, input);
    if (result.ok) {
      setName('');
      setCompany('');
      setFormError(null);
      setDialogOpen(false);
    } else {
      setFormError(Object.values(result.errors ?? {})[0] ?? '新增失敗');
    }
  }

  return (
    <Box sx={{ p: 2, pb: 10 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        聯絡人
      </Typography>

      {contacts.length === 0 && (
        <Typography color="text.secondary">還沒有聯絡人，點右下角按鈕新增第一位。</Typography>
      )}

      <Stack spacing={1.5}>
        {contacts.map((contact) => (
          <Card key={contact.id} variant="elevation" elevation={1}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar>{contact.name.charAt(0)}</Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1">{contact.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {[contact.role, contact.company].filter(Boolean).join(' · ') || ' '}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <StarIcon fontSize="small" color={contact.importance >= 4 ? 'warning' : 'disabled'} />
                <Typography variant="body2">{contact.importance}</Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        onClick={() => setDialogOpen(true)}
        aria-label="新增聯絡人"
      >
        <AddIcon />
      </Fab>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>新增聯絡人</DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <TextField
            autoFocus
            label="姓名"
            fullWidth
            margin="dense"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            label="公司"
            fullWidth
            margin="dense"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button onClick={handleSubmit} variant="contained">
            新增
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
