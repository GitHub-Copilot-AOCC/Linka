/** Web 實作：瀏覽器線上/離線狀態偵測（見 spec.md §5.11）。未來 RN 版需提供對應原生實作（例如 NetInfo）。 */
export function subscribeOnlineStatus(onChange: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => onChange(true);
  const handleOffline = () => onChange(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  onChange(navigator.onLine);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
