// 視覺重新設計 v2（使用者提供的設計系統規格：色彩收斂到 4 色 + 灰階，見對話紀錄）：
// 標籤晶片統一改成單色灰階，不再是先前版本「每個標籤自動配一組顏色+icon」的繽紛版本，
// 對照新版 mockup（聯絡人列表篩選列：除了選中的「全部」外，其餘標籤都是灰階膠囊、無 icon）。
// 保留函式簽章＋依 id 回傳固定樣式的介面，讓既有呼叫端（篩選列、標籤選擇、標籤管理）不用改。

export interface TagStyle {
  bg: string;
  fg: string;
}

const NEUTRAL: TagStyle = { bg: '#F2F2F7', fg: '#48484A' };

/** 保留參數是為了未來若要恢復依標籤區分顏色時，呼叫端不用改介面；目前一律回傳中性灰階。 */
export function tagStyleFor(_seed: string): TagStyle {
  return NEUTRAL;
}
