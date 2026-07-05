const c="https://us-central1-aifriendcircle-63093.cloudfunctions.net/geminiProxy",a=async(e,r)=>{const t=await fetch(c,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:e,payload:r})});if(!t.ok){const n=await t.json().catch(()=>({}));throw new Error(n.error||`HTTP error! status: ${t.status}`)}return await t.json()},l=async(e,r,t)=>{try{const n=t.map(o=>{var i;return{id:o.id,name:o.name,role:o.role,company:o.company,tags:o.tags,notes:o.notes,lastInteraction:(i=o.interactions)!=null&&i[0]?`${o.interactions[0].date} (${o.interactions[0].title})`:"None"}}),s=`
      You are NetworkAI, a personal networking assistant.
      
      **Current Date**: ${new Date().toLocaleDateString()}
      
      **Your Knowledge Base (User's Contacts)**: 
      ${JSON.stringify(n)}
      
      **Strict Rules**:
      1. You must answer questions **ONLY** based on the contact data provided above. Do not invent or hallucinate contacts.
      2. If the user asks about someone not in the list, say you couldn't find them in the database.
      3. Provide 3 relevant follow-up questions suggestions based on the context of your answer.
      4. If relevant, return the IDs of the contacts mentioned in your answer.
      
      **Response Format**:
      Return a JSON object with this structure:
      {
        "answer": "Your natural language response here (in Traditional Chinese)",
        "suggestedQuestions": ["Question 1", "Question 2", "Question 3"],
        "relevantContactIds": ["id1", "id2"] (or empty array)
      }
    `;return await a("getNetworkingAdvice",{chatHistory:e,userInput:r,systemPrompt:s})}catch(n){return console.error("Gemini API Error:",n),{answer:"發生錯誤，無法取得建議。",suggestedQuestions:[],relevantContactIds:[]}}},d=async(e,r)=>{try{return await a("extractContactFromCard",{base64Data:e.split(",")[1],mimeType:r,prompt:"Extract contact information from this business card. Return a JSON object with: name, role/title, company name, phone number, and email address."})}catch(t){throw console.error("OCR Error:",t),t}},m=async(e,r)=>{try{const t=`
      請根據以下聯絡人資訊與過去的互動紀錄，建議 3 個在下次見面時可以聊的話題。
      
      聯絡人資訊：
      姓名：${e.name}
      職稱：${e.role}
      公司：${e.company}
      筆記：${e.notes}
      
      過去互動紀錄：
      ${r.map(s=>`- ${s.date} [${s.type}] ${s.title}: ${s.description}`).join(`
`)}
      
      請提供具體、有溫度且能展現「我有記住上次談話內容」的話題建議。
    `;return await a("getSuggestedTopics",{prompt:t,systemInstruction:"你是一位精通社交心理學的 AI 助手。請以繁體中文回答，並以 JSON 陣列格式回傳，每個元素包含 'topic' (話題內容) 與 'reason' (建議理由)。"})}catch(t){return console.error("Suggested Topics Error:",t),[]}},p=async e=>{try{const r=`
      請針對以下個人檔案連結（LinkedIn 或 Facebook）進行深入研究，並撰寫一份精簡的「人物側寫」：${e}
      
      請善用搜尋工具查找公開資訊，直接依據以下包含的面向進行摘要說明：
      1. **工作經歷**：目前的職位與主要職涯歷程。
      2. **學校經歷**：學歷背景與畢業學校。
      3. **專長**：專業技能、領域知識與核心競爭力。
      4. **工作過的公司**：曾經任職過的主要公司或組織名稱。
      5. **其他個人資訊 (若為 Facebook)**：若連結為 Facebook，請一併摘要公開的生活動態、興趣、居住地或近期關注議題。
      
      請以條列式呈現。嚴格禁止輸出任何「好的」、「我會為您...」、「以下是...」等開場白或結尾客套話。直接輸出這幾點內容即可。請用繁體中文。
    `;return await a("getProfileSummary",{prompt:r,systemInstruction:"你是一個嚴格的資料提取機器人。只輸出請求的資訊，完全不包含任何對話、問候或自我描述的語句。"})||"無法生成摘要。"}catch(r){return console.error("Profile Summary Error:",r),"發生錯誤：無法生成摘要，請稍後再試。"}};export{m as a,p as b,d as e,l as g};
