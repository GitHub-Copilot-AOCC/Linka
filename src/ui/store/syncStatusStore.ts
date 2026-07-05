import { create } from 'zustand';
import { subscribeOnlineStatus } from '@platform/connectivity';
import { subscribeFirestoreSync } from '@data/syncStatus';

export type SyncStatus = 'offline' | 'syncing' | 'synced';

interface SyncStatusState {
  status: SyncStatus;
  init: () => () => void;
}

/**
 * 見 spec.md §5.11：離線中／同步中／已同步三態。
 * 判斷邏輯：離線時一律顯示「離線中」；上線後預設「同步中」，
 * 直到 Firestore onSnapshotsInSync 觸發（本地快取追上伺服器）才轉為「已同步」，
 * 每次重新上線都會回到「同步中」再等待下一次同步完成。
 */
export const useSyncStatusStore = create<SyncStatusState>((set) => ({
  status: 'syncing',

  init: () => {
    let online = true;

    const unsubscribeOnline = subscribeOnlineStatus((isOnline) => {
      online = isOnline;
      set({ status: isOnline ? 'syncing' : 'offline' });
    });

    const unsubscribeSync = subscribeFirestoreSync(() => {
      if (online) set({ status: 'synced' });
    });

    return () => {
      unsubscribeOnline();
      unsubscribeSync();
    };
  },
}));
