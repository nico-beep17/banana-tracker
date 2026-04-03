/**
 * Gmail Scanner Utility for Shipping Docs
 * Uses Gemini 3.1 Pro with vision to intelligently analyze emails and image attachments
 * for shipping document detection and vessel info extraction.
 */

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

/**
 * Search Gmail for emails related to a specific container, then analyze with AI
 * @param {string} token - Gmail OAuth access token
 * @param {string} reeferNo - Container/reefer number to search for
 * @returns {Promise<{messages: Array, matchedDocs: Object, vesselInfo: Object}>}
 */
export async function searchGmailForContainer(token, container, customQuery = null) {
  if (!token || !container) return { messages: [], error: 'Missing token or container data' };
  
  try {
    let queryStr = '';
    
    if (customQuery && customQuery.trim() !== '') {
        queryStr = customQuery;
    } else {
        // Build a dynamic search flow using all available container identifiers.
        // The user explicitly requested to include multiple keywords since the container ID is not always present in emails.
        const terms = [];
        if (container.reeferNo) {
            terms.push(container.reeferNo.replace(/[^A-Za-z0-9\s]/g, ''));
            const clean = container.reeferNo.replace(/[^A-Za-z0-9]/g, '');
            if (clean.length > 4) terms.push(clean);
        }
        const bookingNo = (container.bookingno || container.bookingNo || '').trim();
        if (bookingNo) terms.push(bookingNo);
        
        // Sometimes users put just "COSCO" or "SITC" in reeferName, which is a poison pill that pulls 10,000 emails.
        const reeferName = (container.reeferName || '').trim();
        const poisonLines = ['cosco', 'sitc', 'oocl', 'evergreen', 'msc', 'cma', 'wanhai', 'maersk', 'yangming', 'hmm', 'zim', 'one'];
        if (reeferName && !poisonLines.includes(reeferName.toLowerCase())) {
            terms.push(reeferName);
        }
        // Strip trailing tabs, and strip trailing voyage numbers (e.g., "136N" or "V41N") 
        // to leave just the pure Vessel Name (e.g., "SEASPAN EMERALD") which matches user expectations.
        const voyageStr = (container.voyageNo || '').trim().replace(/\t/g, ' ');
        if (voyageStr) {
            // Split by space, keep words that don't have numbers in them (the pure vessel name)
            const vesselOnly = voyageStr.split(' ').filter(w => !/\d/.test(w)).join(' ').trim();
            if (vesselOnly && vesselOnly.length > 3) {
                // E.g., "SEASPAN EMERALD 41N" -> "SEASPAN EMERALD"
                terms.push(vesselOnly);
            } else {
                // Fallback to original string if for some reason it's mostly numbers
                terms.push(voyageStr);
            }
        }
        
        // Combine terms with an OR operator. Don't wrap in quotes to allow Gmail's native fuzzy match.
        // We wrap multi-word terms in parenthesis so OR applies correctly: (A B) OR C -> (A AND B) OR C
        const formattedTerms = terms.filter(Boolean).map(t => `(${t})`);
        queryStr = formattedTerms.length > 0 ? `(${formattedTerms.join(' OR ')})` : '';
    }
    
    // Search in everywhere (inbox, sent, etc.) up to 40 results to find the most relevant context.
    const q = encodeURIComponent(`in:anywhere ${queryStr}`);
    
    // Using 100 results to ensure we cast a wide enough net to catch the original booking emails
    // which may be buried behind 50+ back-and-forth threads with the forwarders.
    const res = await fetch(
      `${GMAIL_API_BASE}/messages?q=${q}&maxResults=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    if (res.status === 401) {
      return { messages: [], error: 'TOKEN_EXPIRED' };
    }
    
    if (!res.ok) {
      const errText = await res.text();
      console.error('[GmailScan] Search error:', errText);
      return { messages: [], error: `Gmail API error: ${res.status}` };
    }
    
    const data = await res.json();
    if (!data.messages || data.messages.length === 0) {
      return { messages: [], matchedDocs: {}, vesselInfo: {}, totalFound: 0 };
    }
    
    // Fetch each message's full content
    const messageDetails = await Promise.all(
      data.messages.slice(0, 40).map(async (msg) => {
        try {
          const msgRes = await fetch(
            `${GMAIL_API_BASE}/messages/${msg.id}?format=full`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!msgRes.ok) return null;
          return await msgRes.json();
        } catch (e) {
          console.warn('[GmailScan] Failed to fetch message:', msg.id, e);
          return null;
        }
      })
    );
    
    const validMessages = messageDetails.filter(Boolean);
    
    // Process messages — extract text, metadata, and identify image attachments
    const processedMessages = [];
    const imageAttachments = [];
    
    for (const msg of validMessages) {
      const headers = msg.payload?.headers || [];
      const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
      
      // Decode body text (handle multipart)
      let bodyText = '';
      const attachmentRefs = [];
      
      const extractParts = (part) => {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          try {
            bodyText += atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          } catch(e) {}
        }
        if (part.mimeType === 'text/html' && !bodyText && part.body?.data) {
          try {
            let html = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            bodyText += html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
          } catch(e) {}
        }
        
        // Track image attachments for AI vision analysis
        if (part.filename && part.body?.attachmentId) {
          const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|tiff?)$/i.test(part.filename) ||
                         (part.mimeType || '').startsWith('image/');
          const isPdf = part.mimeType === 'application/pdf' || /\.pdf$/i.test(part.filename);
          
          if (isImage || isPdf) {
            attachmentRefs.push({
              attachmentId: part.body.attachmentId,
              messageId: msg.id,
              filename: part.filename,
              mimeType: part.mimeType,
              isImage,
              isPdf,
            });
          }
        }
        
        if (part.parts) part.parts.forEach(extractParts);
      };
      
      extractParts(msg.payload || {});
      if (!bodyText) bodyText = msg.snippet || '';
      
      const dateStr = getHeader('Date');
      let timestamp = 0;
      try { timestamp = new Date(dateStr).getTime() || 0; } catch(e) {}
      
      processedMessages.push({
        id: msg.id,
        threadId: msg.threadId,
        subject: getHeader('Subject'),
        from: getHeader('From'),
        date: dateStr,
        timestamp,
        snippet: msg.snippet || '',
        bodyText: bodyText.slice(0, 4000), // Limit for AI context
        hasAttachments: attachmentRefs.length > 0,
        attachmentCount: attachmentRefs.length,
        attachmentRefs,
      });
    }
    
    // Sort newest first — corrections/delays take priority
    processedMessages.sort((a, b) => b.timestamp - a.timestamp);
    
    // Fetch attachments for AI vision (limit to 10 to stay within API limits, prioritize PDFs and shipping keywords)
    const rawRefs = processedMessages.flatMap(m => 
      m.attachmentRefs.filter(a => a.isImage || a.isPdf).map(a => ({ ...a, fromEmail: m.subject }))
    );
    
    // Prioritize PDFs over images, and prioritize files with shipping keywords over generic ones
    rawRefs.sort((a, b) => {
        const aName = (a.filename || '').toLowerCase();
        const bName = (b.filename || '').toLowerCase();
        
        const aIsKey = aName.includes('bl') || aName.includes('bill') || aName.includes('invoice') || aName.includes('ci') || aName.includes('pl') || aName.includes('packing') || aName.includes('atw') || aName.includes('ed');
        const bIsKey = bName.includes('bl') || bName.includes('bill') || bName.includes('invoice') || bName.includes('ci') || bName.includes('pl') || bName.includes('packing') || bName.includes('atw') || bName.includes('ed');
        
        if (aIsKey && !bIsKey) return -1;
        if (!aIsKey && bIsKey) return 1;
        
        if (a.isPdf && !b.isPdf) return -1;
        if (!a.isPdf && b.isPdf) return 1;
        
        return 0; // maintain original relative recent-first order
    });
    
    const allAttachmentRefs = rawRefs.slice(0, 10);
    
    let totalBytes = 0;
    for (const ref of allAttachmentRefs) {
      if (totalBytes > 3800000) {
          console.warn('[GmailScan] Reached Vercel 4.5MB payload limit, skipping remaining attachments.');
          break;
      }
      try {
        const attRes = await fetch(
          `${GMAIL_API_BASE}/messages/${ref.messageId}/attachments/${ref.attachmentId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (attRes.ok) {
          const attData = await attRes.json();
          if (attData.data) {
            const byteSize = attData.data.length * 0.75; // Approx decoded size or just use string length
            if (totalBytes + byteSize > 3800000) break;
            
            imageAttachments.push({
              base64Data: attData.data.replace(/-/g, '+').replace(/_/g, '/'),
              mimeType: ref.mimeType || 'image/jpeg',
              filename: ref.filename,
              fromEmail: ref.fromEmail,
            });
            totalBytes += byteSize;
          }
        }
      } catch (e) {
        console.warn('[GmailScan] Failed to fetch attachment:', ref.filename, e);
      }
    }
    
    // Send to Gemini 3.1 Pro for AI analysis
    const aiResult = await analyzeWithAI(processedMessages, container.reeferNo, imageAttachments);
    
    // Format results for the UI
    const matchedDocs = {};
    if (aiResult?.matchedDocs) {
      for (const [key, doc] of Object.entries(aiResult.matchedDocs)) {
        if (doc.found) {
          const emailIdx = doc.emailIndex ?? 0;
          const sourceEmail = processedMessages[emailIdx] || processedMessages[0];
          matchedDocs[key] = {
            category: getCategoryForKey(key),
            confidence: doc.confidence || 'medium',
            reason: doc.reason || '',
            emails: sourceEmail ? [{
              id: sourceEmail.id,
              subject: sourceEmail.subject,
              from: sourceEmail.from,
              date: sourceEmail.date,
              snippet: sourceEmail.snippet,
              hasAttachments: sourceEmail.hasAttachments,
            }] : [],
          };
        }
      }
    }
    
    // Format vessel info
    const vesselInfo = {};
    if (aiResult?.vesselInfo) {
      for (const [key, value] of Object.entries(aiResult.vesselInfo)) {
        if (value && value !== 'null' && value !== null) {
          vesselInfo[key] = { value, source: 'AI analysis', date: 'latest' };
        }
      }
    }
    
    return {
      messages: processedMessages.map(m => ({
        id: m.id, threadId: m.threadId, subject: m.subject,
        from: m.from, date: m.date, snippet: m.snippet,
        hasAttachments: m.hasAttachments,
      })),
      matchedDocs,
      vesselInfo,
      totalFound: data.resultSizeEstimate || processedMessages.length,
      aiSummary: aiResult?.summary || null,
      imagesAnalyzed: imageAttachments.length,
    };
    
  } catch (err) {
    console.error('[GmailScan] Error:', err);
    return { messages: [], error: err.message };
  }
}

