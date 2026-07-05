# Linka — 產品規格書 (Spec v1)

> 狀態：Draft / 討論中
> 最後更新：2026-07-05
> 本文件為 Linka 重寫（v1 Web）的開發依據。舊版程式碼庫分析結論請見文末附錄。

---

## 1. 產品願景

Linka 是一款個人人脈管理（Personal CRM）應用程式，協助使用者記錄、追蹤、經營自己的人脈網絡，並透過 AI 功能降低維護人脈的心力成本（名片辨識、聊天式人脈顧問、破冰話題建議）。

- **目前階段**：從個人使用的工具，逐步發展為對外開放、可能收費的產品。
- **長期目標**：Web + iOS + Android 三平台皆可用，帳號資料跨裝置同步。

---

## 2. 目標使用者

| 階段 | 使用者 | 說明 |
|---|---|---|
| v1 | 開發者本人 | 驗證規格與資料模型 |
| v1.x | 一般個人使用者 | 業務、創投、社群經營者、需要維護大量人脈的專業人士 |
| 未來 | 付費訂閱使用者 | 使用 AI 加值功能的重度使用者 |

- **不做**：多人協作／團隊共用聯絡人資料庫。每個帳號的資料完全獨立（single-tenant per account）。

---

## 3. 商業模式

**Freemium，單一限制（v1 定案）：**

| | 免費版 | 付費版 |
|---|---|---|
| 聯絡人數量 | **無上限** | 無上限 |
| AI 功能使用次數 | **每月 1000 次**（合併計算，見下方規則） | 無上限或大幅提高額度 |
| 基本 CRUD、標籤、互動紀錄 | 完整可用 | 完整可用 |

- **v1 免費版不限制聯絡人數量**，免費/付費版聯絡人數量相同；差異化完全落在 AI 功能額度上。
- **AI 使用次數計算規則（v1 定案）**：所有 AI 功能（名片 OCR、5.3a 語音快速記錄、問答秘書、話題建議、主動提醒生成內容、文件批次匯入、網路身分研究）**合併計算同一份配額**，不分功能種類。只要使用者觸發一次會呼叫 AI API 的操作，就計為 1 次，不論該次操作內部實際呼叫 Gemini 一次或多次。
- 付費解鎖的重點是 **AI 功能額度**（免費版每月 1000 次，付費版無上限或大幅提高），這是主要付費誘因。
- 支付整合：**Stripe**（Web 版優先，訂閱制）。手機版上線後需另外整合 App Store / Google Play 內購（IAP），届時需處理跨平台訂閱狀態同步問題（v1 不實作，僅需在資料模型中預留 `plan` / `subscriptionSource` 欄位）。
- 額度數字（1000 次/月）為 v1 上線定案值，但架構上仍保留調整彈性（`UsageQuota.aiCallsLimit`），未來可依實際 Gemini API 成本數據調整，不寫死在程式碼裡。
- 聯絡人數量方面，架構上仍保留 `UsageQuota.contactsLimit` 欄位（見第 7 節），供未來若需重新導入聯絡人數量限制時使用，但 v1 不啟用此限制（視為無上限）。

---

## 4. 平台策略

**順序：Web 重寫優先上線 → 之後開發 iOS / Android。**

即便 v1 只做 Web，架構設計必須為未來的 React Native（或原生）版本鋪路，避免重蹈舊版覆轍（UI 邏輯與業務邏輯高度耦合、大量瀏覽器專屬 API）。具體要求：

- **業務邏輯與 UI 分離**：資料驗證、資料轉換、API 呼叫必須抽離成獨立、不依賴 DOM/瀏覽器 API 的模組（純 TypeScript function/class），未來可直接被 React Native 專案 import。
- **避免瀏覽器專屬 API 直接寫死在共用邏輯裡**：例如 `window.alert`、`document.createElement('canvas')`、`FileReader` 等，需要包裝成平台介面（platform adapter），Web 用瀏覽器實作，未來 RN 用原生實作替換。
- **狀態管理與資料層獨立於路由/畫面框架**：不要讓 Firestore 監聽邏輯直接寫在畫面元件的 `useEffect` 裡並散落各處，應集中在 data layer。
- **視覺風格**：v1 定案採用 **Google Material Design 3** 作為統一設計系統（見 §11），顏色、間距、字級等 token 由 Material 3 theme 定義並集中管理；Web 端採 MUI 實作，未來手機版對照採用 `react-native-paper`（Material Design 3 的 RN 實作），兩者共用同一份 seed color / token 設定，確保三平台視覺一致。

---

## 5. 功能規格（v1 Web）

### 5.1 帳號與登入
- Email/密碼註冊、登入（Firebase Auth）
- Google OAuth 登入
- 登出
- （待定，非 v1 必要）忘記密碼 / 重設密碼流程 — **需補上**，舊版未見此功能，屬於基本可用性缺口，建議列入 v1。

