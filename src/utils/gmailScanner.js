/**
 * Gmail Scanner Utility for Shipping Docs
 * Uses Gemini 3.1 Pro with vision to intelligently analyze emails and image attachments
 * for shipping document detection and vessel info extraction.
 */

import { supabase } from '../supabaseClient';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

function getCategoryForKey(key) {
  const preDeparture = ['atwObtained', 'atwUsed', 'etradeRegistered', 'ciDone', 'plDone', 'lcuDone', 'phytoDone'];
  if (preDeparture.includes(key)) return 'Pre-Departure';
  return 'Certificate of Origin';
}

/**
 * Search local Supabase DB for emails related to a specific container, then analyze with AI
 */
export async function searchGmailForContainer(token, container, customQuery = null) {
  if (!container) return { messages: [], error: 'Missing container data' };
  
  try {
    let queryTerms = [];
    
    if (customQuery && customQuery.trim() !== '') {
        queryTerms.push(customQuery.trim());
    } else {
        if (container.reeferNo) {
            queryTerms.push(container.reeferNo.replace(/[^A-Za-z0-9\s]/g, ''));
            const clean = container.reeferNo.replace(/[^A-Za-z0-9]/g, '');
            if (clean.length > 4) queryTerms.push(clean);
        }
        const bookingNo = (container.bookingno || container.bookingNo || '').trim();
        if (bookingNo) queryTerms.push(bookingNo);
        
        const reeferName = (container.reeferName || '').trim();
        const poisonLines = ['cosco', 'sitc', 'oocl', 'evergreen', 'msc', 'cma', 'wanhai', 'maersk', 'yangming', 'hmm', 'zim', 'one'];
        if (reeferName && !poisonLines.includes(reeferName.toLowerCase())) {
            queryTerms.push(reeferName);
        }
        
        const voyageStr = (container.voyageNo || '').trim().replace(/\t/g, ' ');
        if (voyageStr) {
            const vesselOnly = voyageStr.split(' ').filter(w => !/\d/.test(w)).join(' ').trim();
            if (vesselOnly && vesselOnly.length > 3) queryTerms.push(vesselOnly);
            else queryTerms.push(voyageStr);
        }
    }
    
    queryTerms = queryTerms.filter(Boolean);
    if (queryTerms.length === 0) return { messages: [], matchedDocs: {}, vesselInfo: {}, totalFound: 0 };
    
    // Build SQL ILIKE queries dynamically
    let orQuery = queryTerms.map(t => `body_text.ilike.%${t}%`).join(',');
    let orSubjectQuery = queryTerms.map(t => `subject.ilike.%${t}%`).join(',');

    const { data: emails, error: dbErr } = await supabase
        .from('shipping_emails')
        .select('id, message_id, subject, sender, email_date, snippet, body_text')
        .or(`${orQuery},${orSubjectQuery}`)
        .order('email_date', { ascending: false })
        .limit(40);

    if (dbErr) throw dbErr;

    if (!emails || emails.length === 0) {
      return { messages: [], matchedDocs: {}, vesselInfo: {}, totalFound: 0 };
    }

    const processedMessages = [];
    const imageAttachments = [];

    const emailIds = emails.map(e => e.id);
    const { data: rawAttachments } = await supabase
        .from('email_attachments')
        .select('*')
        .in('email_id', emailIds);
        
    const attachmentsByEmail = {};
    if (rawAttachments) {
       for (const att of rawAttachments) {
           if (!attachmentsByEmail[att.email_id]) attachmentsByEmail[att.email_id] = [];
           attachmentsByEmail[att.email_id].push(att);
       }
    }

    // Format for Gemini
    for (const msg of emails) {
       const atts = attachmentsByEmail[msg.id] || [];
       processedMessages.push({
        id: msg.message_id,
        threadId: msg.message_id,
        subject: msg.subject,
        from: msg.sender,
        date: msg.email_date,
        timestamp: new Date(msg.email_date).getTime(),
        snippet: msg.snippet || '',
        bodyText: (msg.body_text || '').slice(0, 4000), // Limit for AI context
        hasAttachments: atts.length > 0,
        attachmentCount: atts.length,
        attachmentRefs: atts.map(a => ({
           id: a.id,
           filename: a.filename,
           mimeType: a.mime_type,
           isPdf: a.mime_type === 'application/pdf' || /\.pdf$/i.test(a.filename),
           isImage: (a.mime_type || '').startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(a.filename),
           storagePath: a.storage_path
        })),
      });
    }

    processedMessages.sort((a, b) => b.timestamp - a.timestamp);

    const rawRefs = processedMessages.flatMap(m => 
      m.attachmentRefs.filter(a => a.isImage || a.isPdf).map(a => ({ ...a, fromEmail: m.subject }))
    );
    
    rawRefs.sort((a, b) => {
        const aName = (a.filename || '').toLowerCase();
        const bName = (b.filename || '').toLowerCase();
        const aIsKey = aName.includes('bl') || aName.includes('bill') || aName.includes('invoice') || aName.includes('ci') || aName.includes('pl') || aName.includes('packing') || aName.includes('atw') || aName.includes('ed');
        const bIsKey = bName.includes('bl') || bName.includes('bill') || bName.includes('invoice') || bName.includes('ci') || bName.includes('pl') || bName.includes('packing') || bName.includes('atw') || bName.includes('ed');
        
        if (aIsKey && !bIsKey) return -1;
        if (!aIsKey && bIsKey) return 1;
        if (a.isPdf && !b.isPdf) return -1;
        if (!a.isPdf && b.isPdf) return 1;
        return 0;
    });

    const priorityRefs = rawRefs.slice(0, 10);

    let totalBytes = 0;
    for (const ref of priorityRefs) {
      if (totalBytes > 3800000) {
          console.warn('[DBScan] Reached Vercel 4.5MB payload limit, skipping remaining attachments.');
          break;
      }
      try {
        const { data: fileBlob, error: dlErr } = await supabase.storage.from('shipping_documents').download(ref.storagePath);
        if (fileBlob) {
            const buffer = await fileBlob.arrayBuffer();
            const base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(fileBlob);
            });
            const byteSize = base64Data.length * 0.75;
            if (totalBytes + byteSize > 3800000) break;
            
            imageAttachments.push({
               base64Data,
               mimeType: ref.mimeType || 'application/pdf',
               filename: ref.filename,
               fromEmail: ref.fromEmail,
               storageUrl: supabase.storage.from('shipping_documents').getPublicUrl(ref.storagePath).data.publicUrl
            });
            totalBytes += byteSize;
        }
      } catch (e) {
        console.warn('[DBScan] Failed to download attachment from Supabase', e);
      }
    }

    const aiResult = await analyzeWithAI(processedMessages, container.reeferNo, imageAttachments);

    const matchedDocs = {};
    if (aiResult?.matchedDocs) {
      for (const [key, doc] of Object.entries(aiResult.matchedDocs)) {
        let isFound = false;
        let cfd = 'medium';
        let reason = '';
        let eIdx = 0;
        let attachName = '';

        if (typeof doc === 'boolean') {
            isFound = doc;
        } else if (typeof doc === 'string') {
            isFound = doc.toLowerCase() === 'true';
        } else if (typeof doc === 'object' && doc !== null) {
            isFound = doc.found === true || doc.found === 'true';
            cfd = doc.confidence || 'medium';
            reason = doc.reason || '';
            eIdx = doc.emailIndex ?? 0;
            attachName = doc.attachmentFilename || '';
        }

        if (isFound) {
          const sourceEmail = processedMessages[eIdx] || processedMessages[0];
          
          let matchedUrl = null;
          if (attachName && sourceEmail?.attachmentRefs) {
             const ref = sourceEmail.attachmentRefs.find(r => r.filename.toLowerCase() === attachName.toLowerCase());
             if (ref) matchedUrl = supabase.storage.from('shipping_documents').getPublicUrl(ref.storagePath).data.publicUrl;
          }
          if (!matchedUrl && imageAttachments.length > 0 && sourceEmail?.hasAttachments) {
              const posImg = imageAttachments.find(i => i.fromEmail === sourceEmail.subject);
              if (posImg) matchedUrl = posImg.storageUrl;
          }
          
          matchedDocs[key] = {
            category: getCategoryForKey(key),
            confidence: cfd,
            reason: reason || 'AI identified shipping reference',
            attachmentUrl: matchedUrl,
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
      totalFound: processedMessages.length,
      aiSummary: aiResult?.summary || null,
      imagesAnalyzed: imageAttachments.length,
    };
    
  } catch (err) {
    console.error('[DBScan] Error:', err);
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
    "atwObtained": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "attachmentFilename": "exact_filename.pdf_if_referenced", "reason": "brief reason" },
    "atwUsed": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "attachmentFilename": "exact_filename.pdf_if_referenced", "reason": "brief reason" },
    "etradeRegistered": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "attachmentFilename": "exact_filename.pdf_if_referenced", "reason": "brief reason" },
    "ciDone": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "attachmentFilename": "exact_filename.pdf_if_referenced", "reason": "brief reason" },
    "plDone": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "attachmentFilename": "exact_filename.pdf_if_referenced", "reason": "brief reason" },
    "lcuDone": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "attachmentFilename": "exact_filename.pdf_if_referenced", "reason": "brief reason" },
    "phytoDone": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "attachmentFilename": "exact_filename.pdf_if_referenced", "reason": "brief reason" },
    "closedTicket": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "attachmentFilename": "exact_filename.pdf_if_referenced", "reason": "brief reason" },
    "ed": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "attachmentFilename": "exact_filename.pdf_if_referenced", "reason": "brief reason" },
    "bl": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "attachmentFilename": "exact_filename.pdf_if_referenced", "reason": "brief reason" },
    "ci": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "attachmentFilename": "exact_filename.pdf_if_referenced", "reason": "brief reason" },
    "pl": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "attachmentFilename": "exact_filename.pdf_if_referenced", "reason": "brief reason" },
    "ctcPhyto": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "attachmentFilename": "exact_filename.pdf_if_referenced", "reason": "brief reason" }
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
                    aiResult.summary = `### ⚠️ AI Processing Failed\n\nThe AI successfully analyzed the emails, but the generated report was too complex and failed to parse securely (JSON Parse Error). Please try scanning again.\n\nRaw Output Snippet: ${text.slice(0, 150)}...`;
                }
            } else {
                aiResult.summary = `### ⚠️ AI Format Error\n\nThe AI did not return a valid structured response format.`;
            }
          }
      } else {
          const finishReason = gData?.candidates?.[0]?.finishReason || 'UNKNOWN';
          console.warn('[GmailScan] Gemini returned empty response:', gData);
          aiResult.summary = `### ⚠️ AI Blocked by Safety Filters\n\nThe Google Gemini model successfully read your database records, but refused to output the data due to automatic Safety Blocks (\`${finishReason}\`).`;
      }
      
      return aiResult;

    } catch (apiErr) {
      console.error('[GmailScan] Direct Gemini fetch failed:', apiErr);
      return { 
        matchedDocs: {}, 
        vesselInfo: {}, 
        summary: `### ⚠️ AI Processing Failed\n\nThe AI encountered an error while analyzing the DB records.\n\n**Error Trace:**\n${apiErr.message}` 
      };
    }
}

