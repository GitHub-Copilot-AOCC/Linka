import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as XLSX from "xlsx";

// 文件通訊錄批次匯入（見 spec.md §5.7）支援的文件類型提示。
type DocumentTypeHint = "pdf" | "docx" | "xlsx" | "csv";

/**
 * 依文件類型從 base64 內容抽取純文字/表格內容，供後續交給 Gemini 結構化解析。
 * PDF/Word 抽取純文字；Excel/CSV 直接讀取表格列並轉為簡易文字表格，減少 token 用量並保留欄位對齊資訊。
 */
async function extractDocumentText(base64Data: string, docType: DocumentTypeHint): Promise<string> {
    const buffer = Buffer.from(base64Data, "base64");

    switch (docType) {
        case "pdf": {
            // pdf-parse 沒有官方型別的預設 export 簽章一致，用 require 動態載入避免建置期型別問題。
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const pdfParse = require("pdf-parse");
            const data = await pdfParse(buffer);
            return data.text as string;
        }
        case "docx": {
            const mammoth = require("mammoth");
            const result = await mammoth.extractRawText({ buffer });
            return result.value as string;
        }
        case "xlsx": {
            const workbook = XLSX.read(buffer, { type: "buffer" });
            return workbookToText(workbook);
        }
        case "csv": {
            const workbook = XLSX.read(buffer, { type: "buffer", raw: true });
            return workbookToText(workbook);
        }
        default:
            throw new Error(`Unsupported document type: ${docType}`);
    }
}

/** 將 SheetJS workbook 轉成簡易文字表格（每列以 tab 分隔），所有分頁都納入。 */
function workbookToText(workbook: XLSX.WorkBook): string {
    const sheetTexts = workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
        const lines = rows.map((row) => row.map((cell) => (cell === undefined || cell === null ? "" : String(cell))).join("\t"));
        return `# Sheet: ${sheetName}\n${lines.join("\n")}`;
    });
    return sheetTexts.join("\n\n");
}

const CONTACT_DOCUMENT_EXTRACTION_PROMPT = `以下是一份通訊錄文件抽取出的原始文字內容（可能是表格，也可能是條列文字）。
請從中辨識出所有列出的聯絡人，並以 JSON 陣列回傳，每筆聯絡人物件格式為：
{"name": string, "role": string, "company": string, "phone": string, "email": string}

規則：
- name 為必填，辨識不到姓名的列請略過
- 其餘欄位辨識不到就回傳空字串 ""
- 電話號碼保留原始格式，不要自行改寫
- 只回傳 JSON 陣列本身，不要加上任何說明文字或 markdown 標記

文件內容：
`;

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-3.1-flash-lite";
const LONG_SILENCE_DAYS = 60;
const BIRTHDAY_LEAD_DAYS = 3;

initializeApp();
const db = getFirestore();

type ContactSummary = {
    id: string;
    name: string;
    company?: string;
    role?: string;
    importance?: number;
    nextContactReminder?: string;
    birthday?: string;
};

type InteractionRecord = {
    contactIds?: string[];
    date?: string;
};

type QuickCaptureActionPayload = {
    textInput?: string;
    audioBase64?: string;
    audioMimeType?: string;
    existingContacts?: ContactSummary[];
    today?: string;
};

type QuickCapturePreview = {
    summary: string;
    contactMatches: Array<{
        referenceId: string;
        matchedContactIds: string[];
        suggestedNewContactName?: string;
        confidence: "high" | "medium" | "low";
        reason: string;
    }>;
    suggestedInteractions: Array<{
        contactReferenceIds: string[];
        type: "meeting" | "call" | "email";
        date: string;
        description: string;
        rawInput?: string;
    }>;
    reminderSuggestions: Array<{
        contactReferenceId: string;
        suggestedDate: string;
        reason: string;
    }>;
    importanceSuggestions: Array<{
        contactReferenceId: string;
        suggestedImportance: 1 | 2 | 3 | 4 | 5;
        reason: string;
    }>;
};

type SuggestionType = "birthday" | "long_silence" | "manual_reminder_due";

type SuggestionRecord = {
    contactId: string;
    type: SuggestionType;
    message: string;
    status: "pending";
    triggerDate: string;
    createdAt: number;
};

