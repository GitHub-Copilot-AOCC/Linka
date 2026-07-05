# Linka 開發任務清單

> 對照 [spec.md](spec.md)。狀態以本檔案最後更新時間為準，開發過程中請隨手更新，避免重演舊版「文件落後程式碼」的問題（見 spec.md 附錄）。
> 最後更新：2026-07-05

---

## ✅ 已完成

### 基礎設施
- [x] 分層架構骨架（`src/domain` `src/data` `src/services` `src/platform` `src/ui`）
- [x] Firebase 專案設定：Firestore + Security Rules、Storage + Security Rules、Auth（Email/密碼已啟用）、Hosting、Cloud Functions IAM 權限
- [x] CI/CD（GitHub Actions 部署到 Firebase Hosting + Functions）
- [x] Gemini 模型定案（`gemini-3.1-flash-lite`，見 spec.md §8.5）
- [x] **重大缺口修復**：`index.html` 原本一直指向舊版 `index.tsx`/`App.tsx`，`vite build`／根目錄 dev server 出的其實是舊版 App，新版只能靠手動打 `/index-new.html` 才看得到——代表這幾天所有已合併的 `src/` 功能實際上從沒被真正打包/部署出去過。已將 `index-new.html` 內容提升為正式 `index.html`，舊版移到 `index-legacy.html` 保留參考；同時移除 `src/main.tsx` 裡寫死的 Router `basename="/index-new.html"`（否則根路徑會直接白畫面）。已用瀏覽器實測根路徑、`/contacts`、`/settings` 路由正常。**下次部署（`firebase deploy --only hosting`）出去的才會是真正的新版 App，這點務必讓 Codex 跟其他協作者知道。**

### 功能
| 章節 | 功能 | 備註 |
|---|---|---|
| §5.1 | 帳號登入/註冊/登出、忘記密碼、Google OAuth | Email/密碼完整；**Google OAuth 已在 Console 手動啟用並驗證**——測試時收到 `auth/popup-blocked`（自動化環境阻擋彈出視窗，不是設定問題），確認 provider 設定正確、程式碼正確呼叫 `signInWithPopup`；真人點擊不會遇到這個阻擋 |
| §5.2 | 聯絡人 CRUD 全套 | 新增/編輯/刪除、搜尋、依姓名/星級排序、標籤與社交圈篩選 |
| §5.2 | 聯絡人照片上傳（Storage） | Canvas 壓縮 + 上傳/刪除已完成；**檔案選擇的實際點擊互動尚未手動測過**（自動化工具在這個環境模擬不了真實檔案選取），合併前建議手動點一次驗證 |
| §5.3 | 互動紀錄（手動） | 會議/通話/Email 記錄，綁定聯絡人 |
| §5.4 | 提醒（手動） | 設定下次聯絡日期 + 首頁待辦面板 |
| §5.10 | 操作歷史紀錄 | append-only，記錄 CRUD + 互動操作 |
| §5.11 | 離線/同步狀態指示 | Firestore offline persistence 本來就有，這次補上 UI 三態顯示 |
| §11.2 | Material 導覽（Bottom Nav/Rail） | 手機用底部導覽、桌面用側邊 Rail，已驗證兩種寬度切換正確 |
| §5.12 | 多語言（i18next） | 繁中/英文，瀏覽器自動偵測 + 設定手動切換，已驗證整站切換正確；使用者資料（姓名/公司/標籤）刻意不翻譯 |
| §5.9 | vCard (.vcf) 匯入 | 解析→預覽勾選（重複資料預警）→批次寫入；解析邏輯已直接驗證，**檔案選取點擊互動同樣未手動測過**；Google 聯絡人 API 匯入未做（需額外 OAuth scope） |
| §3 | AI 用量顯示（唯讀） | Settings 顯示「X / 1000 次」+ 進度條；**真正的配額執行/增量是後端工作**（Security Rules 擋掉前端寫入），前端只做顯示，已用測試文件驗證兩種狀態 |
| §5.5 項目4 | AI 建議話題 | `functions/src/index.ts` 既有 `getSuggestedTopics` action 不需改動（本來就是通用 prompt passthrough）；新增 `src/domain/topicSuggestion.ts`（prompt 組裝/回應解析）、`src/services/geminiService.ts`（呼叫 `geminiProxy`，新增 `VITE_GEMINI_PROXY_URL` 環境變數）、`src/ui/components/SuggestedTopicsDialog.tsx`，接在聯絡人列表的新圖示按鈕；已在真實瀏覽器測過完整流程（含正式環境 `geminiProxy`），成功產出 3 則繁中話題建議 |
| §5.3a | AI 語音/文字快速記錄 | Codex 在 `codex/ai-quick-log-and-proactive-reminders` 完成後端 + 前端雛型，但該分支落後 main 太多（拆分導覽/i18n 之前的舊結構），**已手動整合**：後端 `functions/src/index.ts` 的 `parseQuickCapturePreview` action 原封不動採用；前端把 `QuickCaptureDialog`/`ContactInteractionsDialog` 多聯絡人綁定邏輯搬到現在的檔案結構上，補回 i18n（Codex 版本沒有），修正 `<Stack direction="row">` 型別地雷（見 CLAUDE.md §7），服務層與建議話題共用同一個 `geminiService.ts`。**已在真實瀏覽器端到端測過**：文字輸入「今天跟王小明喝咖啡...兩週後提醒我」→ AI 正確比對既有聯絡人、產生互動摘要、推算提醒日期（+14 天）→ 確認寫入後 Interaction 與 `Contact.nextContactReminder` 都正確落地 |
| §5.6 | AI 主動提醒（生日/久未聯絡） | 後端 `generateProactiveSuggestionsDaily` 排程函式（每日 9:00 Asia/Taipei）已部署；規則邏輯（生日前 3 天、無互動 60 天、去重不重複提醒已標記完成的建議）已 code review 確認符合 spec。前端 `AISuggestionsPanel` 已接進首頁。**已用真實資料端到端驗證通過**：裝了 gcloud CLI 後改用更直接的方式——暫時在 `geminiProxy` 加一個除錯用 action，直接呼叫排程函式背後同一套 `buildRuleBasedSuggestions`/`persistSuggestions`（不是重寫邏輯），部署後對測試帳號觸發一次，成功產生一筆 `manual_reminder_due` 建議並正確寫入 Firestore；首頁「今天需要處理」卡片正確顯示，點「採納」後正確建立 Interaction（`已採納 AI 建議：...`）且清空原本的 `nextContactReminder`。驗證完已移除除錯 action 並重新部署乾淨版本 |

