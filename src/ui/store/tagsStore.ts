import { create } from 'zustand';
import type { Tag, NewTagInput } from '@domain/tag';
import { validateTagName } from '@domain/tag';
import { subscribeTags, createTag, deleteTag } from '@data/tagsRepository';

interface TagsState {
  tags: Tag[];
  subscribe: (uid: string) => () => void;
  add: (uid: string, input: NewTagInput) => Promise<{ ok: boolean; error?: string }>;
  remove: (uid: string, tagId: string) => Promise<void>;
}

export const useTagsStore = create<TagsState>((set, get) => ({
  tags: [],

  subscribe: (uid) => {
    return subscribeTags(uid, (tags) => set({ tags }));
  },

  add: async (uid, input) => {
    const result = validateTagName(input.name, get().tags.map((t) => t.name));
    if (!result.valid) return { ok: false, error: result.error };
    await createTag(uid, input);
    return { ok: true };
  },

  remove: async (uid, tagId) => {
    await deleteTag(uid, tagId);
  },
}));
