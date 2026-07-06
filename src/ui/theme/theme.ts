import { createTheme } from '@mui/material/styles';

// 視覺重新設計（使用者提供參考圖，見對話紀錄）：走 iOS 風格——大圓角、柔和陰影、飽和但不刺眼的
// 漸層色彩。字體堆疊把 -apple-system 放最前面，未來包裝成 iOS App 時會自動吃到系統 SF 字體。
// v1 先用單一 seed color 手動定義 primary/secondary，未來可換成完整 M3 tonal palette 產生器。
const PRIMARY = '#5B5FEF'; // 靛藍偏紫，對應參考圖「全部」晶片與 FAB 的漸層起色
const PRIMARY_LIGHT = '#4F8EF7'; // 漸層終色（藍）
export const PRIMARY_GRADIENT = `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_LIGHT} 100%)`;

export const theme = createTheme({
  palette: {
    primary: { main: PRIMARY, light: PRIMARY_LIGHT },
    secondary: { main: '#FF9F43' },
    error: { main: '#ba1a1a' },
    background: {
      default: '#F5F5FC',
      paper: '#FFFFFF',
    },
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "Roboto", "Noto Sans TC", sans-serif',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          boxShadow: '0 4px 16px rgba(60, 60, 120, 0.08)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 600,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          color: '#1C1C28',
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        primary: {
          backgroundImage: PRIMARY_GRADIENT,
          boxShadow: '0 8px 24px rgba(91, 95, 239, 0.4)',
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          '&.Mui-selected': {
            fontWeight: 700,
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        // 統一輸入框圓角觀感，避免 outlined variant 預設的直角跟整體圓潤風格不一致。
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 14,
          },
        },
      },
    },
  },
});
