import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, CssBaseline, Box, Typography } from '@mui/material';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '@ui/i18n';
import { theme } from '@ui/theme/theme';
import { DashboardScreen } from '@ui/screens/DashboardScreen';
import { ContactsListScreen } from '@ui/screens/ContactsListScreen';
import { ContactDetailScreen } from '@ui/screens/ContactDetailScreen';
import { AssistantChatScreen } from '@ui/screens/AssistantChatScreen';
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

function ContactDetailRoute() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  return <ContactDetailScreen uid={user.uid} />;
}

// v1 重寫的新進入點。帳號系統見 spec.md §5.1：Email/密碼 + Google OAuth，取代先前開發階段的匿名登入暫時做法。
// index.html 已正式改為指向這個入口（舊版移至 index-legacy.html 保留參考），故 Router 不再需要 basename。
function App() {
  const init = useAuthStore((s) => s.init);
  const { t } = useTranslation();

  // iOS Safari/WebKit 自 iOS 10 起，pinch 手勢會忽略 viewport meta 的 maximum-scale/user-scalable
  // 限制（Apple 的無障礙考量），所以光靠 index.html 的 meta 標籤擋不住手機上的縮放。使用者回報
  // gesturestart/gesturechange 那次修好後，仍然在滑動列表時偶爾又觸發了縮放（見使用者回報：
  // 「全部」篩選時畫面右側被裁掉），推測是雙擊縮放（double-tap zoom）——這是跟 pinch 手勢分開的
  // 另一種 WebKit 內建手勢，gesturestart/gesturechange 攔不到，需要另外用 touchend 時間間隔判斷。
  // 同時加上 touchmove 多點觸控攔截，多一層防護涵蓋不同 WebKit 版本對 pinch 的實作方式。
  useEffect(() => {
    const preventGestureZoom = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', preventGestureZoom);
    document.addEventListener('gesturechange', preventGestureZoom);

    let lastTouchEnd = 0;
    const preventDoubleTapZoom = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 350) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };
    document.addEventListener('touchend', preventDoubleTapZoom, { passive: false });

    const preventMultiTouchZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };
    document.addEventListener('touchmove', preventMultiTouchZoom, { passive: false });

    return () => {
      document.removeEventListener('gesturestart', preventGestureZoom);
      document.removeEventListener('gesturechange', preventGestureZoom);
      document.removeEventListener('touchend', preventDoubleTapZoom);
      document.removeEventListener('touchmove', preventMultiTouchZoom);
    };
  }, []);

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
          path="/contacts/:contactId"
          element={
            <ProtectedRoute>
              <NavShell>
                <ContactDetailRoute />
              </NavShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/assistant"
          element={
            <ProtectedRoute>
              <NavShell>
                <AssistantChatScreen />
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
