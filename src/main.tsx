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

// v1 重寫的新進入點。帳號系統見 spec.md §5.1：Email/密碼 + Google OAuth，取代先前開發階段的匿名登入暫時做法。
// index.html 已正式改為指向這個入口（舊版移至 index-legacy.html 保留參考），故 Router 不再需要 basename。
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
    <BrowserRouter>
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
