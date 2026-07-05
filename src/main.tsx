import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, CssBaseline, Box, Typography, CircularProgress } from '@mui/material';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { theme } from '@ui/theme/theme';
import { ContactsListScreen } from '@ui/screens/ContactsListScreen';
import { auth, isFirebaseConfigured } from '@data/firebase';

// v1 重寫的新進入點（與舊版 index.tsx/App.tsx 並存，見 CLAUDE.md §1）。
// 目前僅接上 §5.2 聯絡人 CRUD 這一片垂直切片，供功能驗證；帳號系統（§5.1）尚未實作，
// 這裡先用匿名登入取得 uid，僅供開發階段預覽，之後會被真正的登入畫面取代。
function App() {
  const [uid, setUid] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid);
      } else {
        signInAnonymously(auth).catch((err) => setAuthError(err.message));
      }
    });
    return unsubscribe;
  }, []);

  if (!isFirebaseConfigured) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="h6">Firebase 未設定</Typography>
        <Typography color="text.secondary">
          請在 .env 設定 VITE_FIREBASE_* 環境變數後重新啟動 dev server。
        </Typography>
      </Box>
    );
  }

  if (authError) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography color="error">登入失敗：{authError}</Typography>
      </Box>
    );
  }

  if (!uid) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return <ContactsListScreen uid={uid} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>
);
