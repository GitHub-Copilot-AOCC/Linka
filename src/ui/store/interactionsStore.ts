import { create } from 'zustand';
import type { Interaction, NewInteractionInput } from '@domain/interaction';
import { validateInteraction } from '@domain/interaction';
import {
  subscribeInteractionsForContact,
  createInteraction,
  deleteInteraction,
} from '@data/interactionsRepository';

interface InteractionsState {
  byContactId: Record<string, Interaction[]>;
  subscribe: (uid: string, contactId: string) => () => void;
  add: (uid: string, input: NewInteractionInput) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
  remove: (uid: string, interactionId: string) => Promise<void>;
}

export const useInteractionsStore = create<InteractionsState>((set) => ({
  byContactId: {},

  subscribe: (uid, contactId) => {
    return subscribeInteractionsForContact(uid, contactId, (interactions) => {
      set((state) => ({ byContactId: { ...state.byContactId, [contactId]: interactions } }));
    });
  },

  add: async (uid, input) => {
    const result = validateInteraction(input);
    if (!result.valid) {
      return { ok: false, errors: result.errors as Record<string, string> };
    }
    await createInteraction(uid, input);
    return { ok: true };
  },

  remove: async (uid, interactionId) => {
    await deleteInteraction(uid, interactionId);
  },
}));
