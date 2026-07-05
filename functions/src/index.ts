import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenerativeAI } from "@google/generative-ai";
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
