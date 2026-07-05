# /src/services

外部服務整合層：AI（Gemini，經 Cloud Function 代理）、支付（Stripe）。

對照 [spec.md §5.5、§8.4、§8.5](../../spec.md)：

- `geminiProxy` 呼叫封裝（名片 OCR、語音快速記錄、問答秘書、話題建議、批次匯入解析、網路研究）
- Stripe Checkout / Customer Portal 呼叫封裝

## 規則（見 [CLAUDE.md](../../CLAUDE.md) §1、§3）

- 前端不可直接持有 AI API Key；這一層只呼叫 Cloud Function 端點，金鑰只存在於後端
- 每個 AI 功能對應一個明確命名的函式（例如 `parseBusinessCard(image)`、`quickCapture(input)`），不要用一個萬用函式硬塞所有情境
- 型別一律使用 `/domain` 定義的介面

> 注意：repo 根目錄現有舊版 `services/` 資料夾（Gemini 呼叫等）為舊版程式碼，**不是**這一層的基礎，v1 重寫不沿用其實作。
