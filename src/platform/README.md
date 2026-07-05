# /src/platform

平台介面與實作。把瀏覽器專屬 API 包裝成平台無關的介面，Web 用瀏覽器實作，未來 React Native 用原生實作替換，呼叫端（`/domain`、`/data`、`/services`、`/ui`）只依賴介面，不依賴實作。

對照 [spec.md §4、§8.2](../../spec.md) 需要包裝的項目：

- 圖片壓縮／處理（Web：Canvas API；未來 RN：原生圖片處理）
- 檔案選取（Web：`<input type="file">` / Contact Picker API；未來 RN：原生檔案選取器）
- 通知/提示（Web：站內提示元件；未來 RN：Push Notification）
- 錄音（§5.3a 語音快速記錄，Web：MediaRecorder API；未來 RN：原生錄音 API）

## 規則（見 [CLAUDE.md](../../CLAUDE.md) §1）

- 每個平台能力先定義介面（interface），再各自提供 Web 實作
- 目錄結構建議：`platform/<capability>/index.ts`（介面 + Web 實作），未來 RN 專案新增 `<capability>.native.ts` 或同名不同副檔名做平台切換
