import { create } from 'zustand';
import type { LogEntry } from '@domain/logEntry';
import { subscribeRecentLogs } from '@data/logsRepository';

interface LogsState {
  logs: LogEntry[];
  subscribe: (uid: string) => () => void;
}

export const useLogsStore = create<LogsState>((set) => ({
  logs: [],
  subscribe: (uid) => subscribeRecentLogs(uid, (logs) => set({ logs })),
}));
