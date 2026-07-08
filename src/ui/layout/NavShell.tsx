import { useMediaQuery, useTheme } from '@mui/material';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import ChatIcon from '@mui/icons-material/Chat';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SyncStatusChip } from '@ui/components/SyncStatusChip';

const RAIL_WIDTH = 88;

/**
 * 見 spec.md §11.2：手機寬度用 Navigation Bar（底部），桌面/平板寬度用 Navigation Rail（側邊窄導覽）。
 * MUI 沒有現成的 "Navigation Rail" 元件，這裡用 permanent Drawer + 垂直圖示清單自己組。
 */
export function NavShell({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const DESTINATIONS = [
    { path: '/', label: t('nav.home'), icon: <HomeIcon /> },
    { path: '/contacts', label: t('nav.contacts'), icon: <PeopleIcon /> },
    { path: '/assistant', label: t('nav.assistant'), icon: <ChatIcon /> },
    { path: '/settings', label: t('nav.settings'), icon: <SettingsIcon /> },
  ];

  const activeIndex = Math.max(
    0,
    DESTINATIONS.findIndex((d) => (d.path === '/' ? location.pathname === '/' : location.pathname.startsWith(d.path)))
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {isDesktop && (
        <Drawer
          variant="permanent"
          sx={{ width: RAIL_WIDTH, flexShrink: 0, [`& .MuiDrawer-paper`]: { width: RAIL_WIDTH, boxSizing: 'border-box' } }}
        >
          <Toolbar />
          <List sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, pt: 2 }}>
            {DESTINATIONS.map((d, i) => (
              <ListItemButton
                key={d.path}
                selected={i === activeIndex}
                onClick={() => navigate(d.path)}
                sx={{ flexDirection: 'column', borderRadius: 2, width: 64, py: 1 }}
              >
                <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center' }}>{d.icon}</ListItemIcon>
                <ListItemText primary={d.label} slotProps={{ primary: { variant: 'caption' } }} sx={{ textAlign: 'center' }} />
              </ListItemButton>
            ))}
          </List>
        </Drawer>
      )}

      {/*
        minWidth:0 是這裡的關鍵：本 Box 是最外層 flex row（line 50）的子元素，flex 子元素預設
        min-width:auto，代表它「不會縮到比內容本身還窄」。只要內容有一個不換行的長字串（例如
        長姓名/公司名），這個容器就會被撐到比螢幕寬，連帶讓內部所有 maxWidth:100% 都以「被撐大的
        寬度」為基準而失效（見使用者多次回報右側被裁切）。加上 minWidth:0 才能讓它縮回實際可用寬度，
        內部的 overflow-x:hidden 與姓名列的 noWrap 省略號才會真正生效。
      */}
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <AppBar position="static" color="default" elevation={1} sx={{ pt: 'env(safe-area-inset-top)' }}>
          <Toolbar sx={{ justifyContent: 'space-between' }}>
            <Typography variant="h6">{t('nav.appName')}</Typography>
            <SyncStatusChip />
          </Toolbar>
        </AppBar>

        {/*
          手機寬度時底部有 position:fixed 的導覽列蓋在內容上方，但內容本身沒有預留對應空間，
          導致頁面捲到底時，最後一段內容（例如儲存按鈕）會被導覽列蓋住、點不到（見使用者回報：
          捲到底按鈕被遮住、看起來像「彈回去」）。這裡統一在內容區塊底部留一段安全間距，
          不用每個畫面各自猜要留多少 padding-bottom。
        */}
        {/*
          maxWidth:100% + overflow-x:hidden 當所有頁面共用的最後一道防線：不管個別畫面內部
          哪個區塊算錯寬度，內容欄永遠不會超出可視範圍（見使用者回報：希望畫面固定大小，
          不要因為聯絡人欄位文字多寡而變動）。
        */}
        <Box
          sx={{
            pb: isDesktop ? 0 : 'calc(56px + env(safe-area-inset-bottom, 0px) + 16px)',
            maxWidth: '100%',
            overflowX: 'hidden',
          }}
        >
          {children}
        </Box>

        {!isDesktop && (
          <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, pb: 'env(safe-area-inset-bottom)' }} elevation={3}>
            <BottomNavigation
              showLabels
              value={activeIndex}
              onChange={(_, newValue) => navigate(DESTINATIONS[newValue].path)}
            >
              {DESTINATIONS.map((d) => (
                <BottomNavigationAction key={d.path} label={d.label} icon={d.icon} />
              ))}
            </BottomNavigation>
          </Paper>
        )}
      </Box>
    </Box>
  );
}
