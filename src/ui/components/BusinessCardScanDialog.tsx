import { useState } from 'react';
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
import { cropImageToBox } from '@platform/imageCropping';
import { pickFile } from '@platform/filePicker';
import { scanBusinessCard, GeminiServiceError } from '@services/geminiService';
import type { BusinessCardFields, NormalizedBox } from '@domain/businessCard';
import { findContactsByName, type ContactPhoto } from '@domain/contact';
import { uploadContactPhoto } from '@data/contactsRepository';

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
  const { add, contacts } = useContactsStore();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fields, setFields] = useState<BusinessCardFields | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [cardBox, setCardBox] = useState<NormalizedBox | undefined>(undefined);
  const [personBox, setPersonBox] = useState<NormalizedBox | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetState() {
    setPreviewUrl(null);
    setFields(null);
    setImageBlob(null);
    setCardBox(undefined);
    setPersonBox(undefined);
    setLoading(false);
    setSaving(false);
    setError(null);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  async function handleFileSelected() {
    // 不加 capture 屬性——手機瀏覽器（尤其 iOS Safari）看到 capture 常會直接跳過選單，
    // 只給拍照、沒有「從相片庫選取」的選項（見使用者回報：按下去只能拍照，沒有選照片的
    // 功能）。不加這個屬性，瀏覽器會顯示原生選單（拍照／相片庫／瀏覽檔案），使用者自己選。
    const file = await pickFile({ accept: 'image/*' });
    if (!file) return;

    if (!navigator.onLine) {
      setError(t('businessCard.offlineError'));
      return;
    }

    setLoading(true);
    setError(null);
    setFields(null);
    setCardBox(undefined);
    setPersonBox(undefined);

    try {
      const compressed = await compressImage(file);
      setPreviewUrl(URL.createObjectURL(compressed));
      setImageBlob(compressed);
      const base64Data = await blobToBase64(compressed);
      const result = await scanBusinessCard(base64Data, 'image/jpeg');
      if (!result) {
        setError(t('businessCard.noNameError'));
      } else {
        setFields(result.fields);
        setCardBox(result.cardBoundingBox);
        setPersonBox(result.personPhotoBoundingBox);
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
      if (!result.ok || !result.id) {
        setError(Object.values(result.errors ?? {})[0] ?? t('businessCard.genericError'));
        return;
      }

      // 聯絡人存檔成功後才裁切/上傳照片（見使用者需求：先進表單、存檔成功才上傳照片），
      // 避免使用者最後放棄這筆掃描時留下孤兒 Storage 檔案。照片裁切/上傳失敗不影響已經
      // 成功建立的聯絡人紀錄，只記錄錯誤、不擋住關閉對話框的流程。人像照（若偵測到）排
      // 第一張當大頭照，名片全圖排第二張；框不合理時 cropImageToBox 會被跳過，改用原圖。
      if (imageBlob) {
        try {
          const photos: ContactPhoto[] = [];
          if (personBox) {
            const personPhoto = await cropImageToBox(imageBlob, personBox).catch(() => null);
            if (personPhoto) {
              photos.push(await uploadContactPhoto(uid, result.id, personPhoto, photos));
            }
          }
          const cardPhotoBlob = cardBox ? await cropImageToBox(imageBlob, cardBox).catch(() => imageBlob) : imageBlob;
          await uploadContactPhoto(uid, result.id, cardPhotoBlob, photos);
        } catch (photoErr) {
          console.error('Business card photo upload failed:', photoErr);
        }
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
            <Button variant="contained" startIcon={<CameraAltIcon />} onClick={handleFileSelected}>
              {t('businessCard.chooseImage')}
            </Button>
          </Box>
        )}

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
            {findContactsByName(contacts, fields.name).length > 0 && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {t('contacts.duplicateNameWarning', { name: fields.name })}
              </Alert>
            )}
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
