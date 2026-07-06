// 依標籤 id 自動分配固定的顏色+icon 組合（使用者提供參考圖：每個標籤晶片有專屬顏色跟 icon，
// 例如「家人」紅色愛心、「學長」綠色學士帽）。系統自動分配、不需要使用者手動設定，同一個標籤
// 每次都拿到同一組顏色（依 id 雜湊挑選），避免因為建立順序改變而變色。

import type { SvgIconComponent } from '@mui/icons-material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import GroupIcon from '@mui/icons-material/Group';
import SchoolIcon from '@mui/icons-material/School';
import WorkIcon from '@mui/icons-material/Work';
import StarIcon from '@mui/icons-material/Star';
import ApartmentIcon from '@mui/icons-material/Apartment';
import Diversity3Icon from '@mui/icons-material/Diversity3';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';

export interface TagStyle {
  bg: string;
  fg: string;
  icon: SvgIconComponent;
}

const TAG_STYLES: TagStyle[] = [
  { bg: '#FFE1EC', fg: '#D6336C', icon: FavoriteIcon },
  { bg: '#E3F2FD', fg: '#1565C0', icon: GroupIcon },
  { bg: '#E8F5E9', fg: '#2E7D32', icon: SchoolIcon },
  { bg: '#FFF3E0', fg: '#EF6C00', icon: WorkIcon },
  { bg: '#FFFDE7', fg: '#F9A825', icon: StarIcon },
  { bg: '#E0F2F1', fg: '#00695C', icon: ApartmentIcon },
  { bg: '#F3E5F5', fg: '#6A1B9A', icon: Diversity3Icon },
  { bg: '#ECEFF1', fg: '#455A64', icon: LocalOfferIcon },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** 依 seed（通常是 tag.id）決定固定的顏色+icon 組合。 */
export function tagStyleFor(seed: string): TagStyle {
  return TAG_STYLES[hashString(seed) % TAG_STYLES.length];
}