### 5.2 聯絡人管理
- 聯絡人 CRUD：姓名、職稱、公司、電話、Email、生日、LinkedIn/Facebook/Twitter 連結、備註
- 照片：最多 5 張，**改為上傳至 Firebase Storage**（修正舊版 base64 存 Firestore 的問題），前端仍可做本地壓縮（尺寸/畫質）以加速上傳
- 標籤／社交圈分類：預設分類（廠商、客戶、家人、VIP）+ 使用者自訂
- **親密度／重要性星級**（v1 新增，舊版未實作）：每位聯絡人可標記 **1～5 顆星**，代表使用者主觀認定的親密關係或重要程度（1 星最低、5 星最高）
  - 新增聯絡人時預設星級（暫定 3 星，可調整），使用者可隨時修改
  - 列表可依星級排序／篩選（例如只看 5 星聯絡人）
  - **v1 定案**：星級與 5.6 AI 主動提醒門檻**不連動**，所有聯絡人共用同一組固定門檻（生日前 3 天、無互動 60 天）；星級與提醒門檻的連動規則（例如高星級門檻更短）留待 v1.x 增強項目
  - 星級亦可作為 5.5a AI 問答模式回答時的排序依據之一（例如「我最重要的朋友有誰最近沒聯絡」）
- 列表：依姓名字母分組、依社交圈篩選、依星級排序、關鍵字搜尋（姓名/公司/職稱）
- 免費版聯絡人數量無上限（v1 定案，見第 3 節商業模式），故不需要「達上限提示升級」的攔截邏輯；升級誘因完全來自 AI 功能額度

### 5.3 互動紀錄
- 記錄每次與聯絡人的互動：會議、通話、Email，含日期與描述
- 依時間排序顯示於聯絡人詳情頁
- **快速記錄入口（v1 新增，修正舊版摩擦點）**：首頁/儀表板提供全域「快速記錄」按鍵，不需先進入聯絡人詳情頁即可開始記錄，降低「找到聯絡人才能記錄」的操作成本
- **一筆互動可綁定多位聯絡人（v1 修正）**：因應多人會議情境，互動紀錄改為獨立集合並以 `contactIds: string[]` 綁定，不再侵入式掛在單一聯絡人物件下（詳見第 7 節資料模型變更）
- 表單簡化：移除獨立「標題」欄位，僅保留描述與日期；日期預設為今天，減少非必要點擊

### 5.3a AI 語音／自然語言快速記錄（v1 新增，AI 推理萃取）
- 使用者於「快速記錄」入口以語音或自由文字輸入一段話（例如：「剛跟 Google 的 John 開完會，聊了明年的合作方案，他說要等季度預算下來，大概兩週後回覆我」），不需先手動選擇聯絡人或填表單欄位
- AI（Gemini）需進行的推理，而非單純轉錄：
  1. **實體辨識與比對**：從描述中辨識人名/公司關鍵字，比對現有聯絡人清單；找不到相符對象時標記為「疑似新聯絡人」，交由使用者確認
  2. **多人拆解**：若一段話提及多位聯絡人，拆解為對應多筆互動紀錄（各自綁定或共用 `contactIds`）
  3. **行動萃取**：從口語化的時間描述（如「兩週後」）推理出具體日期，**建議**寫入該聯絡人的 `Contact.nextContactReminder`（沿用 §5.4 既有欄位，不新增資料結構）
  4. **重要性訊號建議**：視內容判斷是否建議調整聯絡人星級（例如：「這次會面看起來很重要，是否要把 John 調整為 4 星？」），僅為建議、需使用者主動確認，不自動覆蓋 `Contact.importance`
  5. **摘要回寫**：產生精簡的 `description`，取代使用者自己組織文字
- **必須有確認步驟**：比照 §5.7 文件批次匯入的原則，AI 解析結果需先呈現預覽（辨識出的聯絡人、日期建議、星級建議、摘要文字），使用者確認或修改後才正式寫入，不可靜默寫入，避免辨識錯誤（例如比對錯聯絡人）污染資料
- 計入 AI 使用次數配額（比照 §5.5 其他生成式功能），不論語音或文字輸入皆計 1 次，無額外費用歸類問題
- **語音輸入技術路徑（v1 定案）**：前端錄音後將音訊檔直接傳給 Cloud Function，由支援多模態音訊輸入的 Gemini 模型一次完成「轉錄＋推理萃取」，不另外整合裝置端語音轉文字服務（如 Web Speech API）。理由：避免 Safari/iOS 對 Web Speech API 支援不穩定的相容性問題，且省去獨立語音轉文字服務的整合與成本歸類複雜度，架構更單純
- 技術實作沿用 §8.5 既有的結構化 JSON 輸出 Cloud Function 模式（與 §5.7 批次匯入的「抽取多筆聯絡人 JSON」設計相近）

### 5.4 提醒／待辦（v1 新增，舊版未實作）
- 依「多久沒聯絡」或使用者手動設定的日期，提醒該聯絡誰
- 至少需要：可設定下次聯絡提醒日期、首頁/儀表板顯示待處理提醒清單
- 通知機制：v1 Web 版先用站內提示（App 內清單/badge），Push Notification 留待手機版
- 此為使用者「手動設定」的簡單提醒；AI 主動偵測並建議的進階版本見 5.6

### 5.5 AI 功能（付費差異化功能）
1. **名片 OCR**：拍照/上傳名片圖片 → Gemini 解析出姓名、職稱、公司、電話、Email，自動帶入新增聯絡人表單
2. **語音／自然語言快速記錄**（v1 新增，見 5.3a）：捕捉當下的一段話，AI 推理拆解為聯絡人、互動摘要、提醒日期、重要性建議
3. **AI 個人秘書（問答模式）**：見 5.5a，使用者可用自然語言詢問「整個人脈資料庫」的任何問題（何時見過誰、聊過什麼、建議下次話題等）
4. **建議話題**：針對特定聯絡人，AI 根據職稱、公司、過往互動與備註，產生 3 個破冰/延續話題建議
5. **AI 個人秘書（主動提醒模式）**：見 5.6，AI 主動掃描資料庫並建議社交行動（例如生日提醒）
6. **文件通訊錄批次匯入解析**（v1 新增，見 5.7）：解析 PDF/Word/Excel 文件並抽取多筆聯絡人
7. **網路身分研究摘要**（v1 新增，見 5.8）：針對單一聯絡人搜尋並摘要其網路公開資訊
8. 上述功能皆計入同一份每月 AI 使用次數配額（v1 定案：合併計算，不分功能種類；每次觸發即計 1 次，例如批次匯入以「每份文件」計 1 次，而非每筆聯絡人計 1 次）；達上限時提示升級付費版
9. 保留現有架構：前端不可直接持有 AI API Key，一律透過 Cloud Function 代理呼叫

