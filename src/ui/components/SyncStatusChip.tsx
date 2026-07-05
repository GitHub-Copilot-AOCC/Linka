import { useEffect } from 'react';
import { Chip, Tooltip } from '@mui/material';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import { useTranslation } from 'react-i18next';
import { useSyncStatusStore } from '@ui/store/syncStatusStore';

const ICON_COLOR = {
  offline: { icon: <CloudOffIcon fontSize="small" />, color: 'default' as const },
  syncing: { icon: <CloudSyncIcon fontSize="small" />, color: 'warning' as const },
  synced: { icon: <CloudDoneIcon fontSize="small" />, color: 'success' as const },
};

/** 離線/同步狀態指示（見 spec.md §5.11、§11.7）：安靜地存在，只用小圖示+文字，不彈窗打斷操作。 */
export function SyncStatusChip() {
  const { status, init } = useSyncStatusStore();
  const { t } = useTranslation();

  useEffect(() => init(), [init]);

  const { icon, color } = ICON_COLOR[status];
  const label = t(`syncStatus.${status}`);

  return (
    <Tooltip title={status === 'offline' ? t('syncStatus.offlineTooltip') : label}>
      <Chip size="small" icon={icon} label={label} color={color} variant="outlined" />
    </Tooltip>
  );
}