/**
 * Send emails + images to Gemini 3.1 Pro via the serverless API endpoint
 */
async function analyzeWithAI(emails, reeferNo, imageAttachments) {
    if (!emails || emails.length === 0) {
      return { matchedDocs: {}, vesselInfo: {}, summary: '' };
    }
    
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("Gemini API key missing on client");
      return null;
    }
    
    // Prepare Gemini payload
    const emailSummaries = emails.map((e, i) => 
        `--- Email ${i + 1} ---\nSubject: ${e.subject}\nFrom: ${e.from}\nDate: ${e.date}\nBody:\n${(e.bodyText || e.snippet || '').slice(0, 3000)}\n`
    ).join('\n');
    
    const systemPrompt = `You are an expert shipping documentation analyst for a banana export company (LAVC/LFJ) in the Philippines.
Analyze the following emails related to container/reefer number "${reeferNo}" and return a JSON response.

TASK 1 - DOCUMENT DETECTION:
For each email, determine if it contains or references any of these shipping documents. Use smart context understanding. Consider the email subject, body, and attached file names.
Pre-Departure Documents:
- "atwObtained": ATW (Authority to Withdraw) from shipping lines
- "atwUsed": ATW used to get container from Container Yard (CY)  
- "etradeRegistered": eTrade.net.ph registration or export declaration input
- "ciDone": Commercial Invoice (CI) from BIR
- "plDone": Packing List (PL)
- "lcuDone": Letter of Commitment and Undertaking (LCU)
- "phytoDone": Phytosanitary Certificate

Certificate of Origin (BOC) Attachments:
- "closedTicket": Closed Ticket / Booking Confirmation
- "ed": Export Declaration (ED)
- "bl": Bill of Lading (B/L)
- "ci": Commercial Invoice (CI) - final copy for BOC
- "pl": Packing List (PL) - final copy for BOC
- "ctcPhyto": CTC Phytosanitary (Certified True Copy)

TASK 2 - VESSEL & SHIPPING INFO EXTRACTION:
Extract the LATEST/MOST RECENT information for these fields (corrections and delays override earlier data):
- vesselName: Name of the vessel (e.g., MV PACIFIC GLORY)
- voyageNo: Voyage number
- eta: Estimated Time of Arrival (any format)
- etd: Estimated Time of Departure (any format)
- shippingLine: Carrier/shipping line name
- sealNo: Container seal number
- bookingNo: Booking reference number
TASK 3 - DETAILED CONTAINER ANALYSIS REPORT:
Generate a highly detailed, comprehensive analysis report regarding this specific container based on all available emails. Include context such as the full shipping timeline, any mentioned delays, outstanding invoices, port transfers, forwarder communications, missing paperwork, or any relevant supply chain context found. Format the summary cleanly using paragraphs and bullet points if necessary. EVEN IF YOU FIND NO DOCUMENTS, YOU MUST STILL WRITE A DETAILED SUMMARY OF WHAT IS HAPPENING IN THE EMAILS. DO NOT LEAVE THE SUMMARY BLANK.

Return ONLY valid JSON in this exact format. You must populate the "matchedDocs" object with a key for EVERY SINGLE document listed above. BE EXTREMELY AGGRESSIVE AND LENIENT: if a PDF is attached or the email says "SHIPPING DOCS" or "attached", flag the documents (bl, ci, pl, ed) as FOUND.
{
  "matchedDocs": {
    "atwObtained": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "reason": "brief reason" },
    "atwUsed": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "reason": "brief reason" },
    "etradeRegistered": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "reason": "brief reason" },
    "ciDone": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "reason": "brief reason" },
    "plDone": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "reason": "brief reason" },
    "lcuDone": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "reason": "brief reason" },
    "phytoDone": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "reason": "brief reason" },
    "closedTicket": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "reason": "brief reason" },
    "ed": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "reason": "brief reason" },
    "bl": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "reason": "brief reason" },
    "ci": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "reason": "brief reason" },
    "pl": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "reason": "brief reason" },
    "ctcPhyto": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "reason": "brief reason" }
  },
  "vesselInfo": {
    "vesselName": "value or null",
    "voyageNo": "value or null",
    "eta": "value or null",
    "etd": "value or null",
    "shippingLine": "value or null",
    "sealNo": "value or null",
    "bookingNo": "value or null",
    "portOfLoading": "value or null",
    "portOfDischarge": "value or null"
  },
  "summary": "WRITE YOUR COMPREHENSIVE, MULTI-PARAGRAPH DETAILED ANALYSIS HERE. Use standard text. You may use line breaks (\\n) and bullet points."
}`;

    const parts = [{ text: systemPrompt + '\n\nEMAILS:\n' + emailSummaries }];
    for (const img of imageAttachments) {
       parts.push({ inlineData: { mimeType: img.mimeType || 'image/jpeg', data: img.base64Data } });
       parts.push({ text: `[Attachment from email "${img.fromEmail || 'unknown'}": ${img.filename || 'unknown'}]` });
    }
    
    console.log('[GmailScan] Making direct call to Gemini API...');
    try {
      const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { maxOutputTokens: 4096, temperature: 0.1, responseMimeType: 'application/json' },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ]
        })
      });
      
      if (!gRes.ok) {
          const errText = await gRes.text();
          throw new Error('Gemini API HTTP Error: ' + errText);
      }
      
      const gData = await gRes.json();
      const text = gData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      let aiResult = { matchedDocs: {}, vesselInfo: {}, summary: '' };
      
      if (text) {
          try {
            aiResult = JSON.parse(text);
          } catch(e) {
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                try { 
                    aiResult = JSON.parse(match[0]); 
                } catch(err) {
                    aiResult.summary = `### ⚠️ AI Processing Failed\n\nThe AI successfully analyzed the 27 emails, but the generated report was too complex and failed to parse securely (JSON Parse Error). Please try scanning again.\n\nRaw Output Snippet: ${text.slice(0, 150)}...`;
                }
            } else {
                aiResult.summary = `### ⚠️ AI Format Error\n\nThe AI did not return a valid structured response format.`;
            }
          }
      } else {
          const finishReason = gData?.candidates?.[0]?.finishReason || 'UNKNOWN';
          console.warn('[GmailScan] Gemini returned empty response:', gData);
          aiResult.summary = `### ⚠️ AI Blocked by Safety Filters\n\nThe Google Gemini model successfully read your emails, but refused to output the data due to automatic Safety Blocks (\`${finishReason}\`). This often happens when scanning highly confidential documents with signatures, stamps, or specific foreign text. Please try bypassing the attachments manually.`;
      }
      
      return aiResult;

    } catch (apiErr) {
      console.error('[GmailScan] Direct Gemini fetch failed:', apiErr);
      return { 
        matchedDocs: {}, 
        vesselInfo: {}, 
        summary: `### ⚠️ AI Processing Failed\n\nThe AI encountered an error while analyzing the 27 emails. This happens if the email attachments exceeded data limits or the Google Gemini API rejected the PDF payloads.\n\n**Error Trace:**\n${apiErr.message}` 
      };
    }
}

