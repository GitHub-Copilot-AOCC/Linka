import { createTheme } from '@mui/material/styles';

// 視覺重新設計 v2（使用者提供完整逐頁 mockup + 設計系統規格，見對話紀錄）：
// 色彩收斂到 4 色 + 灰階（不再是每個標籤/圖示各自配色的繽紛版本），字級照 mockup 附的
// SF Pro 字級表（34 Bold / 22 Semibold / 17 Regular / 13 Regular），卡片圓角 16pt、
// 陰影 0 4 20 rgba(0,0,0,0.06)。字體堆疊把 -apple-system 放最前面，未來包裝成 iOS App
// 時會自動吃到系統 SF 字體。
const PRIMARY = '#6C63FF';
const PRIMARY_LIGHT = '#A78BFA'; // 設計系統的「輔助色」，也當作漸層終色使用
const SUCCESS = '#34C759';
const WARNING = '#FF9F0A';
const BACKGROUND = '#F2F2F7';
const TEXT_SECONDARY = '#8E8E93';
export const PRIMARY_GRADIENT = `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_LIGHT} 100%)`;
export const PRIMARY_SOFT = 'rgba(108, 99, 255, 0.1)'; // AI 建議卡等淡紫底色

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
    secondary: { main: PRIMARY_LIGHT },
    success: { main: SUCCESS },
    warning: { main: WARNING },
    error: { main: '#ba1a1a' },
    text: {
      primary: '#1C1C28',
      secondary: TEXT_SECONDARY,
    },
    background: {
      default: BACKGROUND,
      paper: '#FFFFFF',
    },
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "Roboto", "Noto Sans TC", sans-serif',
    // 對照使用者提供的字級表：34 Bold（大標題）/ 22 Semibold（區塊標題）/ 17 Regular（內文）/
    // 13 Regular（輔助文字）。h4 當首頁問候語等大標題，h6 當區塊標題，body1 當內文。
    h4: { fontSize: '2.125rem', fontWeight: 700, letterSpacing: '-0.02em' }, // 34px
    h5: { fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' },
    h6: { fontSize: '1.375rem', fontWeight: 600, letterSpacing: '-0.01em' }, // 22px
    body1: { fontSize: '1.0625rem' }, // 17px
    caption: { fontSize: '0.8125rem' }, // 13px
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
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
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
