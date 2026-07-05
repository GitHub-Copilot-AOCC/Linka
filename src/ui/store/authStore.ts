import { create } from 'zustand';
import type { User } from 'firebase/auth';
import {
  registerWithEmail,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  resetPassword,
  subscribeAuthState,
} from '@data/authRepository';
import { ensureUserProfile } from '@data/userProfileRepository';
import { ensureDefaultTags } from '@data/tagsRepository';
import { validateAuthForm } from '@domain/user';
import { detectBrowserLocale } from '@platform/locale';

interface AuthState {
  user: User | null;
  initializing: boolean;
  error: string | null;
  init: () => () => void;
  register: (email: string, password: string) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
  login: (email: string, password: string) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
  loginWithGoogle: () => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  sendResetEmail: (email: string) => Promise<{ ok: boolean; error?: string }>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initializing: true,
  error: null,

  init: () => {
    return subscribeAuthState((user) => {
      set({ user, initializing: false });
      if (user) {
        ensureUserProfile(user.uid, user.email ?? '', detectBrowserLocale(), user.displayName ?? undefined, user.photoURL ?? undefined).catch(
          (err) => {
            console.error('ensureUserProfile failed:', err);
            set({ error: (err as Error).message });
          }
        );
        ensureDefaultTags(user.uid).catch((err) => console.error('ensureDefaultTags failed:', err));
      }
    });
  },

  register: async (email, password) => {
    const result = validateAuthForm(email, password);
    if (!result.valid) return { ok: false, errors: result.errors as Record<string, string> };
    try {
      await registerWithEmail(email, password);
      return { ok: true };
    } catch (err) {
      return { ok: false, errors: { email: (err as Error).message } };
    }
  },

  login: async (email, password) => {
    try {
      await signInWithEmail(email, password);
      return { ok: true };
    } catch (err) {
      return { ok: false, errors: { email: (err as Error).message } };
    }
  },

  loginWithGoogle: async () => {
    try {
      await signInWithGoogle();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  },

  logout: async () => {
    await signOut();
  },

  sendResetEmail: async (email) => {
    try {
      await resetPassword(email);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  },
}));
