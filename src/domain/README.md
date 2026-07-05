# /src/domain

純 TypeScript，不依賴任何平台/瀏覽器 API。負責：

- 型別定義（`Contact`、`Interaction`、`UserProfile`、`UsageQuota` 等，對照 [spec.md §7](../../spec.md)）
- 資料驗證邏輯（例如聯絡人欄位驗證、AI 配額是否超額判斷）
- 業務規則（例如提醒門檻計算、星級預設值、免費版限制邏輯）

## 規則（見 [CLAUDE.md](../../CLAUDE.md) §1）

- 禁止 import `window`、`document`、`FileReader`、`canvas`、`localStorage` 等瀏覽器 API
- 禁止 import React 或任何 UI 框架
- 禁止直接呼叫 Firestore/Firebase SDK（那是 `/data` 層的責任）
- 這一層的程式碼必須能不做任何修改直接被未來的 React Native 專案 import
