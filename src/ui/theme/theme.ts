import { createTheme } from '@mui/material/styles';

// 視覺重新設計（使用者提供參考圖，見對話紀錄）：走 iOS 風格——大圓角、柔和陰影、飽和但不刺眼的
// 漸層色彩。字體堆疊把 -apple-system 放最前面，未來包裝成 iOS App 時會自動吃到系統 SF 字體。
// v1 先用單一 seed color 手動定義 primary/secondary，未來可換成完整 M3 tonal palette 產生器。
const PRIMARY = '#5B5FEF'; // 靛藍偏紫，對應參考圖「全部」晶片與 FAB 的漸層起色
const PRIMARY_LIGHT = '#4F8EF7'; // 漸層終色（藍）
export const PRIMARY_GRADIENT = `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_LIGHT} 100%)`;

// 質感升級（見 emil-design-eng / apple-design skill 的具體建議，使用者要求套用到 web 版）：
// MUI 內建的 easing 太弱，缺乏「刻意感」；改用強一點的自訂曲線。進場/離場用 easeOut（開始快、
// 立即回饋），畫面上移動/變形用 easeInOut（自然加速再減速）。
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)';

// 半透明導覽列（apple-design 第 12 條「材質與層次」）：底部導覽列本來就是 position:fixed，
// 內容本來就會從它下面捲過，符合套用毛玻璃材質的前提；頂部 AppBar 改成 sticky 讓內容也能
// 從下面捲過，兩者都用同一個半透明底色 + blur。
export const TRANSLUCENT_SURFACE = {
  backgroundColor: 'rgba(255, 255, 255, 0.72)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
};

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
    h5: { letterSpacing: '-0.02em' }, // 大標題收緊字距（apple-design 第 15 條：字級越大，字距越緊）
    h6: { letterSpacing: '-0.01em' },
  },
  transitions: {
    easing: {
      easeOut: EASE_OUT,
      easeInOut: EASE_IN_OUT,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // 尊重使用者的「減少動態效果」系統設定（無障礙），縮短所有動畫/轉場到近乎瞬間。
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
            scrollBehavior: 'auto !important',
          },
        },
      },
    },
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
          transition: `transform 120ms ${EASE_OUT}`,
          '&:active': {
            transform: 'scale(0.96)',
          },
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
    // 按下即時回饋（apple-design 第 1 條「消除延遲」）：套在 ButtonBase 上一次涵蓋 Button/
    // IconButton/Tab/MenuItem/ListItemButton/BottomNavigationAction，不用每個元件分別加。
    MuiButtonBase: {
      styleOverrides: {
        root: {
          transition: `transform 120ms ${EASE_OUT}`,
          '&:active': {
            transform: 'scale(0.97)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          ...TRANSLUCENT_SURFACE,
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
