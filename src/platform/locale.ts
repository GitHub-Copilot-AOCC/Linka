import type { Locale } from '@domain/user';

/** Web 實作：依瀏覽器語言偵測預設語系（見 spec.md §5.12）。未來 RN 版需提供對應的原生實作。 */
export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return 'zh-TW';
  return navigator.language.startsWith('en') ? 'en' : 'zh-TW';
}