---

## ⏳ 待完成

| 章節 | 功能 | 依賴/備註 |
|---|---|---|
| §5.5 項目1 | 名片 OCR | 需要 Cloud Function + Gemini（**已指派 Codex**：先把 `geminiProxy` 既有 `extractContactFromCard` action 換成 `gemini-3.1-flash-lite`） |
| §5.5a | AI 問答秘書（聊天） | 需要 Cloud Function，「先查詢後生成」二階段設計 |
| §5.7 | 文件通訊錄批次匯入 | 需要 Cloud Function 解析 PDF/Word/Excel |
| §5.8 | 網路身分研究摘要 + 照片搜尋 | 需要 Cloud Function + Google Search 工具 |
| §5.9 | Google 聯絡人 API 匯入 | 需要額外 OAuth scope（People API），vCard 部分已完成 |
| §8.4 | Stripe 訂閱整合 | 完全沒開始 |
| §3 | AI 額度真正執行（增量/擋額度） | 前端唯讀顯示已完成，**寫入/增量是 Cloud Function 工作**，見下方 Codex 協調事項（periodId 格式） |
| — | Cloud Functions 本體 | `functions/` 目錄目前是舊版程式碼，`geminiProxy` 需要全面重寫擴充；**第一個任務已交給 Codex**：把 4 個既有 action 的模型從 `gemini-2.0-flash-exp` 換成 `gemini-3.1-flash-lite` |

---

## 分工建議

**核心考量**：`functions/`（Cloud Functions 後端）跟 `src/`（前端）是完全分開的兩個資料夾，兩人同時改不會互相衝突，是最適合平行開發的切分點。

### 建議：同事負責 Cloud Functions 後端
理由：目前**所有 AI 功能都卡在沒有 Cloud Function**，是最大瓶頸，且完全獨立於前端工作。

建議順序：
1. 重寫 `geminiProxy`，改用 `gemini-3.1-flash-lite`，先支援名片 OCR（§5.5 項目1，最簡單，單張圖辨識）
2. 擴充支援 §5.3a 語音/文字快速記錄（音訊直接送 Gemini，見 spec.md §5.3a 定案的技術路徑）
3. Stripe Webhook Cloud Function 骨架（§8.4），先處理訂閱事件更新 `UserProfile.plan`
4. 每日排程 Cloud Function 骨架（§5.6 主動提醒），先做純規則比對（生日、無互動天數），不呼叫 AI 的部分

