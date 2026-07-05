import { useRef, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Avatar,
  CircularProgress,
  Alert,
  Typography,
} from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import { useTranslation } from 'react-i18next';
import { useContactsStore } from '@ui/store/contactsStore';
import { compressImage } from '@platform/imageCompression';
import { scanBusinessCard, GeminiServiceError } from '@services/geminiService';
import type { BusinessCardFields } from '@domain/businessCard';

interface BusinessCardScanDialogProps {
  uid: string;
  open: boolean;
  onClose: () => void;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read image'));
        return;
      }
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image'));
    reader.readAsDataURL(blob);
  });
}

/** 名片 OCR（見 spec.md §5.5 項目1）：拍照/上傳 → AI 辨識 → 預覽確認 → 建立聯絡人，未確認前不寫入。 */
export function BusinessCardScanDialog({ uid, open, onClose }: BusinessCardScanDialogProps) {
  const { t } = useTranslation();
  const { add } = useContactsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fields, setFields] = useState<BusinessCardFields | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetState() {
    setPreviewUrl(null);
    setFields(null);
    setLoading(false);
    setSaving(false);
    setError(null);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!navigator.onLine) {
      setError(t('businessCard.offlineError'));
      return;
    }

    setLoading(true);
    setError(null);
    setFields(null);

    try {
      const compressed = await compressImage(file);
      setPreviewUrl(URL.createObjectURL(compressed));
      const base64Data = await blobToBase64(compressed);
      const result = await scanBusinessCard(base64Data, 'image/jpeg');
      if (!result) {
        setError(t('businessCard.noNameError'));
      } else {
        setFields(result);
      }
    } catch (err) {
      setError(err instanceof GeminiServiceError ? err.message : t('businessCard.genericError'));
    } finally {
      setLoading(false);
    }
  }

  function updateField(key: keyof BusinessCardFields, value: string) {
    setFields((current) => (current ? { ...current, [key]: value } : current));
  }

  async function handleConfirm() {
    if (!fields) return;
    setSaving(true);
    setError(null);
    try {
      const result = await add(uid, {
        name: fields.name,
        role: fields.role || undefined,
        company: fields.company || undefined,
        phone: fields.phone || undefined,
        email: fields.email || undefined,
        source: 'ocr',
      });
      if (!result.ok) {
        setError(Object.values(result.errors ?? {})[0] ?? t('businessCard.genericError'));
        return;
      }
      handleClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('businessCard.title')}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!previewUrl && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 3 }}>
            <Typography color="text.secondary" align="center">
              {t('businessCard.description')}
            </Typography>
            <Button variant="contained" startIcon={<CameraAltIcon />} onClick={() => fileInputRef.current?.click()}>
              {t('businessCard.chooseImage')}
            </Button>
          </Box>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={handleFileSelected}
        />

        {previewUrl && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Avatar src={previewUrl} variant="rounded" sx={{ width: 160, height: 100 }} />
          </Box>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {fields && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <TextField
              label={t('contacts.name')}
              fullWidth
              margin="dense"
              value={fields.name}
              onChange={(e) => updateField('name', e.target.value)}
            />
            <TextField
              label={t('editContact.role')}
              fullWidth
              margin="dense"
              value={fields.role ?? ''}
              onChange={(e) => updateField('role', e.target.value)}
            />
            <TextField
              label={t('contacts.company')}
              fullWidth
              margin="dense"
              value={fields.company ?? ''}
              onChange={(e) => updateField('company', e.target.value)}
            />
            <TextField
              label={t('editContact.phone')}
              fullWidth
              margin="dense"
              value={fields.phone ?? ''}
              onChange={(e) => updateField('phone', e.target.value)}
            />
            <TextField
              label={t('auth.email')}
              fullWidth
              margin="dense"
              value={fields.email ?? ''}
              onChange={(e) => updateField('email', e.target.value)}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('common.cancel')}</Button>
        {fields && (
          <Button variant="contained" onClick={handleConfirm} disabled={saving}>
            {saving ? t('businessCard.saving') : t('businessCard.confirmAdd')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