const cleanAndParseJson = (text: string) => {
    try {
        const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
        return JSON.parse(cleaned);
    } catch (error) {
        console.error("Failed to parse JSON:", text);
        throw new Error("Invalid JSON response from AI model");
    }
};

const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);

const addDays = (value: Date, days: number) => {
    const next = new Date(value);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
};

const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const normalizeBirthdayForYear = (birthday: string, year: number) => {
    const [, monthStr, dayStr] = birthday.split("-");
    const month = Number(monthStr);
    const day = Number(dayStr);
    // 2/29 生日在非閏年沒有對應日期；不調整的話 targetIso 永遠不會等於 "YYYY-02-29"（因為
    // 那不是真實日曆日），導致這種生日在非閏年完全不會觸發主動提醒。比照前端 upcomingBirthdays
    // 邏輯算在 2/28（見使用者回報的 corner case）。
    const adjustedDay = month === 2 && day === 29 && !isLeapYear(year) ? 28 : day;
    return `${year}-${monthStr}-${String(adjustedDay).padStart(2, "0")}`;
};

const resolveUpcomingBirthday = (birthday: string, today: Date) => {
    const currentYear = today.getUTCFullYear();
    const currentYearBirthday = normalizeBirthdayForYear(birthday, currentYear);
    const todayIso = toIsoDate(today);
    if (currentYearBirthday >= todayIso) return currentYearBirthday;
    return normalizeBirthdayForYear(birthday, currentYear + 1);
};

const daysBetweenIsoDates = (older: string, newer: string) => {
    const olderDate = new Date(`${older}T00:00:00.000Z`);
    const newerDate = new Date(`${newer}T00:00:00.000Z`);
    return Math.floor((newerDate.getTime() - olderDate.getTime()) / 86400000);
};

const buildQuickCapturePrompt = (payload: QuickCaptureActionPayload) => {
    const today = payload.today ?? toIsoDate(new Date());
    const contacts = payload.existingContacts ?? [];
    return `
You are Linka's AI quick-capture parser for a personal CRM.

Today: ${today}

Existing contacts:
${JSON.stringify(contacts)}

Your task:
1. Resolve every person mentioned in the user's input against existing contacts when possible.
2. Create a stable referenceId for each person, such as "person_1", "person_2".
3. If no existing contact matches, keep matchedContactIds empty and fill suggestedNewContactName.
4. Split the input into one or more interaction records when multiple people are mentioned.
5. Infer a concrete YYYY-MM-DD reminder date when the input implies a follow-up time.
6. Suggest importance updates only when the signal is meaningful.
7. Rewrite the user's free-form note into concise interaction descriptions.

Rules:
- Return preview data only. Do not write to any database.
- Every suggested interaction must use only "meeting", "call", or "email".
- Use Traditional Chinese for summary, descriptions, and reasons.
- Use the same referenceId consistently across contactMatches, suggestedInteractions, reminderSuggestions, and importanceSuggestions.
- If the input is ambiguous, use lower confidence and explain why.

Return JSON with this exact shape:
{
  "summary": "string",
  "contactMatches": [
    {
      "referenceId": "person_1",
      "matchedContactIds": ["contact-id"],
      "suggestedNewContactName": "optional string",
      "confidence": "high|medium|low",
      "reason": "string"
    }
  ],
  "suggestedInteractions": [
    {
      "contactReferenceIds": ["person_1"],
      "type": "meeting|call|email",
      "date": "YYYY-MM-DD",
      "description": "string",
      "rawInput": "optional string"
    }
  ],
  "reminderSuggestions": [
    {
      "contactReferenceId": "person_1",
      "suggestedDate": "YYYY-MM-DD",
      "reason": "string"
    }
  ],
  "importanceSuggestions": [
    {
      "contactReferenceId": "person_1",
      "suggestedImportance": 1,
      "reason": "string"
    }
  ]
}
`.trim();
};

const getLatestInteractionDates = async (uid: string) => {
    const snapshot = await db.collection("users").doc(uid).collection("interactions").get();
    const latestByContactId = new Map<string, string>();

    snapshot.forEach((doc) => {
        const data = doc.data() as InteractionRecord;
        const interactionDate = data.date;
        if (!interactionDate) return;
        for (const contactId of data.contactIds ?? []) {
            const current = latestByContactId.get(contactId);
            if (!current || interactionDate > current) {
                latestByContactId.set(contactId, interactionDate);
            }
        }
    });

    return latestByContactId;
};