這四項幾乎不需要碰 `src/` 任何檔案，可以完全並行。

### 建議：前端持續開發
- ~~§11.2 Material 導覽骨架~~、~~§5.2 照片上傳~~、~~§5.12 多語言~~、~~§5.9 vCard 匯入~~、~~§3 用量顯示~~ 都已完成（見上方已完成表格）
- 目前所有「純前端、不需要 Cloud Function」的項目已經做完。下一批建議：
  - 等 Codex 那邊的 `geminiProxy` 出來後，接第一個 AI 功能的前端串接（名片 OCR 最簡單，UI 只需一個拍照/上傳按鈕 + 呼叫 Cloud Function + 帶入新增聯絡人表單）
  - 或先做 §8.4 Stripe 前端部分（Checkout 按鈕、方案頁面），但這塊涉及金流，動工前建議先跟你確認範圍

### Codex 協調事項：periodId 格式
`src/domain/usageQuota.ts` 的 `currentPeriodId()` 定義配額文件 ID 格式為 `YYYY-MM`（例如 `2026-07`）。Codex 之後寫 Cloud Function 建立/更新 `users/{uid}/usage/{periodId}` 時，**periodId 必須用同一種格式**，否則前端會讀到不同文件、永遠顯示「尚無用量資料」。

### 交接風險提醒
這批功能是**疊在一起的分支**（一個接一個從前一個開出來，不是各自獨立於 `main`）。開始 Cloud Functions 工作前，建議：
- 先把目前所有功能分支合併進 `main`（依序或直接合併最新的 `feature/operation-log`，見下方分支狀態），讓兩人都從乾淨的 `main` 起步；或
- 若時間緊迫必須立刻並行，同事可以先從 `feature/operation-log` 開分支（拿到最新的 domain 型別定義如 `Interaction`、`Tag`、`LogEntry`），但要留意之後合併回 `main` 時的分支順序。

### 目前分支狀態（2026-07-05）
以下分支依序疊加（每個都包含前一個的所有變更），`feature/usage-quota-display` 是目前最新、包含全部 14 個功能的分支：

```
main
 └─ chore/gemini-3.1-flash-lite
     └─ feature/auth-login
         └─ feature/interactions-crud
             └─ feature/manual-reminders
                 └─ feature/contact-edit-delete
                     └─ feature/contacts-search-sort
                         └─ feature/tags
                             └─ feature/offline-status
                                 └─ feature/operation-log
                                     └─ feature/nav-shell
                                         └─ feature/contact-photos
                                             └─ feature/i18n
                                                 └─ feature/vcard-import
                                                     └─ feature/usage-quota-display   ← 最新
```

合併方式二選一：
1. **簡單**：直接把 `feature/usage-quota-display` 合併進 `main`（一次拿到全部 14 個功能）
2. **逐步**：依上圖順序一個個合併，方便逐個 review

**合併前提醒**：`feature/contact-photos` 的照片上傳互動還沒手動點過（見上方已完成表格的備註），建議合併前先手動測一次「新增照片」按鈕。

### Codex 任務指派
已交給 Codex 一個任務（見對話紀錄，此處摘要）：把 `functions/src/index.ts` 內 `geminiProxy` 的 4 個 action（`getNetworkingAdvice`、`extractContactFromCard`、`getSuggestedTopics`、`getProfileSummary`）模型從 `gemini-2.0-flash-exp` 換成 `gemini-3.1-flash-lite`，範圍限定在該檔案，驗收方式是 `cd functions && npm run build` + emulator 手動測試。這是後續所有 AI 功能（§5.3a、§5.5、§5.6 等）的前置工作。

### 經驗教訓：分支存活時間不要拉太長
Codex 的 `codex/ai-quick-log-and-proactive-reminders` 分支做 §5.3a/§5.6 時，main 同時完成了導覽拆分（`HomeScreen.tsx` → `NavShell`+`DashboardScreen`）跟 i18n 全站改造，導致 rebase 直接衝突（`HomeScreen.tsx` modify/delete），前端部分只能手動搬移、補回 i18n。**後端（`functions/src/index.ts`）完全沒事**，因為 main 那段時間完全沒人動這個檔案。這印證了 TASKS.md 一開始就寫的分工原則（`functions/` 跟 `src/` 分開最適合並行）：**Cloud Function 本體的分支可以放心跑久一點，但只要有碰 `src/ui`，就該盡快 rebase/合併，不要累積太多天**，尤其是 UI 骨架/i18n 這類全站性重構進行中的時候。