export async function getEmailHtmlForPrint(token, messageId) {
    return "Not implemented for DB offline storage yet. You can view attachments in Supabase directly.";
}

export async function generateInboxSummary(token) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return 'API token missing.';
  
  try {
    const { data: emails } = await supabase.from('shipping_emails').select('*').order('email_date', { ascending: false }).limit(20);
    if (!emails || emails.length === 0) return 'No emails synced yet to summarize.';
    
    const textBlob = emails.map(m => `SUBJ: ${m.subject}\nFROM: ${m.sender}\nSNIPPET: ${m.snippet}\n`).join('---\n');
    
    const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [
            { text: "Write an urgent executive summary of the following top emails from the logistics inbox:\n\n" + textBlob }
        ]}],
        generationConfig: { maxOutputTokens: 2000, temperature: 0.3 }
      })
    });
    const gData = await gRes.json();
    return gData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Failed to generate summary.';
  } catch (err) {
    return 'Error generating summary: ' + err.message;
  }
}

export function getEmailBody(payload) {
    let bodyText = '';
    const extractParts = (part) => {
        if (part.mimeType === 'text/plain' && part.body?.data) {
            try { bodyText += atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/')); } catch(e) {}
        }
        if (part.mimeType === 'text/html' && !bodyText && part.body?.data) {
            try {
                let html = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                bodyText += html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
            } catch(e) {}
        }
        if (part.parts) part.parts.forEach(extractParts);
    };
    extractParts(payload || {});
    return bodyText;
}