const buildRuleBasedSuggestions = async (uid: string) => {
    const today = new Date();
    const todayIso = toIsoDate(today);
    const birthdayTargetIso = toIsoDate(addDays(today, BIRTHDAY_LEAD_DAYS));
    const contactsSnapshot = await db.collection("users").doc(uid).collection("contacts").get();
    const latestInteractionDates = await getLatestInteractionDates(uid);
    const suggestions: SuggestionRecord[] = [];

    contactsSnapshot.forEach((doc) => {
        const data = doc.data() as ContactSummary;
        const contactId = doc.id;

        if (data.birthday) {
            const upcomingBirthday = resolveUpcomingBirthday(data.birthday, today);
            if (upcomingBirthday === birthdayTargetIso) {
                suggestions.push({
                    contactId,
                    type: "birthday",
                    message: `${data.name} 將在 ${BIRTHDAY_LEAD_DAYS} 天後生日，適合提前安排祝福或聯絡。`,
                    status: "pending",
                    triggerDate: birthdayTargetIso,
                    createdAt: Date.now(),
                });
            }
        }

        if (data.nextContactReminder && data.nextContactReminder <= todayIso) {
            suggestions.push({
                contactId,
                type: "manual_reminder_due",
                message: `${data.name} 的手動提醒已到期，現在可以安排跟進。`,
                status: "pending",
                triggerDate: data.nextContactReminder,
                createdAt: Date.now(),
            });
        }

        const latestInteractionDate = latestInteractionDates.get(contactId);
        if (latestInteractionDate && daysBetweenIsoDates(latestInteractionDate, todayIso) >= LONG_SILENCE_DAYS) {
            suggestions.push({
                contactId,
                type: "long_silence",
                message: `${data.name} 已經超過 ${LONG_SILENCE_DAYS} 天沒有互動，值得重新聯絡。`,
                status: "pending",
                triggerDate: todayIso,
                createdAt: Date.now(),
            });
        }
    });

    return suggestions;
};

const persistSuggestions = async (uid: string, suggestions: SuggestionRecord[]) => {
    const batch = db.batch();

    for (const suggestion of suggestions) {
        const docId = `${suggestion.type}_${suggestion.contactId}_${suggestion.triggerDate}`;
        const ref = db.collection("users").doc(uid).collection("suggestions").doc(docId);
        const existing = await ref.get();
        const existingStatus = existing.data()?.status as string | undefined;

        if (existing.exists && existingStatus && existingStatus !== "pending") {
            continue;
        }

        batch.set(ref, suggestion, { merge: true });
    }

    await batch.commit();
};

