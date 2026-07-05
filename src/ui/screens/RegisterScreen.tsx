import { useState } from 'react';
import { Box, Paper, TextField, Button, Typography, Alert, Link } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@ui/store/authStore';

/** 註冊畫面（見 spec.md §5.1）：Email/密碼註冊。 */
export function RegisterScreen() {
  const { register } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await register(email, password);
    if (result.ok) {
      navigate('/');
    } else {
      setError(Object.values(result.errors ?? {})[0] ?? t('auth.registerButton'));
    }
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', p: 2 }}>
      <Paper sx={{ p: 4, maxWidth: 400, width: '100%' }} elevation={2}>
        <Typography variant="h5" sx={{ mb: 3 }}>
          {t('auth.registerTitle')}
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

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
            label={t('auth.passwordHint')}
            type="password"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>
            {t('auth.registerButton')}
          </Button>
        </form>

        <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
          {t('auth.hasAccount')}
          <Link component={RouterLink} to="/login">{t('auth.loginLink')}</Link>
        </Typography>
      </Paper>
    </Box>
  );
}
