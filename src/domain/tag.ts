// 型別對照 spec.md §7 Tag。標籤／社交圈分類（見 §5.2）。

export interface Tag {
  id: string;
  name: string;
  icon?: string;
  createdAt: number;
}

export type NewTagInput = Pick<Tag, 'name' | 'icon'>;

/** v1 預設分類（見 spec.md §5.2），新使用者第一次進入時建立。 */
export const DEFAULT_TAG_NAMES = ['廠商', '客戶', '家人', 'VIP'];

export interface TagValidationResult {
  valid: boolean;
  error?: string;
}

/** 驗證標籤名稱：必填、去除重複（不分大小寫比對）。 */
export function validateTagName(name: string, existingNames: string[]): TagValidationResult {
  const trimmed = name.trim();
  if (!trimmed) return { valid: false, error: 'name is required' };
  if (existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
    return { valid: false, error: 'tag already exists' };
  }
  return { valid: true };
}
