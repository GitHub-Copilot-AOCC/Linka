import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
        matchedContactIds: string[];
        suggestedNewContactName?: string;
        confidence: "high" | "medium" | "low";
        reason: string;
    }>;
    suggestedInteractions: Array<{
        contactIds: string[];
        type: "meeting" | "call" | "email";
        date: string;
        description: string;
        rawInput?: string;
    }>;
    reminderSuggestions: Array<{
        contactId: string;
        suggestedDate: string;
        reason: string;
    }>;
    importanceSuggestions: Array<{
        contactId: string;
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
    } catch (e) {
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

const normalizeBirthdayForYear = (birthday: string, year: number) => {
    const [, month, day] = birthday.split("-");
    return `${year}-${month}-${day}`;
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
1. Resolve people mentioned in the user's input against existing contacts when possible.
2. If no match exists, suggest a new contact name.
3. Split a single input into one or more interaction records when multiple people are mentioned.
4. Infer a concrete YYYY-MM-DD reminder date when the input implies a follow-up time.
5. Suggest importance updates only when the signal is meaningful.
6. Rewrite the user's free-form note into concise interaction descriptions.

Rules:
- Return preview data only. Do not write to any database.
- Every suggested interaction must use only "meeting", "call", or "email".
- Use Traditional Chinese for summary, descriptions, and reasons.
- If the input is ambiguous, use lower confidence and explain why.

Return JSON with this exact shape:
{
  "summary": "string",
  "contactMatches": [
    {
      "matchedContactIds": ["contact-id"],
      "suggestedNewContactName": "optional string",
      "confidence": "high|medium|low",
      "reason": "string"
    }
  ],
  "suggestedInteractions": [
    {
      "contactIds": ["contact-id"],
      "type": "meeting|call|email",
      "date": "YYYY-MM-DD",
      "description": "string",
      "rawInput": "optional string"
    }
  ],
  "reminderSuggestions": [
    {
      "contactId": "contact-id",
      "suggestedDate": "YYYY-MM-DD",
      "reason": "string"
    }
  ],
  "importanceSuggestions": [
    {
      "contactId": "contact-id",
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
                    message: `再 ${BIRTHDAY_LEAD_DAYS} 天就是 ${data.name} 的生日，建議準備生日祝福。`,
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
                message: `${data.name} 的手動提醒日期已到，建議安排聯絡。`,
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
                message: `${data.name} 已超過 ${LONG_SILENCE_DAYS} 天沒有互動，建議主動聯絡。`,
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
    console.log(`Action: ${action}`, { payloadKeys: Object.keys(payload || {}) });

    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) {
        console.error("API Key missing");
        response.status(500).json({ error: "The Gemini API Key is not configured." });
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        let result;
        switch (action) {
            case "getNetworkingAdvice": {
                const { chatHistory, userInput, systemPrompt } = payload;
                console.log("Generating networking advice...");
                const model = genAI.getGenerativeModel({
                    model: GEMINI_MODEL,
                    systemInstruction: systemPrompt,
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                });
                const apiResult = await model.generateContent({
                    contents: chatHistory.map((msg: { role: string; text: string }) => ({
                        role: msg.role === "user" ? "user" : "model",
                        parts: [{ text: msg.text }]
                    })).concat([{ role: "user", parts: [{ text: userInput }] }]),
                });
                result = cleanAndParseJson(apiResult.response.text());
                break;
            }

            case "extractContactFromCard": {
                const { base64Data, mimeType, prompt } = payload;
                console.log("Extracting contact from card...");
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
                console.log("Getting suggested topics...");
                const model = genAI.getGenerativeModel({
                    model: GEMINI_MODEL,
                    systemInstruction,
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                });
                const apiResult = await model.generateContent({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                });
                result = cleanAndParseJson(apiResult.response.text());
                break;
            }

            case "getProfileSummary": {
                const { prompt, systemInstruction } = payload;
                console.log("Getting profile summary...");
                const model = genAI.getGenerativeModel({
                    model: GEMINI_MODEL,
                    systemInstruction,
                    generationConfig: {
                        temperature: 0.5,
                    }
                });
                const apiResult = await model.generateContent({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                });
                result = apiResult.response.text();
                break;
            }

            case "parseQuickCapturePreview": {
                const quickCapturePayload = payload as QuickCaptureActionPayload;
                const prompt = buildQuickCapturePrompt(quickCapturePayload);
                const model = genAI.getGenerativeModel({
                    model: GEMINI_MODEL,
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
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
