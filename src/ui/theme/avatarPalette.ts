// 依聯絡人 id 決定固定的漸層頭像顏色（使用者提供參考圖：每個人的頭像圓圈是不同漸層色，
// 而不是統一的灰色）。用簡單字串雜湊挑色，同一位聯絡人每次都拿到同一個顏色，不需要存進資料庫。

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #6D5DF6 0%, #4F8EF7 100%)',
  'linear-gradient(135deg, #FF6B9D 0%, #FF9F43 100%)',
  'linear-gradient(135deg, #34D1BF 0%, #2E9CCA 100%)',
  'linear-gradient(135deg, #FDA085 0%, #F6416C 100%)',
  'linear-gradient(135deg, #A770EF 0%, #CF8BF3 100%)',
  'linear-gradient(135deg, #F7B733 0%, #FC4A1A 100%)',
  'linear-gradient(135deg, #43CBFF 0%, #9708CC 100%)',
  'linear-gradient(135deg, #11998E 0%, #38EF7D 100%)',
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** 依 seed（通常是 contact.id）決定固定的漸層背景色，供沒有上傳照片的頭像使用。 */
export function avatarGradientFor(seed: string): string {
  return AVATAR_GRADIENTS[hashString(seed) % AVATAR_GRADIENTS.length];
}
