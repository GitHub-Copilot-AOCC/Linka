import { Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuthStore } from '@ui/store/authStore';

/** 未登入時導向 /login（見 spec.md §5.1）。 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuthStore();

  if (initializing) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
