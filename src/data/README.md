# /src/data

Firebase 存取層。負責封裝 Firestore / Auth / Storage 的所有讀寫操作，以 repository 模式對外提供函式（例如 `contactsRepository.list()`、`contactsRepository.create()`）。

對照 [spec.md §7](../../spec.md) 的 Firestore 路徑規劃：

```
users/{uid}                          — UserProfile
users/{uid}/usage/{periodId}         — UsageQuota
users/{uid}/contacts/{contactId}     — Contact
users/{uid}/interactions/{interactionId} — Interaction
users/{uid}/tags/{tagId}             — Tag
users/{uid}/logs/{logId}             — LogEntry
users/{uid}/suggestions/{suggestionId} — AgentSuggestion
```

## 規則（見 [CLAUDE.md](../../CLAUDE.md) §1）

- 是專案中唯一允許直接呼叫 Firestore/Auth/Storage SDK 的地方
- 對外只暴露 repository 函式，不暴露 Firestore 的 `DocumentReference`/`Query` 等實作細節，讓 `/ui` 層不需要知道底層是 Firestore
- 型別一律使用 `/domain` 定義的介面，不在這一層重新定義資料結構
- 離線同步（offline persistence）的初始化與設定集中在這一層
