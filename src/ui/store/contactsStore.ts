import { create } from 'zustand';
import type { Contact, NewContactInput } from '@domain/contact';
import { validateContact } from '@domain/contact';
import {
  subscribeContacts,
  createContact,
  updateContact,
  deleteContact,
} from '@data/contactsRepository';
import { createLogEntry } from '@data/logsRepository';

interface ContactsState {
  contacts: Contact[];
  loading: boolean;
  error: string | null;
  subscribe: (uid: string) => () => void;
  add: (
    uid: string,
    input: NewContactInput
  ) => Promise<{ ok: boolean; id?: string; errors?: Record<string, string> }>;
  update: (uid: string, contactId: string, patch: Partial<Contact>) => Promise<void>;
  remove: (uid: string, contactId: string) => Promise<void>;
}

export const useContactsStore = create<ContactsState>((set, get) => ({
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
      const id = await createContact(uid, input);
      createLogEntry(uid, {
        action: '新增聯絡人',
        contactName: input.name,
        type: 'create',
        details: input.name,
      }).catch((err) => console.error('createLogEntry failed:', err));
      return { ok: true, id };
    } catch (err) {
      set({ error: (err as Error).message });
      return { ok: false, errors: { name: (err as Error).message } };
    }
  },

  update: async (uid, contactId, patch) => {
    await updateContact(uid, contactId, patch);
    const contactName = get().contacts.find((c) => c.id === contactId)?.name ?? '';
    createLogEntry(uid, {
      action: '更新聯絡人',
      contactName,
      type: 'update',
      details: Object.keys(patch).join(', '),
    }).catch((err) => console.error('createLogEntry failed:', err));
  },

  remove: async (uid, contactId) => {
    const contactName = get().contacts.find((c) => c.id === contactId)?.name ?? '';
    await deleteContact(uid, contactId);
    createLogEntry(uid, {
      action: '刪除聯絡人',
      contactName,
      type: 'delete',
      details: contactName,
    }).catch((err) => console.error('createLogEntry failed:', err));
  },
}));
