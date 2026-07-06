# Linka 開發任務清單

> 對照 [spec.md](spec.md)。狀態以本檔案最後更新時間為準，開發過程中請隨手更新，避免重演舊版「文件落後程式碼」的問題（見 spec.md 附錄）。
> 最後更新：2026-07-06

**§11.5/§11.6 後曾表示開發到此為止**，之後使用者又提出三項新需求（標籤複選＋隨時新增、Excel 匯出、首頁近況摘要），已完成見下方表格。其餘「⏳ 待完成」項目（Google 聯絡人 API 匯入、Stripe、AI 額度後端執行、§5.8 研究摘要重試、§5.8 照片搜尋）維持延後，不主動動工。

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
| §5.5 項目1 | 名片 OCR | `functions/src/index.ts` 既有 `extractContactFromCard` action 早就是 `gemini-3.1-flash-lite`，本來就不需要 Codex 那個任務（模型是全域共用常數，之前的 model swap 已經順帶做完了）；新增 `src/domain/businessCard.ts`（prompt/解析）、`geminiService.ts` 補 `scanBusinessCard()`、`src/ui/components/BusinessCardScanDialog.tsx`（拍照/選圖 → AI 辨識 → 預覽確認 → 建立聯絡人，`source: 'ocr'`），接在聯絡人列表 header 新的相機圖示。已在真實瀏覽器端到端測過：用 Canvas 產生一張假名片圖片，AI 100% 正確辨識姓名/職稱/公司/電話/Email，確認後正確建立聯絡人 |
| §5.3a | AI 語音/文字快速記錄 | Codex 在 `codex/ai-quick-log-and-proactive-reminders` 完成後端 + 前端雛型，但該分支落後 main 太多（拆分導覽/i18n 之前的舊結構），**已手動整合**：後端 `functions/src/index.ts` 的 `parseQuickCapturePreview` action 原封不動採用；前端把 `QuickCaptureDialog`/`ContactInteractionsDialog` 多聯絡人綁定邏輯搬到現在的檔案結構上，補回 i18n（Codex 版本沒有），修正 `<Stack direction="row">` 型別地雷（見 CLAUDE.md §7），服務層與建議話題共用同一個 `geminiService.ts`。**已在真實瀏覽器端到端測過**：文字輸入「今天跟王小明喝咖啡...兩週後提醒我」→ AI 正確比對既有聯絡人、產生互動摘要、推算提醒日期（+14 天）→ 確認寫入後 Interaction 與 `Contact.nextContactReminder` 都正確落地 |
| §5.6 | AI 主動提醒（生日/久未聯絡） | 後端 `generateProactiveSuggestionsDaily` 排程函式（每日 9:00 Asia/Taipei）已部署；規則邏輯（生日前 3 天、無互動 60 天、去重不重複提醒已標記完成的建議）已 code review 確認符合 spec。前端 `AISuggestionsPanel` 已接進首頁。**已用真實資料端到端驗證通過**：裝了 gcloud CLI 後改用更直接的方式——暫時在 `geminiProxy` 加一個除錯用 action，直接呼叫排程函式背後同一套 `buildRuleBasedSuggestions`/`persistSuggestions`（不是重寫邏輯），部署後對測試帳號觸發一次，成功產生一筆 `manual_reminder_due` 建議並正確寫入 Firestore；首頁「今天需要處理」卡片正確顯示，點「採納」後正確建立 Interaction（`已採納 AI 建議：...`）且清空原本的 `nextContactReminder`。驗證完已移除除錯 action 並重新部署乾淨版本 |
| §11.4 | 列表久未聯絡色彩警示 | Avatar 右下角紅點 Badge，門檻與 §5.6 共用同一組「無互動 60 天」常數；已在真實瀏覽器測過：把互動改到 60 天前確認 Badge 出現，刪除後確認消失 |
| §5.5a | AI 問答秘書（聊天） | 三個 agent 平行在獨立 git worktree 開發完成（`planContactQuery`「先查詢」+ `answerContactQuestion`「後生成」二階段設計），新增 `src/domain/assistantChat.ts`、`AssistantChatScreen.tsx`，接進導覽（`/assistant` 路由）。**已在真實瀏覽器測過**：問「我認識哪些在 Google 工作的人？」正確回答並附上聯絡人引用晶片 |
| §5.7 | 文件通訊錄批次匯入 | 新增 `parseContactDocument` action（`functions/package.json` 加 `pdf-parse`/`mammoth`/`xlsx`），新增 `src/domain/documentImport.ts`、`DocumentImportDialog.tsx`。開發時已手刻 CSV/XLSX/DOCX/PDF 四種測試檔案追蹤解析邏輯確認正確。**已在真實瀏覽器端到端測過**：上傳一份含 2 筆聯絡人的 CSV，AI 100% 正確解析姓名/職稱/公司/電話/Email，預覽確認後正確批次寫入 Firestore |
| §5.8 | 網路身分研究摘要（僅文字子功能） | 新增 `researchContactProfile` action，使用 Gemini `googleSearchRetrieval` grounding 工具（已對照實際安裝的 SDK 型別定義確認正確語法，非猜測）；新增 `Contact.researchLog`、`ContactResearchDialog.tsx`。**照片搜尋子功能明確不做**（需要額外圖片搜尋 API 憑證）。**實測卡在 Gemini API 429 Too Many Requests**（`googleSearchRetrieval` grounding 工具疑似有獨立於一般文字生成的配額限制，這個 session 已經打了很多次一般 API 但這是第一次用到 grounding 工具就被擋）；錯誤處理本身正確運作（優雅顯示錯誤訊息，未 crash），但**尚未看過成功產生摘要的真實案例**，需要之後確認 Google Cloud Console 的 billing/quota 設定或换個時間點重試 |
| §11.5 | 聯絡人詳情 Material Tabs 頁 | 新增 `ContactDetailScreen.tsx`（路由 `/contacts/:contactId`），以「基本資料／互動紀錄／網路研究摘要」三個 Tab 取代原本全部塞在 Dialog 的做法；三個既有 Dialog（`EditContactDialog`/`ContactInteractionsDialog`/`ContactResearchDialog`）的內容抽成可重用的 Panel 元件（`ContactBasicInfoPanel`/`ContactInteractionsPanel`/`ContactResearchPanel`），Dialog 改為薄包裝，維持列表頁原本的快速存取圖示按鈕不變。各 Tab 內容只在啟用時掛載（lazy load）。列表頁點擊聯絡人姓名/頭像區域會導到新的詳情頁（獨立於原本的圖示按鈕，不互相干擾）。**已在真實瀏覽器端到端測過**：從列表點進王小明的詳情頁，三個 Tab 都能正確切換渲染；在「基本資料」修改後按儲存，確認 Firestore 寫入完成後正確跳出「已儲存」提示；返回按鈕正確回到列表頁，列表頁原本的圖示按鈕互動不受影響 |
| §11.6 | AI 卡片 Assist Chip 統一 | 把 `AISuggestionsPanel.tsx`（首頁「今天需要處理」）的採納/修改/忽略三個一般 `Button` 改成帶圖示的 `Chip`（MUI Assist Chip 樣式：可點擊、圓角、小尺寸）。**範圍刻意限定在這個元件**：只有這裡是真正的「三選一操作列」語意，符合 spec §11.6 字面定義；`SuggestedTopicsDialog`（純唯讀建議、無操作列）、`QuickCaptureDialog`（Checkbox 是合法的多選語意，換成 Chip 反而是體驗倒退）、`AssistantChatScreen`（既有的引用 Chip 是資訊展示不是操作）都刻意不動，避免為了湊字面規格硬造假操作。**已在真實瀏覽器驗證**：暫時注入一筆假建議資料觸發面板渲染，確認三個 Chip（採納/修改/忽略）樣式正確且點擊互動正常（點「修改」正確跳出調整對話框），驗證完已還原注入程式碼，並重新跑過 type-check + build 確認乾淨 |
| 使用者需求 | 標籤複選 + 隨時新增 | 標籤原本就支援複選（`Contact.tags: string[]`）與隨時管理（`TagsManagerDialog`），但只有編輯聯絡人時能選標籤，新增聯絡人當下無法選。新增共用元件 `TagMultiSelect.tsx`（複選 Chip + 內嵌「+ 新增標籤」輸入框，建立後即時可選，因為 `useTagsStore` 本來就是 Firestore `onSnapshot` 即時訂閱），接進 `ContactBasicInfoPanel`（取代原本重複的 Chip 邏輯）與 `ContactsListScreen` 的「新增聯絡人」快速對話框。**已在真實瀏覽器端到端測過**：在編輯表單用內嵌輸入框新建一個「好朋友」標籤，立即出現在選項中可勾選、存檔成功；在新增聯絡人對話框勾選既有的「VIP」標籤，新增後用標籤篩選確認該聯絡人正確被分類 |
| 使用者需求 | 聯絡人資料庫 Excel 匯出 | 新增前端 `xlsx`（SheetJS，與 `functions/` 既有版本 `^0.18.5` 一致）依賴；新增 `src/domain/contactExport.ts`（純資料轉換：聯絡人/互動紀錄轉表格列，標籤 id 轉可讀名稱，欄位標題沿用既有 i18n key 避免重複翻譯維護）、`src/platform/exportContacts.ts`（用 SheetJS 產生兩個工作表「聯絡人」「互動紀錄」並觸發瀏覽器下載）。接在設定頁新增「資料匯出」區塊。**已驗證**：真實瀏覽器點擊下載按鈕無任何 console 錯誤（含有一筆真實互動紀錄的情況下也正常）；另外直接呼叫 domain 層轉換函式餵入樣本資料，確認輸出欄位順序與內容正確（標籤 id 正確轉換成「好朋友」等可讀名稱） |
| 使用者需求 | 首頁近況摘要 | 新增三個唯讀首頁面板（放在既有 AI 建議/手動提醒之後）：`UpcomingBirthdaysPanel`（未來 14 天內生日，與 §5.6 AI 建議的「生日前 3 天」主動提醒是分開的兩個功能）、`RecentContactsPanel`（依 `createdAt` 新到舊取前 5 筆，點擊可導到 §11.5 聯絡人詳情頁）、`RecentInteractionsPanel`（依日期新到舊取前 5 筆互動）。三者皆為「沒有資料就不顯示」，不會在空清單時佔版面。**已在真實瀏覽器端到端測過**：新增聯絡人後首頁正確顯示在「最近新增的聯絡人」最上方，點擊頭像正確導到詳情頁；新增一筆互動後「最近的互動紀錄」正確顯示聯絡人晶片/類型/日期/描述 |
| Corner case | 6 項資料完整性/同名聯絡人 corner case 修復 | 使用者主動要求檢視「同名聯絡人怎麼處理」等 corner case，先用 agent 稽核現況再逐項修復：(1) **生日 2/29 在非閏年算錯**——前端 `upcomingBirthdays()` 與後端 `normalizeBirthdayForYear()` 原本用 `Date.UTC`/字串拼接處理 2/29，非閏年會溢位變 3/1（前端）或永遠比對不到而完全不觸發提醒（後端），兩邊都改成非閏年時算在 2/28。(2) **刪除標籤留下孤兒 id**——`tagsRepository.deleteTag()` 改用 `writeBatch`，刪標籤的同時把該 id 從所有引用它的聯絡人 `tags` 陣列移除。(3) **刪除聯絡人留下孤兒 AI 建議**——`contactsRepository.deleteContact()` 改用 `writeBatch` 一併刪除該聯絡人的 `AgentSuggestion`；**互動紀錄刻意不動**，因為刪除確認對話框明確承諾「互動紀錄不會自動刪除」，改成會刪互動紀錄等於破壞既有承諾，故只在顯示層（`RecentInteractionsPanel`、Excel 匯出）把查無聯絡人的情況從「顯示原始 Firestore id」改成「已刪除的聯絡人」。(4) **新增聯絡人無同名警示**——新增 `findContactsByName()`，接進「新增聯絡人」快速對話框與名片 OCR 確認畫面，同名時顯示不擋的警示（比照既有 vCard/文件匯入的處理精神）。(5) **互動紀錄綁定下拉同名分不清**——`ContactInteractionsPanel` 的 Autocomplete 加 `renderOption`，下拉選單多顯示公司名。(6) **AI 快速記錄同名比對難以覆核**——`QuickCaptureDialog` 確認畫面的比對結果 Chip 也加上公司名。**已在真實瀏覽器逐項驗證**：新增同名聯絡人跳出警示、刪除標籤後聯絡人身上的標籤即時消失、刪除聯絡人後其互動紀錄仍保留但顯示「已刪除的聯絡人」、互動紀錄下拉選單正確顯示公司名輔助辨識；另外直接呼叫 domain/後端函式驗證 2/29 生日在非閏年/閏年都算出正確日期。Cloud Functions 已重新部署（僅更新 `geminiProxy`/`generateProactiveSuggestionsDaily` 兩個既有函式，部署前已核對正式環境函式清單與本地一致，無誤刪風險）。 |

---

## ⏳ 待完成

| 章節 | 功能 | 依賴/備註 |
|---|---|---|
| §5.8 | 網路研究摘要實際成功案例 | `googleSearchRetrieval` grounding 呼叫目前被 Gemini API 擋 429，需確認 Google Cloud Console billing/quota 設定是否需要額外開通，或换時間重試 |
| §5.8 | 照片搜尋子功能 | 需要額外圖片搜尋 API/憑證（例如 Google Custom Search JSON API + CSE ID），本專案目前未設定，明確排除於本輪開發範圍 |
| §5.9 | Google 聯絡人 API 匯入 | 需要額外 OAuth scope（People API），vCard 部分已完成 |
| §8.4 | Stripe 訂閱整合 | 完全沒開始 |
| §3 | AI 額度真正執行（增量/擋額度） | 前端唯讀顯示已完成，**寫入/增量是 Cloud Function 工作**，見下方 Codex 協調事項（periodId 格式） |

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
