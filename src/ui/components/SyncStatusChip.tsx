import { useEffect } from 'react';
import { Chip, Tooltip } from '@mui/material';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import { useSyncStatusStore } from '@ui/store/syncStatusStore';

const CONFIG = {
  offline: { label: '離線中', icon: <CloudOffIcon fontSize="small" />, color: 'default' as const },
  syncing: { label: '同步中', icon: <CloudSyncIcon fontSize="small" />, color: 'warning' as const },
  synced: { label: '已同步', icon: <CloudDoneIcon fontSize="small" />, color: 'success' as const },
};

/** 離線/同步狀態指示（見 spec.md §5.11、§11.7）：安靜地存在，只用小圖示+文字，不彈窗打斷操作。 */
export function SyncStatusChip() {
  const { status, init } = useSyncStatusStore();

  useEffect(() => init(), [init]);

  const { label, icon, color } = CONFIG[status];

  return (
    <Tooltip title={status === 'offline' ? '無網路連線，資料會在恢復連線後自動同步' : label}>
      <Chip size="small" icon={icon} label={label} color={color} variant="outlined" />
    </Tooltip>
  );
}