#### 5.5a AI 個人秘書 — 問答模式（取代舊版「AI 人脈顧問聊天」，範圍擴大）
- 使用者以自然語言在聊天介面提問，AI 秘書需能回答涉及**整個人脈資料庫**的問題，例如：
  - 「我上次跟王小明見面是什麼時候？聊了什麼？」→ 需查詢該聯絡人綁定的 `Interaction`（`contactIds` 包含該聯絡人）與 `notes`
  - 「我認識哪些在 Google 工作的人？」→ 需查詢所有聯絡人的 `company` 欄位
  - 「下次跟她見面該聊什麼？」→ 結合該聯絡人的職稱/公司/過往互動/研究摘要，等同於呼叫 5.5 項目 3「建議話題」的邏輯
- **檢索策略（重要的技術決策）**：由於 v1 聯絡人數量無上限（見第 3 節），使用者可能累積上百甚至上千筆聯絡人，不可能把所有聯絡人完整資料無限制塞進每次 AI 呼叫的 prompt（成本與 context 長度都不划算）。v1 採用「先查詢、後生成」兩階段設計：
  1. 依使用者問題判斷需要查哪些聯絡人（可用簡單的關鍵字/欄位比對，或讓 Gemini 先判斷出查詢意圖與可能相關的聯絡人姓名/公司關鍵字）
  2. 用該線索對 Firestore 做範圍查詢，撈出相關聯絡人（含 interactions、notes、researchLog）子集
  3. 把這個子集連同問題一起交給 Gemini 生成最終回答
  - 未來若資料量更大，可考慮導入向量搜尋（如 Vertex AI Vector Search）做語意檢索，v1 先以欄位查詢為主，列入待確認事項
- 回答須註明資訊來源於哪位聯絡人／哪筆互動紀錄，避免使用者無法追溯答案依據
- 計入 AI 使用次數配額（比照現有聊天功能）

### 5.6 AI 個人秘書 — 主動提醒模式（v1 新增，舊版未實作）
- AI 秘書除了被動回答問題，也要能**主動**掃描使用者的人脈資料庫，找出值得採取社交行動的時機，並提出具體建議，例如：
  - 聯絡人生日前 **3 天**（v1 定案）→ 建議「跟 OOO 說聲生日快樂」，並可附上 AI 草擬的生日祝福文字草稿
  - 聯絡人已經超過 **60 天**沒有互動紀錄（v1 定案）→ 建議「該找 OOO 聯絡一下了」；v1 所有聯絡人共用同一門檻，不因星級（§5.2 重要性星級）而異，星級與門檻連動邏輯列為 v1.x 增強項目
  - `Contact.nextContactReminder` 到期 → 依 5.4 現有邏輯提醒，但由 AI 秘書統一呈現、並可補上建議話題
- **技術實作**：由每日排程的 Cloud Function（Firebase Scheduled Functions / Cloud Scheduler）掃描每位使用者的聯絡人資料，比對觸發規則，產生「建議」寫入資料庫（`AgentSuggestion`，見第 7 節資料模型），而非即時運算，避免每次開 App 都重新呼叫 AI
- **呈現方式**：App 首頁/儀表板顯示「AI 秘書建議」清單（類似待辦通知），使用者可以：
  - 採納（例如點擊後直接開啟該聯絡人詳情頁，或複製 AI 草擬的訊息文字）
  - 忽略／延後
  - 標記完成（會同步記錄一筆 `Interaction`，避免重複提醒）
- v1 通知僅限站內呈現；Push Notification（例如生日當天推播到手機）留待行動版上線後實作，但資料模型與觸發邏輯現在就要設計成未來可直接串接推播
- 計入 AI 使用次數配額（僅在「生成建議內容」如生日祝福草稿文字時計算；純粹規則比對，例如「今天是誰生日」，不需要呼叫 AI，不計配額）

### 5.7 文件通訊錄批次匯入（v1 新增，舊版未實作）
- 使用者可上傳一份「通訊錄」文件，格式支援 **PDF、Word (.docx)、Excel (.xlsx/.csv)**
- 系統需自動解析文件內容，辨識出其中列出的**多筆聯絡人**（可能是表格形式，也可能是非結構化的條列文字），並抽取姓名、職稱、公司、電話、Email 等欄位
- 解析流程：
  1. 前端上傳文件 → Cloud Function
  2. Cloud Function 依副檔名解析文字內容（PDF/Word 抽取純文字，Excel 直接讀取表格列）
  3. 將抽取出的文字/表格內容交給 Gemini，要求輸出「聯絡人陣列」的結構化 JSON（類似現有名片 OCR 的做法，但一次回傳多筆而非一筆）
  4. 回傳給前端，顯示「預覽清單」讓使用者確認/勾選/修改後，才批次寫入 Firestore
