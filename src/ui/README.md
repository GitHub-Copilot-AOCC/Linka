# /src/ui

React 元件、畫面、路由。這是唯一允許是 Web-only 的層級，也是唯一允許 import MUI（Material Design 3，見 [spec.md §11](../../spec.md)）與 React Router 的地方。

建議子目錄（依 [spec.md §11.2](../../spec.md) 導覽架構與各功能區塊逐步建立，此處先列方向，非強制）：

```
ui/
  theme/          — Material 3 theme 設定（seed color、token，供 MUI ThemeProvider 使用）
  layout/         — Navigation Bar / Navigation Rail 等導覽骨架
  screens/        — 各畫面（首頁、聯絡人列表、聯絡人詳情、快速記錄、AI 問答、設定...）
  components/     — 可重用元件（AI 卡片、聯絡人卡片等）
  store/          — Zustand store（狀態管理，見 CLAUDE.md §7）
```

## 規則（見 [CLAUDE.md](../../CLAUDE.md) §1）

- 禁止直接呼叫 Firestore SDK；資料存取一律經由 `/data` 的 repository 函式
- 禁止內嵌業務規則/驗證邏輯；判斷邏輯呼叫 `/domain`，元件只負責呈現結果
- 圖片處理、檔案選取、錄音等瀏覽器 API 一律透過 `/platform` 介面使用，不直接呼叫 `window`/`document`/`FileReader`/`canvas`

> 注意：repo 根目錄現有舊版 `App.tsx`、`components/`、`screens/` 為舊版程式碼，**不是**這一層的基礎，v1 重寫不沿用其實作。
