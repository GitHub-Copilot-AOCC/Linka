import { create } from 'zustand';
import type { Interaction, NewInteractionInput } from '@domain/interaction';
import { validateInteraction } from '@domain/interaction';
import {
  subscribeInteractionsForContact,
  createInteraction,
  deleteInteraction,
} from '@data/interactionsRepository';
import { createLogEntry } from '@data/logsRepository';

interface InteractionsState {
  byContactId: Record<string, Interaction[]>;
  subscribe: (uid: string, contactId: string) => () => void;
  add: (
    uid: string,
    input: NewInteractionInput,
    contactName: string
  ) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
  remove: (uid: string, interactionId: string) => Promise<void>;
}

export const useInteractionsStore = create<InteractionsState>((set) => ({
  byContactId: {},

  subscribe: (uid, contactId) => {
    return subscribeInteractionsForContact(uid, contactId, (interactions) => {
      set((state) => ({ byContactId: { ...state.byContactId, [contactId]: interactions } }));
    });
  },

  add: async (uid, input, contactName) => {
    const result = validateInteraction(input);
    if (!result.valid) {
      return { ok: false, errors: result.errors as Record<string, string> };
    }
    await createInteraction(uid, input);
    createLogEntry(uid, {
      action: '新增互動紀錄',
      contactName,
      type: 'interaction',
      details: input.description,
    }).catch((err) => console.error('createLogEntry failed:', err));
    return { ok: true };
  },

  remove: async (uid, interactionId) => {
    await deleteInteraction(uid, interactionId);
  },
}));
