// 型別對照 spec.md §7 UserProfile。純 TypeScript，不依賴任何平台 API。

export type Plan = 'free' | 'paid';
export type SubscriptionSource = 'stripe' | 'ios_iap' | 'android_iap';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due';
export type Locale = 'zh-TW' | 'en';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  locale: Locale;
  plan: Plan;
  subscriptionSource?: SubscriptionSource;
  subscriptionStatus?: SubscriptionStatus;
  createdAt: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export interface AuthFormResult {
  valid: boolean;
  errors: { email?: string; password?: string };
}

/** 驗證註冊/登入表單輸入（見 spec.md §5.1）。 */
export function validateAuthForm(email: string, password: string): AuthFormResult {
  const errors: AuthFormResult['errors'] = {};
  if (!email || !EMAIL_RE.test(email)) {
    errors.email = 'email format is invalid';
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * 建立新使用者的預設 profile（見 spec.md §7：plan 預設 free，locale 依瀏覽器語言偵測見 §5.12）。
 * 不寫入值為 undefined 的選填欄位（例如 Email/密碼註冊沒有 displayName/photoURL），
 * 因為 Firestore 的 setDoc 遇到 undefined 欄位值會直接拋錯。
 */
export function applyUserProfileDefaults(
  uid: string,
  email: string,
  locale: Locale,
  displayName?: string,
  photoURL?: string
): UserProfile {
  const profile: UserProfile = {
    uid,
    email,
    locale,
    plan: 'free',
    createdAt: Date.now(),
  };
  if (displayName !== undefined) profile.displayName = displayName;
  if (photoURL !== undefined) profile.photoURL = photoURL;
  return profile;
}
