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
                    // 已安裝的 @google/generative-ai SDK（0.21.0）型別定義中，Google 搜尋
                    // grounding 工具的形狀是 GoogleSearchRetrievalTool -> { googleSearchRetrieval: {} }
                    // （見 node_modules/@google/generative-ai/dist/generative-ai.d.ts 的
                    // GoogleSearchRetrievalTool / Tool 型別定義）。較新版 SDK（@google/genai）
                    // 改用 `{ googleSearch: {} }`，但那是不同的套件，此處以實際安裝版本為準。
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

                // 嘗試從 SDK 回傳的 groundingMetadata 取得真實引用來源網址。
                // 注意：SDK 型別定義中此欄位名稱為 "groundingChuncks"（原文拼字如此，非筆誤）。
                const groundingChunks = candidate?.groundingMetadata?.groundingChuncks ?? [];
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