- **必須有預覽確認步驟**，不可解析完直接靜默寫入，避免辨識錯誤污染資料庫
- 重複資料處理：比照 5.9 的匯入邏輯，依姓名+電話/Email 判斷是否已存在，提示合併或新建
- 檔案大小/筆數上限需訂定（例如單檔 <= 10MB，避免超大檔案解析逾時或費用暴增），對應限制值列入待確認事項
- 免費版聯絡人數量無上限（見第 3 節），故批次匯入不需檢查「匯入後是否超過聯絡人上限」；此功能仍計入 AI 使用次數配額，一次匯入（一次 Gemini 呼叫）計 1 次，與其他 AI 功能合併計算同一份配額

### 5.8 聯絡人網路身分研究摘要（v1 新增，舊版未實作／舊版曾有雛型但未完成）
- 每位聯絡人詳情頁提供一個按鍵（例如「搜尋網路資料」），觸發後：
  1. Cloud Function 使用 Gemini + Google Search 工具，以聯絡人的姓名、公司、職稱等已知資訊為關鍵字搜尋
  2. 將搜尋結果彙整、摘要成一篇簡短文章（含來源連結），回傳前端
  3. **同時搜尋該聯絡人的網路照片，最多找 3 張**（見下方「照片搜尋」）
  4. 使用者確認後，將這篇摘要**加入**（而非覆蓋）該聯絡人的「研究紀錄」清單；使用者勾選要採用的照片後，才寫入聯絡人的照片清單
- **持續累積**：每次觸發都會新增一筆帶時間戳記的研究紀錄，使用者可看到該聯絡人隨時間累積的所有網路研究摘要（例如換工作、發表新聞等變化都保留歷史軌跡），而不是只保留最新一筆
- 資料結構：`Contact.researchLog: ResearchEntry[]`，見第 7 節資料模型
- 計入 AI 使用次數配額（每次觸發計 1 次，文字摘要與照片搜尋算同一次觸發，不重複扣配額）
- 需考慮：Gemini 若搜尋不到足夠公開資訊時，應明確告知使用者「查無相關資料」，而非產生幻覺內容；Prompt 設計需要求 AI 附上參考來源網址，供使用者自行查證

**照片搜尋（子功能）**：
- 搜尋結果最多回傳 **3 張候選照片**（縮圖 + 來源網址），呈現給使用者逐一勾選/取消
- **必須經使用者確認**才會正式加入聯絡人照片清單，不可自動寫入 —— 與現有「最多 5 張照片」上限共用同一個欄位（`Contact.photos`），若確認加入後超過上限，需提示使用者先移除舊照片
- 使用者確認採用的照片，由 Cloud Function 下載後上傳至 Firebase Storage（`users/{uid}/contacts/{contactId}/photos/`），存下載 URL，而非直接存外部連結（外部圖片連結可能失效或有存取限制）
- 每張照片需保留來源網址（`sourceUrl`）與搜尋日期，供使用者日後查證來源，避免誤用他人肖像或不相關同名者的照片
- **風險提示（需在 UI 呈現）**：網路照片搜尋結果可能不是本人（例如同名同姓、或搜尋引擎誤判），務必請使用者自行核實後再確認採用；此為肖像權/隱私敏感功能，v1 需在功能說明加上明確免責聲明
- **v1 定案**：此子功能不限制付費版，免費／付費使用者皆可使用；但每次觸發皆須顯示上述免責聲明，使用者須確認已閱讀後才能繼續搜尋

### 5.9 聯絡人匯入（v1 新增，舊版未實作）
- 支援從 **Google 聯絡人** 匯入
- 支援從**手機通訊錄**匯入（Web 版可透過瀏覽器 Contact Picker API，若瀏覽器不支援則提供 vCard (.vcf) 檔案匯入作為 fallback）
- 匯入流程需處理重複資料（依姓名+電話/Email 判斷是否已存在，提示使用者確認合併或建立新聯絡人）

### 5.10 操作歷史紀錄
- 沿用舊版概念：記錄聯絡人新增/修改/刪除/互動等操作歷程，供使用者回顧

### 5.11 離線支援（v1 新增，舊版未實作）
- **Offline-first**：無網路時仍可瀏覽已同步過的聯絡人資料、新增/編輯聯絡人與互動紀錄
- 網路恢復後自動同步至 Firestore
- 技術作法：啟用 Firestore 的 offline persistence（IndexedDB），並在 UI 上明確標示「離線中／同步中／已同步」狀態
- 衝突處理：v1 採用「最後寫入者為準」（last-write-wins，Firestore 預設行為）即可，不需要複雜的 CRDT/合併機制
- 注意：5.5a AI 問答、5.6 AI 主動提醒（生成建議文字時）、5.7 文件批次匯入、5.8 網路研究摘要皆為需要網路連線的 AI 功能，離線時應停用並提示使用者；5.6 的規則比對（例如今天是誰生日）可在本地離線資料上運算，不受影響

### 5.12 多語言（v1 新增，舊版只有中文）
- **繁體中文 + 英文雙語**，使用 i18n 框架（例如 `i18next` / `react-i18next`）
- 所有畫面文字、AI 回應語言（AI 部分可視使用者介面語言決定 prompt 語言，或提供語言切換）需支援雙語
- 語言切換：使用者可於設定中手動切換，預設依瀏覽器語言自動偵測

---

## 6. 非功能需求

