"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateProactiveSuggestionsDaily = exports.geminiProxy = void 0;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const params_1 = require("firebase-functions/params");
const generative_ai_1 = require("@google/generative-ai");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
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
const normalizeBirthdayForYear = (birthday, year) => {
    const [, month, day] = birthday.split("-");
    return `${year}-${month}-${day}`;
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