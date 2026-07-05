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
import { useLocation, useNavigate } from 'react-router-dom';
import { SyncStatusChip } from '@ui/components/SyncStatusChip';

const DESTINATIONS = [
  { path: '/', label: '首頁', icon: <HomeIcon /> },
  { path: '/contacts', label: '聯絡人', icon: <PeopleIcon /> },
  { path: '/settings', label: '設定', icon: <SettingsIcon /> },
];

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

      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar sx={{ justifyContent: 'space-between' }}>
            <Typography variant="h6">Linka</Typography>
            <SyncStatusChip />
          </Toolbar>
        </AppBar>

        {children}

        {!isDesktop && (
          <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={3}>
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