| 項目 | 要求 |
|---|---|
| 離線支援 | Offline-first（見 5.11） |
| 多語言 | 中/英雙語（見 5.12） |
| 效能 | 列表/搜尋在 1,000 筆聯絡人內需維持流暢（虛擬滾動或分頁載入） |
| 安全性 | AI API Key 不可暴露於前端；Firestore Security Rules 需明確限制使用者僅能存取自己的資料 |
| 隱私 | 聯絡人資料屬於使用者個人資料，不做任何跨帳號資料共享或分析用途外流 |
| 可擴充性 | 資料模型需預留 `plan`（方案）、`quota`（用量）欄位，為未來付費機制與多平台鋪路 |
| 相容性 | Web 版需支援桌面與行動瀏覽器（RWD），但體驗以手機版面優先設計（後續才是原生 App） |

---

## 7. 資料模型（v1）

延續舊版核心結構，並修正已知問題（照片改存 Storage、新增 plan/quota、新增 reminder）。

```typescript
// Users（Firebase Auth 內建 + 擴充 profile document）
interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  locale: 'zh-TW' | 'en';
  plan: 'free' | 'paid';                 // 訂閱方案
  subscriptionSource?: 'stripe' | 'ios_iap' | 'android_iap'; // 未來多平台訂閱來源
  subscriptionStatus?: 'active' | 'canceled' | 'past_due';
  createdAt: Timestamp;
}

// 用量配額追蹤（供 freemium 限制使用）
interface UsageQuota {
  uid: string;
  periodStart: Timestamp;   // 當月起算日
  aiCallsUsed: number;      // 所有 AI 功能合併計算的單一計數器（v1 定案，不分功能種類）
  aiCallsLimit: number;     // 依 plan 決定，v1 定案：free=1000（每月），paid=無上限或更高
  contactsCount: number;
  contactsLimit?: number;   // v1 不啟用（free/paid 皆無上限）；保留欄位供未來若重新導入聯絡人上限時使用
}

// 聯絡人
interface Contact {
  id: string;
  name: string;
  role?: string;
  company?: string;
  phone?: string;
  email?: string;
  birthday?: string;              // YYYY-MM-DD
  linkedin?: string;
  facebook?: string;
  twitter?: string;
  notes?: string;
  tags?: string[];                // 對應 Tag.id 或 name
  importance: 1 | 2 | 3 | 4 | 5;  // 親密度／重要性星級（新增，1=最低,5=最高，預設 3）
  photos?: ContactPhoto[];        // 改自舊版 base64 字串陣列；現為附來源追蹤的物件陣列（見下方 ContactPhoto）
  nextContactReminder?: string;   // ISO date，用於提醒功能（新增）
  source?: 'manual' | 'google_import' | 'vcard_import' | 'doc_import' | 'ocr'; // 追蹤資料來源（新增，doc_import=文件批次匯入）
  researchLog?: ResearchEntry[];  // 網路身分研究摘要歷史（新增，持續累加，不覆蓋）
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 互動紀錄（v1 修正：由巢狀於 Contact 的陣列改為獨立集合，支援單筆互動綁定多位聯絡人）
interface Interaction {
  id: string;
  contactIds: string[];           // 支援多聯絡人會議場景（新增）；單人互動仍為長度 1 的陣列
  type: 'meeting' | 'call' | 'email';
  description: string;            // 移除獨立 title 欄位，簡化輸入
  date: string;
  source: 'manual' | 'ai_quick_capture'; // 追蹤是否來自 5.3a 語音/自然語言快速記錄（新增）
  rawInput?: string;              // source = ai_quick_capture 時，保留原始輸入文字，供追溯 AI 判斷依據
  createdAt: Timestamp;
}

// 網路身分研究摘要（新增）
interface ResearchEntry {
  id: string;
  summary: string;                  // AI 產生的摘要文章內容
  sourceUrls: string[];             // 摘要所引用的來源網址
  candidatePhotos?: PhotoCandidate[]; // 本次搜尋找到的候選照片（未確認前暫存，確認後移入 Contact.photos）
  createdAt: Timestamp;             // 用於呈現時間軸，累加不覆蓋
}

// 網路搜尋到的候選照片（新增，僅暫存於單次 ResearchEntry，供使用者勾選確認）
interface PhotoCandidate {
  thumbnailUrl: string;   // 搜尋結果縮圖（外部連結，僅供預覽）
  sourceUrl: string;      // 照片來源網頁
  confirmed: boolean;     // 使用者是否已勾選採用
}

// 已正式加入聯絡人的照片，附加來源追蹤（取代原本單純的 string[]）
interface ContactPhoto {
  url: string;            // Firebase Storage 下載 URL
  source: 'upload' | 'web_search';  // 追蹤此照片是使用者上傳或網路搜尋而來
  sourceUrl?: string;     // 若為 web_search，記錄原始來源網址
  addedAt: Timestamp;
}

interface Tag {
  id: string;
  name: string;
  icon?: string;
  createdAt: Timestamp;
}

interface LogEntry {
  id: string;
  action: string;
  contactName: string;
  type: 'create' | 'update' | 'delete' | 'photo' | 'interaction';
  details: string;
  createdAt: Timestamp;
}

// AI 秘書主動建議（新增，見 5.6）
interface AgentSuggestion {
  id: string;
  contactId: string;
  type: 'birthday' | 'long_silence' | 'manual_reminder_due'; // 觸發原因，可擴充
  message: string;             // 呈現給使用者的建議文字（例如 AI 草擬的生日祝福）
  status: 'pending' | 'dismissed' | 'done';
  triggerDate: string;         // 這筆建議對應的日期（例如生日當天）
  createdAt: Timestamp;
}
```

