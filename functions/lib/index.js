"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateProactiveSuggestionsDaily = exports.geminiProxy = void 0;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const params_1 = require("firebase-functions/params");
const generative_ai_1 = require("@google/generative-ai");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const XLSX = __importStar(require("xlsx"));
async function extractDocumentText(base64Data, docType) {
    const buffer = Buffer.from(base64Data, "base64");
    switch (docType) {
        case "pdf": {
            const pdfParse = require("pdf-parse");
            const data = await pdfParse(buffer);
            return data.text;
        }
        case "docx": {
            const mammoth = require("mammoth");
            const result = await mammoth.extractRawText({ buffer });
            return result.value;
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
function workbookToText(workbook) {
    const sheetTexts = workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
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
const GEMINI_API_KEY = (0, params_1.defineSecret)("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-3.1-flash-lite";
const LONG_SILENCE_DAYS = 60;
const BIRTHDAY_LEAD_DAYS = 3;
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const cleanAndParseJson = (text) => {
    try {
        const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
        return JSON.parse(cleaned);
    }
    catch (error) {
        console.error("Failed to parse JSON:", text);
        throw new Error("Invalid JSON response from AI model");
    }
};
const toIsoDate = (value) => value.toISOString().slice(0, 10);
const addDays = (value, days) => {
    const next = new Date(value);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
};
const isLeapYear = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
const normalizeBirthdayForYear = (birthday, year) => {
    const [, monthStr, dayStr] = birthday.split("-");
    const month = Number(monthStr);
    const day = Number(dayStr);
    const adjustedDay = month === 2 && day === 29 && !isLeapYear(year) ? 28 : day;
    return `${year}-${monthStr}-${String(adjustedDay).padStart(2, "0")}`;
};
const resolveUpcomingBirthday = (birthday, today) => {
    const currentYear = today.getUTCFullYear();
    const currentYearBirthday = normalizeBirthdayForYear(birthday, currentYear);
    const todayIso = toIsoDate(today);
    if (currentYearBirthday >= todayIso)
        return currentYearBirthday;
    return normalizeBirthdayForYear(birthday, currentYear + 1);
};
const daysBetweenIsoDates = (older, newer) => {
    const olderDate = new Date(`${older}T00:00:00.000Z`);
    const newerDate = new Date(`${newer}T00:00:00.000Z`);
    return Math.floor((newerDate.getTime() - olderDate.getTime()) / 86400000);
};
const buildQuickCapturePrompt = (payload) => {
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
const getLatestInteractionDates = async (uid) => {
    const snapshot = await db.collection("users").doc(uid).collection("interactions").get();
    const latestByContactId = new Map();
    snapshot.forEach((doc) => {
        const data = doc.data();
        const interactionDate = data.date;
        if (!interactionDate)
            return;
        for (const contactId of data.contactIds ?? []) {
            const current = latestByContactId.get(contactId);
            if (!current || interactionDate > current) {
                latestByContactId.set(contactId, interactionDate);
            }
        }
    });
    return latestByContactId;
};
const buildRuleBasedSuggestions = async (uid) => {
    const today = new Date();
    const todayIso = toIsoDate(today);
    const birthdayTargetIso = toIsoDate(addDays(today, BIRTHDAY_LEAD_DAYS));
    const contactsSnapshot = await db.collection("users").doc(uid).collection("contacts").get();
    const latestInteractionDates = await getLatestInteractionDates(uid);
    const suggestions = [];
    contactsSnapshot.forEach((doc) => {
        const data = doc.data();
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
const persistSuggestions = async (uid, suggestions) => {
    const batch = db.batch();
    for (const suggestion of suggestions) {
        const docId = `${suggestion.type}_${suggestion.contactId}_${suggestion.triggerDate}`;
        const ref = db.collection("users").doc(uid).collection("suggestions").doc(docId);
        const existing = await ref.get();
        const existingStatus = existing.data()?.status;
        if (existing.exists && existingStatus && existingStatus !== "pending") {
            continue;
        }
        batch.set(ref, suggestion, { merge: true });
    }
    await batch.commit();
};
exports.geminiProxy = (0, https_1.onRequest)({
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
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
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
                    contents: chatHistory.map((msg) => ({
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
                const { base64Data, docType } = payload;
                console.log(`Parsing contact document (${docType})...`);
                const extractedText = await extractDocumentText(base64Data, docType);
                const truncatedText = extractedText.slice(0, 50000);
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
            case "researchContactProfile": {
                const { prompt, systemInstruction } = payload;
                console.log("Researching contact profile with Google Search grounding...");
                const model = genAI.getGenerativeModel({
                    model: GEMINI_MODEL,
                    systemInstruction: systemInstruction,
                    generationConfig: {
                        temperature: 0.3,
                    },
                    tools: [
                        {
                            googleSearchRetrieval: {},
                        },
                    ],
                });
                const apiResult = await model.generateContent({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                });
                const candidate = apiResult.response.candidates?.[0];
                const text = apiResult.response.text();
                const groundingChunks = candidate?.groundingMetadata?.groundingChuncks ?? [];
                const citedUrls = groundingChunks
                    .map((chunk) => chunk.web?.uri)
                    .filter((uri) => typeof uri === "string" && uri.length > 0);
                let sourceUrls = Array.from(new Set(citedUrls));
                let citationSource = "grounding_metadata";
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
                const quickCapturePayload = payload;
                const prompt = buildQuickCapturePrompt(quickCapturePayload);
                const model = genAI.getGenerativeModel({
                    model: GEMINI_MODEL,
                    generationConfig: {
                        responseMimeType: "application/json",
                    },
                });
                const parts = [];
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
                result = cleanAndParseJson(apiResult.response.text());
                break;
            }
            default:
                response.status(400).json({ error: "Unknown action" });
                return;
        }
        response.status(200).json(result);
    }
    catch (error) {
        console.error("Gemini Proxy Error:", error);
        const message = error instanceof Error ? error.message : "Gemini API call failed";
        response.status(500).json({ error: message });
    }
});
exports.generateProactiveSuggestionsDaily = (0, scheduler_1.onSchedule)({
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
//# sourceMappingURL=index.js.map