import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, CssBaseline, Box, Typography } from '@mui/material';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '@ui/i18n';
import { theme } from '@ui/theme/theme';
import { DashboardScreen } from '@ui/screens/DashboardScreen';
import { ContactsListScreen } from '@ui/screens/ContactsListScreen';
import { SettingsScreen } from '@ui/screens/SettingsScreen';
import { LoginScreen } from '@ui/screens/LoginScreen';
import { RegisterScreen } from '@ui/screens/RegisterScreen';
import { ProtectedRoute } from '@ui/routes/ProtectedRoute';
import { NavShell } from '@ui/layout/NavShell';
import { useAuthStore } from '@ui/store/authStore';
import { isFirebaseConfigured } from '@data/firebase';

function ContactsRoute() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  return <ContactsListScreen uid={user.uid} />;
}

// 開發階段暫時用 index-new.html 作為獨立進入點（與舊版並存，見 CLAUDE.md §1）；
// Router 用 basename 對應到這個路徑，之後正式取代舊版 index.html 時把 basename 移除即可。
const ROUTER_BASENAME = '/index-new.html';

// v1 重寫的新進入點。帳號系統見 spec.md §5.1：Email/密碼 + Google OAuth，取代先前開發階段的匿名登入暫時做法。
function App() {
  const init = useAuthStore((s) => s.init);
  const { t } = useTranslation();

  useEffect(() => {
    const unsubscribe = init();
    return unsubscribe;
  }, [init]);

  if (!isFirebaseConfigured) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="h6">{t('firebaseNotConfigured.title')}</Typography>
        <Typography color="text.secondary">{t('firebaseNotConfigured.message')}</Typography>
      </Box>
    );
  }

  return (
    <BrowserRouter basename={ROUTER_BASENAME}>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/register" element={<RegisterScreen />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <NavShell>
                <DashboardScreen />
              </NavShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/contacts"
          element={
            <ProtectedRoute>
              <NavShell>
                <ContactsRoute />
              </NavShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <NavShell>
                <SettingsScreen />
              </NavShell>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>
);
