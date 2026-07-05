import { create } from 'zustand';
import type { Contact, NewContactInput } from '@domain/contact';
import { validateContact } from '@domain/contact';
import {
  subscribeContacts,
  createContact,
  updateContact,
  deleteContact,
} from '@data/contactsRepository';

interface ContactsState {
  contacts: Contact[];
  loading: boolean;
  error: string | null;
  subscribe: (uid: string) => () => void;
  add: (uid: string, input: NewContactInput) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
  update: (uid: string, contactId: string, patch: Partial<Contact>) => Promise<void>;
  remove: (uid: string, contactId: string) => Promise<void>;
}

export const useContactsStore = create<ContactsState>((set) => ({
  contacts: [],
  loading: false,
  error: null,

  subscribe: (uid) => {
    set({ loading: true, error: null });
    return subscribeContacts(uid, (contacts) => set({ contacts, loading: false }));
  },

  add: async (uid, input) => {
    const result = validateContact(input);
    if (!result.valid) {
      return { ok: false, errors: result.errors as Record<string, string> };
    }
    try {
      await createContact(uid, input);
      return { ok: true };
    } catch (err) {
      set({ error: (err as Error).message });
      return { ok: false, errors: { name: (err as Error).message } };
    }
  },

  update: async (uid, contactId, patch) => {
    await updateContact(uid, contactId, patch);
  },

  remove: async (uid, contactId) => {
    await deleteContact(uid, contactId);
  },
}));
