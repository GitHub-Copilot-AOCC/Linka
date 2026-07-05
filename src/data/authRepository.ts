import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

function requireAuth() {
  if (!auth) throw new Error('Firebase Auth is not configured');
  return auth;
}

export async function registerWithEmail(email: string, password: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(requireAuth(), email, password);
  return cred.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(requireAuth(), email, password);
  return cred.user;
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(requireAuth(), provider);
  return cred.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(requireAuth());
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(requireAuth(), email);
}

export function subscribeAuthState(onChange: (user: User | null) => void): () => void {
  return onAuthStateChanged(requireAuth(), onChange);
}
