# Linka — 開發守則（CLAUDE.md）

本文件為 AI coding agent（Claude Code）在此專案中開發時必須遵守的規則。所有功能規格、資料模型、UX 原則以 [spec.md](spec.md) 為唯一依據；本文件只定義「怎麼做」的護欄，不重複規格內容。**開始任何開發任務前，先讀 spec.md 對應章節。**

現有 repo 內容（`App.tsx`、`components/`、`IMPLEMENTATION_PLAN.md` 等）是舊版程式碼，**不是**現況依據——舊版已知問題見 spec.md 附錄，v1 是重寫，不是在舊版上疊加功能。

---

## 1. 分層架構是硬規則，不是建議（對應 spec.md §8.3）

新架構統一放在 `src/` 下，與 repo 根目錄的舊版檔案（`App.tsx`、`components/`、`screens/`、`services/` 等）完全分開，避免命名衝突（例如舊版根目錄已有 `services/`）：

```
src/domain          — 純 TypeScript，不依賴任何平台 API：型別定義、驗證邏輯、業務規則
src/data            — Firebase 存取層（Firestore/Auth/Storage 的 repository 封裝）
src/services        — AI 服務呼叫、支付服務呼叫等外部整合
src/platform        — 平台介面與實作（圖片處理、檔案選取、通知等）
src/ui              — React 元件、畫面、路由（僅此層可以是 Web-only）
```

每個目錄底下都有一份 README.md 說明該層職責與規則，開發對應功能前先讀過。專案已設定對應的 import alias：`@domain/*`、`@data/*`、`@services/*`、`@platform/*`、`@ui/*`（見 `tsconfig.json`、`vite.config.ts`），新程式碼一律用這些 alias import，不要用相對路徑跨層引用。

**強制規則：**
- `src/domain`、`src/data`、`src/services` 內的檔案**禁止** import 任何瀏覽器/DOM API：`window`、`document`、`FileReader`、`canvas`、`localStorage` 等。這些一律透過 `src/platform` 的介面包裝，Web 用瀏覽器實作、未來 RN 用原生實作替換。
- 畫面元件（`src/ui`）**禁止**直接呼叫 Firestore SDK（`getDoc`、`onSnapshot`、`addDoc` 等）。所有資料存取一律經過 `src/data` 的 repository 函式。
- 畫面元件**禁止**內嵌驗證邏輯或業務規則（例如「免費版是否超過額度」的判斷）。這類邏輯屬於 `src/domain`，元件只呼叫 domain 函式取得結果並呈現。
- 新增檔案前先問自己：這段程式碼如果搬到 React Native 專案，能不能原封不動 import？如果答案是否，這段程式碼放錯層了。
- 若專案已設定 ESLint，新增/修改規則時應加入 `no-restricted-imports` 之類的規則，把上述限制變成自動化檢查，不要只靠人工記憶或 code review 抓。
- 舊版根目錄的 `App.tsx`、`components/`、`screens/`、`services/` 等檔案暫時保留（供參考/尚未移除），但**不是**新架構的基礎，新程式碼不應 import 這些舊檔案。

**代辦事項**：v1 開發初期應優先建立這五個目錄的骨架與對應的 ESLint 規則，作為所有後續功能開發的基礎（對應之前討論的「先做護欄再做功能」原則）。

---

## 2. 任務拆分原則

- 一個 PR／一個 session 聚焦 spec.md 的一個功能區塊（例如「§5.2 聯絡人 CRUD + §7 Contact 資料模型」），不要把多個不相關功能混在一次改動裡。
- 交代任務時明確引用 spec.md 章節號（例如「實作 §5.3a 語音快速記錄」），讓 agent 對照原文而非憑印象推測需求細節。
- 大型/多步驟功能（例如 §5.7 文件批次匯入的四步驟解析流程）先用 Plan mode 過一次分解步驟，確認方向後才動手實作，不要直接讓 agent 一次性生成整條 pipeline。
- 獨立、可平行、重複性高的工作（例如多個功能各自的 repository CRUD 函式、i18n 翻譯字串填充）才考慮用多 agent/workflow 平行處理；牽涉整體一致性判斷的工作（資料模型設計、Firestore Security Rules、認證流程）維持單一 agent 或人工通盤處理，避免多個 agent 各自做出不一致的設計決策。

