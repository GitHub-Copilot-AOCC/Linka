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
exports.geminiProxy = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const generative_ai_1 = require("@google/generative-ai");
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
const cleanAndParseJson = (text) => {
    try {
        const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
        return JSON.parse(cleaned);
    }
    catch (e) {
        console.error("Failed to parse JSON:", text);
        throw new Error("Invalid JSON response from AI model");
    }
};
exports.geminiProxy = (0, https_1.onRequest)({
    secrets: [GEMINI_API_KEY],
    cors: true,
}, async (request, response) => {
    response.set('Access-Control-Allow-Origin', '*');
    response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.set('Access-Control-Allow-Headers', 'Content-Type');
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
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
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
                    contents: chatHistory.map((msg) => ({
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
            default:
                response.status(400).json({ error: "Unknown action" });
                return;
        }
        response.status(200).json(result);
    }
    catch (error) {
        console.error("Gemini Proxy Error:", error);
        response.status(500).json({ error: error.message || "Gemini API call failed" });
    }
});
//# sourceMappingURL=index.js.map