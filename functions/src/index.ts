import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Use secrets for the API Key
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-3.1-flash-lite";

const cleanAndParseJson = (text: string) => {
    try {
        // Remove markdown code blocks if present
        const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
        return JSON.parse(cleaned);
    } catch (e) {
        console.error("Failed to parse JSON:", text);
        throw new Error("Invalid JSON response from AI model");
    }
};

export const geminiProxy = onRequest({
    secrets: [GEMINI_API_KEY],
    cors: true,
}, async (request, response) => {
    // Set CORS headers manually
    response.set('Access-Control-Allow-Origin', '*');
    response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.set('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight request
    if (request.method === 'OPTIONS') {
        response.status(204).send('');
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
                    contents: chatHistory.map((msg: any) => ({
                        role: msg.role === 'user' ? 'user' : 'model',
                        parts: [{ text: msg.text }]
                    })).concat([{ role: 'user', parts: [{ text: userInput }] }]),
                });
                const text = apiResult.response.text();
                result = cleanAndParseJson(text);
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
                                        mimeType: mimeType,
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

            case "getProfileSummary": {
                const { prompt, systemInstruction } = payload;
                console.log("Getting profile summary...");
                const model = genAI.getGenerativeModel({
                    model: GEMINI_MODEL,
                    systemInstruction: systemInstruction,
                    generationConfig: {
                        temperature: 0.5,
                    }
                });
                const apiResult = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    // Remove tools if not needed or ensure permission
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

            default:
                response.status(400).json({ error: "Unknown action" });
                return;
        }

        response.status(200).json(result);
    } catch (error: any) {
        console.error("Gemini Proxy Error:", error);
        response.status(500).json({ error: error.message || "Gemini API call failed" });
    }
});
