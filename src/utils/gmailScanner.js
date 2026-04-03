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
            terms.push(`"${container.reeferNo}"`);
            // Add stripped version for fuzzy format matching e.g. GMOU 903627 4 -> GMOU9036274
            const clean = container.reeferNo.replace(/[^A-Za-z0-9]/g, '');
            if (clean.length > 4) terms.push(`"${clean}"`);
        }
        if (container.bookingNo) terms.push(`"${container.bookingNo}"`);
        if (container.reeferName) terms.push(`"${container.reeferName}"`);
        if (container.voyageNo) terms.push(`"${container.voyageNo}"`);
        // Add brand and destination as general text keywords
        if (container.brand) terms.push(`"${container.brand}"`);
        if (container.destination) terms.push(`"${container.destination}"`);
        
        // Combine terms with an OR operator so we match ANY of them.
        queryStr = terms.length > 0 ? `(${terms.join(' OR ')})` : '';
    }
    
    // Search in everywhere (inbox, sent, etc.) up to 40 results to find the most relevant context.
    const q = encodeURIComponent(`in:anywhere ${queryStr}`);
    
    const res = await fetch(
      `${GMAIL_API_BASE}/messages?q=${q}&maxResults=40`,
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
      data.messages.slice(0, 20).map(async (msg) => {
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
    
    // Fetch image attachments for AI vision (limit to 8 to stay within API limits)
    const allAttachmentRefs = processedMessages.flatMap(m => 
      m.attachmentRefs.filter(a => a.isImage).map(a => ({ ...a, fromEmail: m.subject }))
    ).slice(0, 8);
    
    for (const ref of allAttachmentRefs) {
      try {
        const attRes = await fetch(
          `${GMAIL_API_BASE}/messages/${ref.messageId}/attachments/${ref.attachmentId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (attRes.ok) {
          const attData = await attRes.json();
          if (attData.data) {
            imageAttachments.push({
              base64Data: attData.data.replace(/-/g, '+').replace(/_/g, '/'),
              mimeType: ref.mimeType || 'image/jpeg',
              filename: ref.filename,
              fromEmail: ref.fromEmail,
            });
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
  try {
    // Determine API base URL
    const baseUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:5173' 
      : window.location.origin;
    
    const payload = {
      reeferNo,
      emails: emails.map(e => ({
        subject: e.subject,
        from: e.from,
        date: e.date,
        bodyText: e.bodyText,
        snippet: e.snippet,
        hasAttachments: e.hasAttachments,
        attachmentCount: e.attachmentCount,
      })),
      imageAttachments: imageAttachments.map(img => ({
        base64Data: img.base64Data,
        mimeType: img.mimeType,
        filename: img.filename,
        fromEmail: img.fromEmail,
      })),
    };
    
    const res = await fetch(`${baseUrl}/api/scan-emails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[AI Scan] Server error:', err);
      return null;
    }
    
    return await res.json();
  } catch (err) {
    console.error('[AI Scan] Failed to analyze:', err);
    return null;
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