export const geminiProxy = onRequest({
    secrets: [GEMINI_API_KEY],
    cors: true,
}, async (request, response) => {
    response.set("Access-Control-Allow-Origin", "*");
    response.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.set("Access-Control-Allow-Headers", "Content-Type");

    if (request.method === "OPTIONS") {
        response.status(204).send("");
        return;
    }

    const { action, payload } = request.body;

    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) {
        response.status(500).json({ error: "The Gemini API Key is not configured." });
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        let result;

        switch (action) {
            case "getNetworkingAdvice": {
                const { chatHistory, userInput, systemPrompt } = payload;
                const model = genAI.getGenerativeModel({
                    model: GEMINI_MODEL,
                    systemInstruction: systemPrompt,
                    generationConfig: {
                        responseMimeType: "application/json",
                    },
                });
                const apiResult = await model.generateContent({
                    contents: chatHistory.map((msg: { role: string; text: string }) => ({
                        role: msg.role === "user" ? "user" : "model",
                        parts: [{ text: msg.text }],
                    })).concat([{ role: "user", parts: [{ text: userInput }] }]),
                });
                result = cleanAndParseJson(apiResult.response.text());
                break;
            }

            case "extractContactFromCard": {
                const { base64Data, mimeType, prompt } = payload;
                const model = genAI.getGenerativeModel({
                    model: GEMINI_MODEL,
                    generationConfig: {
                        responseMimeType: "application/json",
                    },
                });
                const apiResult = await model.generateContent({
                    contents: [
                        {
                            role: "user",
                            parts: [
                                {
                                    inlineData: {
                                        data: base64Data,
                                        mimeType,
                                    },
                                },
                                { text: prompt },
                            ],
                        },
                    ],
                });
                result = cleanAndParseJson(apiResult.response.text());
                break;
            }

            case "getSuggestedTopics": {
                const { prompt, systemInstruction } = payload;
                const model = genAI.getGenerativeModel({
                    model: GEMINI_MODEL,
                    systemInstruction,
                    generationConfig: {
                        responseMimeType: "application/json",
                    },
                });
                const apiResult = await model.generateContent({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                });
                result = cleanAndParseJson(apiResult.response.text());
                break;
            }

            case "parseContactDocument": {
                const { base64Data, docType } = payload as { base64Data: string; docType: DocumentTypeHint };
                console.log(`Parsing contact document (${docType})...`);
                const extractedText = await extractDocumentText(base64Data, docType);
                const truncatedText = extractedText.slice(0, 50000); // 避免超大文件導致 prompt 過長
                const model = genAI.getGenerativeModel({
                    model: GEMINI_MODEL,
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                });
                const apiResult = await model.generateContent({
                    contents: [
                        {
                            role: "user",
                            parts: [{ text: CONTACT_DOCUMENT_EXTRACTION_PROMPT + truncatedText }],
                        },
                    ],
                });
                result = cleanAndParseJson(apiResult.response.text());
                break;
            }

            case "getProfileSummary": {
                const { prompt, systemInstruction } = payload;
                const model = genAI.getGenerativeModel({
                    model: GEMINI_MODEL,
                    systemInstruction,
                    generationConfig: {
                        temperature: 0.5,
                    },
                });
                const apiResult = await model.generateContent({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                });
                result = apiResult.response.text();
                break;
            }

            case "planContactQuery": {
                // 見 spec.md §5.5a、§8.5：問答模式第一階段「查詢規劃」。
                // 輸入為使用者問題 + 輕量聯絡人清單（僅姓名/公司/職稱，不含完整資料），
                // 輸出判斷出的相關聯絡人姓名與關鍵字，供前端據此對 Firestore 做範圍查詢，
                // 避免把整個聯絡人資料庫塞進單次 prompt。
                const { prompt, systemInstruction } = payload;
                console.log("Planning contact query...");
                const model = genAI.getGenerativeModel({
                    model: GEMINI_MODEL,
                    systemInstruction: systemInstruction,
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                });
                const apiResult = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                });
                result = cleanAndParseJson(apiResult.response.text());
                break;
            }

            case "answerContactQuestion": {
                // 見 spec.md §5.5a：問答模式第二階段「生成回答」。輸入為使用者問題 +
                // 第一階段查詢規劃後從 Firestore 撈出的相關聯絡人/互動子集（而非整個資料庫），
                // 要求回答需註明資訊來源於哪位聯絡人／哪筆互動紀錄。
                const { prompt, systemInstruction } = payload;
                console.log("Answering contact question...");
                const model = genAI.getGenerativeModel({
                    model: GEMINI_MODEL,
                    systemInstruction: systemInstruction,
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                });
                const apiResult = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                });
                result = cleanAndParseJson(apiResult.response.text());
                break;
            }

            // 對照 spec.md §5.8「聯絡人網路身分研究摘要」（文字摘要子功能；照片搜尋子功能
            // 需要另外的圖片搜尋 API/憑證，本次不實作）。使用 Gemini 內建的 Google 搜尋
            // grounding 工具，讓模型能查詢即時網路資訊再摘要，而非僅憑訓練資料幻想內容。
            case "researchContactProfile": {
                const { prompt, systemInstruction } = payload;
                console.log("Researching contact profile with Google Search grounding...");
                const model = genAI.getGenerativeModel({
                    model: GEMINI_MODEL,
                    systemInstruction: systemInstruction,
                    generationConfig: {
                        temperature: 0.3,
                    },
                    // 直接用 curl 打 REST API 實測確認：`gemini-3.1-flash-lite` 這個模型已不支援
                    // 舊版 `google_search_retrieval` 工具（回傳 400 INVALID_ARGUMENT，訊息明講
                    // "Please use google_search tool instead"），必須改用 `google_search`。
                    // 已安裝的 @google/generative-ai SDK（0.21.0）型別定義沒有這個新欄位（只認得
                    // 舊的 GoogleSearchRetrievalTool），但 SDK runtime 只是把 tools 原樣序列化送出
                    // （見 node_modules/@google/generative-ai/dist/index.js，未對欄位做白名單過濾），
                    // 所以用型別斷言繞過編譯期檢查即可、不需要換套件。
                    tools: [{ googleSearch: {} }] as unknown as Parameters<
                        typeof genAI.getGenerativeModel
                    >[0]["tools"],
                });
                const apiResult = await model.generateContent({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                });

                const candidate = apiResult.response.candidates?.[0];
                const text = apiResult.response.text();

                // 嘗試從 SDK 回傳的 groundingMetadata 取得真實引用來源網址。
                // 修正：之前這裡讀的是 "groundingChuncks"（SDK 型別定義裡的拼字），但直接用 curl
                // 打 REST API 實測發現正式回應的欄位其實是正確拼字 "groundingChunks"，導致這段程式
                // 一直讀到 undefined、從未真正用到 grounding 來源，全部悄悄 fallback 到後面的文字擷取。
                const groundingMetadata = candidate?.groundingMetadata as
                    | { groundingChunks?: Array<{ web?: { uri?: string } }> }
                    | undefined;
                const groundingChunks = groundingMetadata?.groundingChunks ?? [];
                const citedUrls = groundingChunks
                    .map((chunk) => chunk.web?.uri)
                    .filter((uri): uri is string => typeof uri === "string" && uri.length > 0);

                let sourceUrls = Array.from(new Set(citedUrls));
                let citationSource: "grounding_metadata" | "inline_text_fallback" = "grounding_metadata";

                // Fallback：若這次回應沒有 groundingMetadata（例如模型判斷不需要搜尋、
                // 或某些情況下 SDK 未回傳該欄位），改用 prompt 中要求的「文末列出來源網址」
                // 慣例，以正規表示式從回應文字擷取 URL。
                if (sourceUrls.length === 0) {
                    const urlRegex = /https?:\/\/[^\s)\]"'>]+/g;
                    const matches = text.match(urlRegex) ?? [];
                    sourceUrls = Array.from(new Set(matches));
                    citationSource = "inline_text_fallback";
                }

                result = {
                    summary: text,
                    sourceUrls,
                    citationSource,
                };
                break;
            }

            case "parseQuickCapturePreview": {
                const quickCapturePayload = payload as QuickCaptureActionPayload;
                const prompt = buildQuickCapturePrompt(quickCapturePayload);
                const model = genAI.getGenerativeModel({
                    model: GEMINI_MODEL,
                    generationConfig: {
                        responseMimeType: "application/json",
                    },
                });
                const parts: Array<
                    { text: string } |
                    { inlineData: { data: string; mimeType: string } }
                > = [];

                if (quickCapturePayload.audioBase64 && quickCapturePayload.audioMimeType) {
                    parts.push({
                        inlineData: {
                            data: quickCapturePayload.audioBase64,
                            mimeType: quickCapturePayload.audioMimeType,
                        },
                    });
                }

                if (quickCapturePayload.textInput) {
                    parts.push({ text: `User input: ${quickCapturePayload.textInput}` });
                }

                parts.push({ text: prompt });

                const apiResult = await model.generateContent({
                    contents: [{ role: "user", parts }],
                });
                result = cleanAndParseJson(apiResult.response.text()) as QuickCapturePreview;
                break;
            }

            default:
                response.status(400).json({ error: "Unknown action" });
                return;
        }

        response.status(200).json(result);
    } catch (error: unknown) {
        console.error("Gemini Proxy Error:", error);
        const message = error instanceof Error ? error.message : "Gemini API call failed";
        response.status(500).json({ error: message });
    }
});

export const generateProactiveSuggestionsDaily = onSchedule({
    schedule: "0 9 * * *",
    timeZone: "Asia/Taipei",
}, async () => {
    const usersSnapshot = await db.collection("users").get();
    for (const userDoc of usersSnapshot.docs) {
        const suggestions = await buildRuleBasedSuggestions(userDoc.id);
        if (suggestions.length > 0) {
            await persistSuggestions(userDoc.id, suggestions);
        }
    }
});
