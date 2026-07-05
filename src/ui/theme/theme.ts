import { createTheme } from '@mui/material/styles';

// Material Design 3 seed color 設定（見 spec.md §11.1）。
// v1 先用單一 seed color 手動定義 primary/secondary，未來可換成完整 M3 tonal palette 產生器。
const SEED_COLOR = '#3f51b5';

export const theme = createTheme({
  palette: {
    primary: { main: SEED_COLOR },
    secondary: { main: '#00897b' },
    error: { main: '#ba1a1a' },
  },
  shape: {
    borderRadius: 12, // 對照 Material 3 shape scale（見 spec.md §11.1）
  },
  typography: {
    fontFamily: '"Roboto", "Noto Sans TC", sans-serif',
  },
});
