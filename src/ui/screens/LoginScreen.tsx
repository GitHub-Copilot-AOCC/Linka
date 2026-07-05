import { useState } from 'react';
import { Box, Paper, TextField, Button, Typography, Alert, Link, Divider } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@ui/store/authStore';

/** 登入畫面（見 spec.md §5.1）：Email/密碼登入、Google OAuth、忘記密碼連結。 */
export function LoginScreen() {
  const { login, loginWithGoogle, sendResetEmail } = useAuthStore();
  const navigate = useNavigate();
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
      setError(Object.values(result.errors ?? {})[0] ?? '登入失敗');
    }
  }

  async function handleGoogle() {
    setError(null);
    const result = await loginWithGoogle();
    if (result.ok) {
      navigate('/');
    } else {
      setError(result.error ?? '登入失敗');
    }
  }

  async function handleForgotPassword() {
    setError(null);
    if (!email) {
      setError('請先輸入 Email');
      return;
    }
    const result = await sendResetEmail(email);
    if (result.ok) {
      setResetSent(true);
    } else {
      setError(result.error ?? '寄送失敗');
    }
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', p: 2 }}>
      <Paper sx={{ p: 4, maxWidth: 400, width: '100%' }} elevation={2}>
        <Typography variant="h5" sx={{ mb: 3 }}>
          登入 Linka
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {resetSent && <Alert severity="success" sx={{ mb: 2 }}>重設密碼信已寄出，請check信箱</Alert>}

        <form onSubmit={handleSubmit}>
          <TextField
            label="Email"
            type="email"
            fullWidth
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            label="密碼"
            type="password"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>
            登入
          </Button>
        </form>

        <Link component="button" variant="body2" onClick={handleForgotPassword} sx={{ mt: 1, display: 'block' }}>
          忘記密碼？
        </Link>

        <Divider sx={{ my: 2 }}>或</Divider>

        <Button variant="outlined" fullWidth onClick={handleGoogle}>
          用 Google 登入
        </Button>

        <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
          還沒有帳號？<Link component={RouterLink} to="/register">註冊</Link>
        </Typography>
      </Paper>
    </Box>
  );
}