/**
 * Map a document key to its category
 */
function getCategoryForKey(key) {
  const preDep = ['atwObtained', 'atwUsed', 'etradeRegistered', 'ciDone', 'plDone', 'lcuDone', 'phytoDone'];
  return preDep.includes(key) ? 'preDeparture' : 'certOfOrigin';
}

/**
 * Get a printable version of a specific Gmail message
 */
export async function getEmailHtmlForPrint(token, messageId) {
  try {
    const res = await fetch(
      `${GMAIL_API_BASE}/messages/${messageId}?format=full`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
    
    const msg = await res.json();
    const headers = msg.payload?.headers || [];
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
    
    let htmlBody = '';
    let plainBody = '';
    
    const extractBody = (part) => {
      if (part.mimeType === 'text/html' && part.body?.data) {
        htmlBody = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }
      if (part.mimeType === 'text/plain' && part.body?.data) {
        plainBody = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }
      if (part.parts) part.parts.forEach(extractBody);
    };
    
    extractBody(msg.payload || {});
    
    const emailContent = htmlBody || `<pre style="font-family: sans-serif; white-space: pre-wrap;">${plainBody || msg.snippet || 'No content'}</pre>`;
    
    return `
      <!DOCTYPE html>
      <html>
      <head><title>Email - ${getHeader('Subject')}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 2rem; color: #1e293b; }
        .email-header { border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; margin-bottom: 1.5rem; }
        .email-header h2 { margin: 0 0 0.5rem 0; color: #0f172a; }
        .email-meta { font-size: 0.9rem; color: #64748b; line-height: 1.8; }
        .email-body { line-height: 1.6; }
        @media print { body { margin: 1rem; } }
      </style>
      </head>
      <body>
        <div class="email-header">
          <h2>${getHeader('Subject')}</h2>
          <div class="email-meta">
            <div><strong>From:</strong> ${getHeader('From')}</div>
            <div><strong>To:</strong> ${getHeader('To')}</div>
            <div><strong>Date:</strong> ${getHeader('Date')}</div>
          </div>
        </div>
        <div class="email-body">${emailContent}</div>
      </body>
      </html>
    `;
  } catch (err) {
    console.error('[GmailPrint] Error:', err);
    return `<html><body><h2>Error loading email</h2><p>${err.message}</p></body></html>`;
  }
}

/**
 * Generate a comprehensive summary of the entire Gmail account/inbox
 * @param {string} token - Gmail OAuth token
 * @returns {Promise<string>} Markdown formatted report
 */
export async function generateInboxSummary(token) {
  if (!token) return 'No Gmail token provided.';
  
  try {
    const res = await fetch(`${GMAIL_API_BASE}/messages?maxResults=50`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    
    if (!data.messages) return 'No emails found in the inbox.';
    
    // Fetch snippets
    const emails = [];
    for (const msgData of data.messages) {
      try {
        const msgRes = await fetch(`${GMAIL_API_BASE}/messages/${msgData.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const m = await msgRes.json();
        const subject = m.payload?.headers?.find(h => h.name.toLowerCase() === 'subject')?.value || 'No Subject';
        const from = m.payload?.headers?.find(h => h.name.toLowerCase() === 'from')?.value || 'Unknown';
        emails.push(`- From: ${from} | Subject: ${subject} | Preview: ${m.snippet}`);
      } catch(e) {}
    }
    
    const emailSummaries = emails.join('\n');
    const systemPrompt = `You are a high-level Operations Intelligence AI for a banana export logistics company.
Read the following 50 most recent emails from the company inbox. 
Generate a comprehensive, executive-level "Inbox Activity Summary".
Highlight:
1. Urgent or pending actions required.
2. Status updates from forwarders/shipping lines.
3. Emerging issues or delays mentioned across any containers.
4. General volume or flow of documentation currently happening.

Format neatly using markdown, headers, and bullet points. Do NOT output JSON. Output ONLY the markdown report.`;

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const parts = [{ text: systemPrompt + '\n\nRECENT INBOX EMAILS:\n' + emailSummaries }];
    
    const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { maxOutputTokens: 4096, temperature: 0.3 },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      })
    });
    
    if (!gRes.ok) throw new Error('Gemini API Error');
    const gData = await gRes.json();
    return gData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Failed to generate summary.';
    
  } catch (err) {
    console.error('Inbox Summary Error:', err);
    return 'Error generating inbox summary: ' + err.message;
  }
}
