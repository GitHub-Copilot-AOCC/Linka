import { create } from 'zustand';
import type { UsageQuota } from '@domain/usageQuota';
import { currentPeriodId } from '@domain/usageQuota';
import { subscribeUsageQuota } from '@data/usageQuotaRepository';

interface UsageQuotaState {
  quota: UsageQuota | null;
  subscribe: (uid: string) => () => void;
}

export const useUsageQuotaStore = create<UsageQuotaState>((set) => ({
  quota: null,
  subscribe: (uid) => subscribeUsageQuota(uid, currentPeriodId(), (quota) => set({ quota })),
}));