Firestore 路徑規劃（延續 user-scoped 結構）：
```
users/{uid}                          — UserProfile
users/{uid}/usage/{periodId}         — UsageQuota（新增）
users/{uid}/contacts/{contactId}     — Contact
users/{uid}/interactions/{interactionId} — Interaction（v1 修正：改為獨立集合，支援 contactIds 多對多綁定）
users/{uid}/tags/{tagId}             — Tag
users/{uid}/logs/{logId}             — LogEntry
users/{uid}/suggestions/{suggestionId} — AgentSuggestion（新增）
```

Storage 路徑：
```
users/{uid}/contacts/{contactId}/photos/{photoId}.jpg
```

---

## 8. 技術架構

### 8.1 後端：沿用 Firebase
- **Firestore**：主要資料庫，內建 offline persistence 符合 offline-first 需求
- **Firebase Auth**：Email/密碼 + Google OAuth
- **Firebase Storage**：聯絡人照片
- **Cloud Functions**：AI 代理（`geminiProxy`，沿用並擴充）、訂閱 webhook（Stripe webhook 需一支新的 Cloud Function 處理訂閱事件並更新 `UserProfile.plan`）、**每日排程函式**（Firebase Scheduled Function，見 8.5，用於 5.6 AI 秘書主動提醒掃描）
- 選擇沿用 Firebase 的理由：現有投資可延用、Firestore 原生支援離線同步、React Native 有成熟官方 SDK，三平台開發風險最低

### 8.2 前端（Web v1）
- React + Vite + TypeScript（延續，版本更新至最新穩定版）
- **新增 React Router**：取代舊版手刻 Screen enum 路由，為未來程式碼可讀性與 deep link 打基礎
- **狀態管理定案採用 Zustand**（v1 定案，取代原先「Zustand 或 Context+useReducer 均可」的模糊選項，避免舊版 prop drilling）：Zustand 在 React Native 上為同一套 API，未來 RN 版可直接複用同一套 store 邏輯；並可搭配內建 `persist` middleware，供 §5.11 離線優先所需的本地狀態快取使用
- **i18next / react-i18next**：多語言
- **UI 元件庫改採 MUI（Material UI）**（v1 定案，見 §11）：實作 Material Design 3 元件與 theming，取代原先「Tailwind + 自建元件」的做法；Tailwind 停用或僅保留極少量版面 utility class，避免兩套樣式系統互相打架
- 圖片壓縮邏輯封裝為平台介面（Web 用 Canvas API 實作），供未來 RN 版替換原生實作

### 8.3 分層架構（為多平台鋪路的核心要求）
```
/domain          — 純 TypeScript，不依賴任何平台 API：型別定義、驗證邏輯、業務規則
/data            — Firebase 存取層（Firestore/Auth/Storage 的 repository 封裝）
/services        — AI 服務呼叫、支付服務呼叫等外部整合
/platform        — 平台介面與實作（圖片處理、檔案選取、通知等），Web 實作 vs 未來 RN 實作分開
/ui (Web)        — React 元件、畫面、路由（僅此層可以是 Web-only）
```
- 畫面元件（如舊版 738 行的 `ContactDetailScreen.tsx`）需拆分：UI 呈現 / 表單邏輯 / 資料存取三者分離
- `/domain`、`/data`、`/services` 三層目標是未來能直接被 React Native 專案原封不動 import 使用

### 8.4 支付整合
- Stripe Checkout / Customer Portal（Web 訂閱標準做法）
- Stripe Webhook → Cloud Function → 更新 `UserProfile.plan` 與 `UsageQuota.limit`
- 手機版上線後需另接 IAP，資料模型已預留 `subscriptionSource` 欄位因應

### 8.5 快速記錄與 AI 個人秘書 Agent 架構
- **語音／自然語言快速記錄（5.3a）**：與 §5.7 文件批次匯入共用「非結構化輸入 → Gemini 結構化 JSON 輸出 → 前端預覽確認 → 寫入 Firestore」的模式，差異在輸入來源為單段語音/文字而非文件。語音輸入直接以音訊檔傳給支援多模態音訊輸入的 Gemini 模型（v1 定案，見 5.3a），不另外整合裝置端語音轉文字服務。輸出結構為單筆或少數幾筆 `Interaction` + 對 `Contact.nextContactReminder` 與 `importance` 的建議（而非直接寫入，仍需使用者確認）
- **問答模式（5.5a）**：採「先查詢、後生成」二階段設計，避免把整個資料庫塞進單次 AI context。Cloud Function 內需要一個查詢規劃步驟（可用 Gemini function calling，讓模型決定要查哪些 Firestore 條件），查回相關聯絡人子集後再交給模型生成最終回答
- **主動提醒模式（5.6）**：由 Firebase Scheduled Function（Cloud Scheduler 觸發，建議每日執行一次）掃描所有使用者的聯絡人資料：
  1. 純規則比對（生日、`nextContactReminder` 到期、超過 N 天無互動）不消耗 AI 配額，直接產生 `AgentSuggestion`
  2. 若該建議需要「生成內容」（例如生日祝福文字草稿），才呼叫 Gemini，並計入該使用者的 AI 配額
  3. 排程函式需注意規模：使用者數量增加後，掃描邏輯需分批（batch）處理，避免單次執行逾時
