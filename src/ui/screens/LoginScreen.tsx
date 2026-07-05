import { useState } from 'react';
import { Box, Paper, TextField, Button, Typography, Alert, Link, Divider } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@ui/store/authStore';

/** 登入畫面（見 spec.md §5.1）：Email/密碼登入、Google OAuth、忘記密碼連結。 */
export function LoginScreen() {
  const { login, loginWithGoogle, sendResetEmail } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await login(email, password);
    if (result.ok) {
      navigate('/');
    } else {
      setError(Object.values(result.errors ?? {})[0] ?? t('auth.loginButton'));
    }
  }

  async function handleGoogle() {
    setError(null);
    const result = await loginWithGoogle();
    if (result.ok) {
      navigate('/');
    } else {
      setError(result.error ?? t('auth.loginButton'));
    }
  }

  async function handleForgotPassword() {
    setError(null);
    if (!email) {
      setError(t('auth.enterEmailFirst'));
      return;
    }
    const result = await sendResetEmail(email);
    if (result.ok) {
      setResetSent(true);
    } else {
      setError(result.error ?? '');
    }
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', p: 2 }}>
      <Paper sx={{ p: 4, maxWidth: 400, width: '100%' }} elevation={2}>
        <Typography variant="h5" sx={{ mb: 3 }}>
          {t('auth.loginTitle')}
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {resetSent && <Alert severity="success" sx={{ mb: 2 }}>{t('auth.resetSent')}</Alert>}

        <form onSubmit={handleSubmit}>
          <TextField
            label={t('auth.email')}
            type="email"
            fullWidth
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            label={t('auth.password')}
            type="password"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>
            {t('auth.loginButton')}
          </Button>
        </form>

        <Link component="button" variant="body2" onClick={handleForgotPassword} sx={{ mt: 1, display: 'block' }}>
          {t('auth.forgotPassword')}
        </Link>

        <Divider sx={{ my: 2 }}>{t('auth.or')}</Divider>

        <Button variant="outlined" fullWidth onClick={handleGoogle}>
          {t('auth.googleLogin')}
        </Button>

        <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
          {t('auth.noAccount')}
          <Link component={RouterLink} to="/register">{t('auth.registerLink')}</Link>
        </Typography>
      </Paper>
    </Box>
  );
}