---

## 3. 安全與機密資訊

- `.env`、Firebase service account 金鑰、Stripe secret key 等**絕對不可**出現在程式碼、commit 訊息或提交的檔案內容中；一律透過環境變數/Secret Manager 讀取。
- 產生程式碼時，AI API Key（Gemini）**不可**出現在任何前端可存取的檔案（`/ui`、`/platform`、任何會被打包進前端 bundle 的模組）；一律經 Cloud Function 代理（`geminiProxy`，見 spec.md §5.5 項目 9、§8.5）。
- 以下操作屬於高風險/難以復原，需先說明會變更什麼、經人工確認後才執行，不設為自動允許：
  - `firebase deploy`（尤其含 Functions、Firestore Rules、Storage Rules）
  - Firestore Security Rules 的任何修改
  - Stripe webhook / 訂閱相關設定變更
  - 任何 `git push --force`、刪除分支、覆寫遠端資料的操作
- Firestore Security Rules 屬於資安敏感區塊：AI 生成的規則草稿必須經人工逐條複查後才能部署，不可僅憑「測試過可以讀寫」就視為安全（測試不到的漏洞不代表不存在）。

---

## 4. CI/CD（對應 spec.md §8.6）

- Pipeline 需同時涵蓋前端建置部署與 `firebase deploy --only functions`，不可只部署前端後就視為完成（此為舊版曾卡關的已知問題，見附錄）。
- 部署前需檢查 Secret Manager 所需環境變數是否齊備，缺漏應讓 pipeline 失敗並明確報錯，而非部署後才在執行時發現。

---

## 5. 驗證與完成定義

- 修改前端/UI 相關程式碼後，**必須實際跑起來看過**（本機啟動、瀏覽器操作），不能只看 diff 或型別檢查通過就回報完成，尤其是：
  - §5.11 離線同步狀態顯示是否正確反映三態
  - §5.3a 快速記錄的預覽確認流程是否真的擋下未確認就寫入
  - §11 Material 元件（Navigation Bar/Rail、FAB、Card、Tabs）在不同螢幕寬度下的呈現
- 涉及 Cloud Functions 的變更，若條件允許應以 Firebase local emulator 驗證，而非直接部署到正式環境測試。
- 型別檢查（`tsc`）與 lint 通過是最低門檻，不等於功能正確；功能正確性需對照 spec.md 的規格文字逐項確認。

---

## 6. 文件同步

- 開發過程中若發現某個技術細節與 spec.md 定案的不同（例如函式庫版本限制、平台 API 行為差異），**回頭更新 spec.md**，不要讓程式碼悄悄偏離文件卻不記錄。這是刻意要避免重演舊版「README/IMPLEMENTATION_PLAN.md 落後於實際程式碼」的問題（見附錄）。
- `IMPLEMENTATION_PLAN.md`、`README.md` 為舊版遺留文件，內容不可信，v1 開發不應參照；如需專案說明文件，應重新撰寫並與 spec.md 保持一致。

---

## 7. 技術棧速查（詳見 spec.md §8）

| 項目 | 選擇 |
|---|---|
| 前端框架 | React + Vite + TypeScript |
| 路由 | React Router |
| 狀態管理 | Zustand（含 persist middleware，供離線狀態快取） |
| UI 元件庫 | MUI（Material UI，Material Design 3） |
| 多語言 | i18next / react-i18next |
| 後端 | Firebase（Firestore / Auth / Storage / Cloud Functions） |
| AI | Gemini，透過 Cloud Function 代理（`geminiProxy`），前端不可直接持有 API Key |
| 支付 | Stripe（Web 訂閱） |
| 未來手機版元件庫 | `react-native-paper`（與 Web 共用同一份 Material 3 token） |