- 三種模式（快速記錄／問答／主動提醒）共用同一組 AI 代理 Cloud Function 基礎設施（`geminiProxy` 擴充），但邏輯上分開的 handler/action

### 8.6 CI/CD 部署流程（v1 新增，修正舊版缺口）
- 舊版 CI/CD 僅涵蓋前端靜態檔部署，Cloud Functions 需手動部署，曾是延遲上線的原因之一（見附錄）
- **v1 定案**：GitHub Actions pipeline 需同時涵蓋前端與後端部署，包含：
  1. 前端建置與部署（延續舊版流程）
  2. **`firebase deploy --only functions`** 自動部署 Cloud Functions（新增，含 `geminiProxy`、Stripe webhook、每日排程函式等）
  3. 部署前檢查 Secret Manager 所需的環境變數/金鑰是否已設定，缺漏時 pipeline 應失敗並明確報錯，而非部署後才發現執行時錯誤
- 目標：避免重演舊版「Firebase Spark 方案不支援 Cloud Functions、Secret Manager API 未啟用」等部署卡關問題

---

## 9. v1 不做（Out of Scope）

- 多人協作／團隊共用聯絡人（明確排除）
- 手機版 App（iOS/Android）— 排在後續階段
- App Store / Play Store 內購整合
- 複雜的離線衝突合併機制（CRDT 等），先用 last-write-wins
- 資料遷移機制（舊版僅測試資料，無需遷移）
- 中英文以外的其他語言

---

## 10. 待確認事項（Open Questions）

1. 提醒功能的觸發規則（例如「超過 60 天沒互動」自動建議 vs 使用者手動設定日期，兩者如何在 UI 上並存呈現）細節待設計 UI 時確認。
2. Google 聯絡人 / vCard 匯入時的重複資料合併規則細節待設計時確認。
3. 文件通訊錄批次匯入的檔案大小/筆數上限（例如單檔 <= 10MB）具體數值待定案（AI 配額計算方式已定案：每份文件計 1 次，見第 3 節）。
4. 網路身分研究摘要功能，是否需要限制單一聯絡人的研究紀錄筆數上限（避免無限累積佔用資料庫空間），待設計時確認。
5. 照片搜尋免責聲明的具體法律文案（措辭）待法務確認；使用範圍已定案為全部使用者可用（見 5.8）。
6. 照片搜尋圖片來源的圖片授權/版權問題（例如新聞網站照片是否可自由下載重製存放於 Storage）需要進一步法務確認，v1 先以「僅供個人備忘用途、非公開發布」為前提，並在功能說明中提醒使用者。
7. AI 個人秘書問答模式的「查詢規劃」細節（如何從自然語言問題判斷要查哪些聯絡人）需要在技術設計階段（非規格階段）進一步驗證準確度，若查詢規劃不準確可能導致回答遺漏相關聯絡人，屬技術風險而非規格缺口。
8. 主動提醒的執行頻率與 Cloud Scheduler 成本（使用者數量增加後每日全量掃描的執行時間與費用）待上線前試算，若成本過高可能需改為分批/分時掃描。
9. 5.3a 的「重要性星級建議」呈現方式（例如快速記錄確認畫面內的一個核取選項，還是額外產生一筆待處理建議）待設計 UI 時確認，v1 原則上不自動覆寫 `Contact.importance`，僅呈現建議供使用者主動採納。
10. Interaction 改為獨立集合並支援 `contactIds` 多對多綁定後，Firestore Security Rules 與查詢方式（例如「取得某聯絡人的所有互動」需改為 `where('contactIds', 'array-contains', contactId)`）需在技術設計階段確認索引與效能影響。

---

## 11. UI/UX 設計原則

目標：Web、iOS、Android 三平台體感一致、簡潔美觀，並延續 §4 平台策略（業務邏輯與 UI 分離、design tokens 集中管理）的架構要求。

**設計系統（v1 定案）**：全面採用 **Google Material Design 3（Material You）** 作為所有元件的設計基礎，取代自建視覺語言。理由：
- Material 3 官方即提供完整的色彩系統（tonal color roles）、字級規範（type scale）、形狀與陰影（shape/elevation）token，比從零自建 design token 省設計與維護成本
- Web 端採用 **MUI（Material UI）**，未來 React Native 版採用 **`react-native-paper`**（Material Design 3 的官方推薦 RN 實作），兩者共用同一份 seed color 與 token 設定檔，元件行為與視覺高度一致，直接呼應 §4「未來 RN 可原封不動複用」的架構目標

> **已知取捨（決策已拍板，非待確認事項）**：iOS 並無官方 Material 元件庫，全面採用 Material 意味著 iOS 版體感會與多數遵循 Apple HIG 的 App Store 應用不同。本專案刻意選擇「跨平台一致性」優先於「各平台原生感」。

### 11.1 Design Token 全面採用 Material Design 3 Token 系統
- **色彩**：定義一個品牌 seed color，透過 Material 3 theming 引擎自動生成完整 tonal color roles（`primary` / `secondary` / `tertiary` / `surface` / `error` 等），不手動逐一設計色票
- **字級**：採用 Material 3 Type Scale（display / headline / title / body / label，各分 large/medium/small）
- **形狀與陰影**：採用 Material 3 shape scale（角半徑 token）與 elevation token
- Web 端透過 MUI 的 `ThemeProvider` 注入這份 token；未來 RN 版透過 `react-native-paper` 的 `PaperProvider` 注入同一份 seed color 設定，確保三平台色彩、字級、形狀語言一致

### 11.2 導覽：依螢幕寬度切換 Material 導覽元件
- 手機寬度：Material 的 **Navigation Bar**（底部導覽，3-5 個目的地）：首頁、聯絡人、快速記錄、AI 秘書問答、設定
- 平板/桌面寬度（RWD，§6 要求桌面/行動皆需支援）：切換為 Material 的 **Navigation Rail**（側邊窄導覽），避免桌面版硬套手機版底部導覽造成比例失調
- 快速記錄（§5.3a）使用 Material 的 **FAB（Floating Action Button）**，符合 Material 對「畫面主要動作」的標準呈現慣例，作為全 App 最低決策成本的操作入口

### 11.3 首頁：行動導向，而非靜態儀表板
- 首頁最上方以 Material **Card** 呈現「今天需要處理」的 AI 建議清單（§5.6 `AgentSuggestion`），每筆卡片搭配 Material **Button** 提供一鍵採納（不需先進入聯絡人詳情頁）
- 已逾期／未來才到期的提醒收於次要區塊，避免資訊過載，首頁只顯示今天要做的事

### 11.4 聯絡人列表：Material Card + 色彩角色作為狀態訊號
- 每筆聯絡人使用 Material 的 **Card**（elevated 或 filled variant）呈現：頭像 + 姓名 + 一行 meta（公司/職稱），不用傳統表格
- 星級（§5.2）以 Material icon（`star` / `star_outline`）呈現；超過無互動門檻（60 天，見 §5.6）的聯絡人以 Material 的 `error`/`tertiary` color role 標示（例如色點或 Badge），確保色彩語意與整體 theme 一致，讓使用者掃視列表即可判斷誰該聯絡
- 對應 §6 效能需求（1,000 筆內需流暢），列表項元件應保持輕量、避免逐筆渲染複雜子元件；採用虛擬滾動或分頁載入

### 11.5 聯絡人詳情頁：Material Tabs 取代長捲軸
- 改用 Material 的 **Tabs**（primary tabs）呈現「基本資料」「互動紀錄」「網路研究摘要（§5.8）」，各自 lazy load，取代舊版單頁長捲軸（舊版 `ContactDetailScreen.tsx` 738 行問題之一，見附錄）
- 呼應 §8.3 分層架構要求：畫面元件僅負責呈現與頁籤切換，資料存取與表單邏輯需拆到 `/data`、`/domain` 層

### 11.6 AI 輸出統一視覺語言（Material Card + Assist Chip）
- 快速記錄確認（§5.3a）、AI 主動建議（§5.6）、話題建議（§5.5 項目 4）、問答回覆（§5.5a）四類 AI 輸出，共用同一套「AI 卡片」樣式：以 Material **elevated Card** 為容器，搭配一個 Material icon（例如 `auto_awesome`）標示「此為 AI 生成內容」，操作列統一使用 Material 的 **Assist Chip**（採納 / 修改 / 忽略）
- 目的：使用者只需學習一次「AI 卡片如何操作」，即可套用到四個不同功能場景，降低認知負擔，強化「這是同一位 AI 秘書」的一致體感

### 11.7 離線與同步狀態：Material Badge + Snackbar
- §5.11 offline-first 的狀態回饋（離線中／同步中／已同步）以 Material 的 **Icon Button + Badge** 呈現三態，不使用彈窗或警示色 banner 打斷操作
- 同步完成的短暫提示改用 Material 的 **Snackbar**（自動消失、不打斷操作）
- 僅在使用者主動點擊圖示時才展開詳情說明，平時不搶注意力

### 11.8 落地優先順序（資源有限時的建議順序）
1. 導入 MUI（Web）與定義 Material 3 seed color / token 設定檔（§11.1）
2. §11.2 導覽骨架（Navigation Bar / Rail）
3. §11.6 AI 卡片元件一致性

這三項決定了 App 整體「是否一致、是否讓人信任 AI 建議」的第一印象，建議優先投入；其餘項目可在後續迭代逐步補上。

---

## 附錄：舊版程式碼庫分析摘要

（完整分析已於討論中提供，此處僅摘要作為背景參考）

- **舊技術棧**：React 19 + Vite 6 + TypeScript + Tailwind + Firebase（Firestore/Auth/Storage）+ Gemini 2.0 Flash（透過 Cloud Function 代理）
- **主要問題**：
  1. UI 與業務邏輯高度耦合（`ContactDetailScreen.tsx` 738 行，CRUD/驗證/AI 呼叫/照片壓縮全部混在一起）
  2. 大量瀏覽器專屬 API 直接寫死（`window.alert`、`Canvas`、`FileReader`），阻礙未來移植到 React Native
  3. 照片以 base64 直接存入 Firestore，而非上傳 Firebase Storage
  4. 無 React Router、無狀態管理庫，靠手刻 Screen enum + prop drilling
  5. 部署曾卡在 Firebase Spark 方案不支援 Cloud Functions、Secret Manager API 未啟用等問題（已解決，但 CI/CD 流程未包含 Functions 自動部署）
  6. README 與 IMPLEMENTATION_PLAN.md 內容落後於實際程式碼進度，不可作為現況依據
- **舊版已有但本規格書修正/延續的功能**：登入註冊、聯絡人 CRUD、標籤、互動紀錄、名片 OCR、AI 聊天、建議話題、操作歷史
- **舊版缺少、本規格書新增的功能**：提醒/待辦、聯絡人匯入、離線支援、多語言、忘記密碼流程
