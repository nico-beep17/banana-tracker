/**
 * Gmail Scanner Utility for Shipping Docs
 * Scans the company Gmail inbox for emails related to container/reefer numbers
 * and maps them to shipping document checklist items.
 */

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

// Keyword patterns that map email content to checklist items
// Each entry: { checklistKey, category, searchTerms[], subjectPatterns[] }
const DOC_KEYWORD_MAP = [
  // Pre-Departure Documents
  { key: 'atwObtained', category: 'preDeparture', 
    searchTerms: ['ATW', 'authority to withdraw', 'withdraw container'],
    subjectPatterns: [/\batw\b/i, /authority.*withdraw/i] },
  
  { key: 'atwUsed', category: 'preDeparture',
    searchTerms: ['container yard', 'CY release', 'pick up container', 'container release'],
    subjectPatterns: [/\bcy\b.*release/i, /pick.*up.*container/i, /container.*release/i] },
  
  { key: 'etradeRegistered', category: 'preDeparture',
    searchTerms: ['eTrade', 'etrade.net.ph', 'export declaration registration'],
    subjectPatterns: [/etrade/i, /export.*registration/i] },
  
  { key: 'ciDone', category: 'preDeparture',
    searchTerms: ['commercial invoice', 'CI BIR', 'invoice'],
    subjectPatterns: [/commercial\s*invoice/i, /\bCI\b/] },
  
  { key: 'plDone', category: 'preDeparture',
    searchTerms: ['packing list', 'packing-list'],
    subjectPatterns: [/packing\s*list/i, /\bPL\b/] },
  
  { key: 'lcuDone', category: 'preDeparture',
    searchTerms: ['letter of commitment', 'LCU', 'undertaking'],
    subjectPatterns: [/letter.*commitment/i, /\blcu\b/i, /undertaking/i] },
  
  { key: 'phytoDone', category: 'preDeparture',
    searchTerms: ['phytosanitary', 'phyto certificate', 'plant quarantine'],
    subjectPatterns: [/phyto/i, /plant.*quarantine/i] },

  // Certificate of Origin (BOC) Attachments
  { key: 'closedTicket', category: 'certOfOrigin',
    searchTerms: ['closed ticket', 'booking confirmation', 'booking confirmed'],
    subjectPatterns: [/closed\s*ticket/i, /booking\s*(confirm|close)/i] },
  
  { key: 'ed', category: 'certOfOrigin',
    searchTerms: ['export declaration', 'ED approved', 'customs declaration'],
    subjectPatterns: [/export\s*declaration/i, /\bED\b.*approv/i] },
  
  { key: 'bl', category: 'certOfOrigin',
    searchTerms: ['bill of lading', 'B/L', 'BL draft', 'ocean bill'],
    subjectPatterns: [/bill.*lading/i, /\bB\/L\b/i, /\bBL\b.*draft/i] },
  
  { key: 'ci', category: 'certOfOrigin',
    searchTerms: ['commercial invoice', 'CI final'],
    subjectPatterns: [/commercial\s*invoice/i, /\bCI\b.*final/i] },
  
  { key: 'pl', category: 'certOfOrigin',
    searchTerms: ['packing list', 'PL final'],
    subjectPatterns: [/packing\s*list/i, /\bPL\b.*final/i] },
  
  { key: 'ctcPhyto', category: 'certOfOrigin',
    searchTerms: ['CTC phyto', 'certified true copy', 'CTC PHYTO'],
    subjectPatterns: [/ctc.*phyto/i, /certified.*true.*copy/i] },
];

// Vessel/container info patterns to extract from email bodies
const VESSEL_PATTERNS = {
  vesselName: [/vessel\s*(?:name)?\s*[:=]?\s*([A-Z][A-Z\s\-\.]{2,30})/i, /(?:MV|M\/V|VS|V\.)\s+([A-Z][A-Z\s\-\.]{2,30})/i],
  voyageNo: [/voyage\s*(?:no|number|#)?\s*[:=]?\s*([A-Z0-9\-\/]{3,20})/i, /voy(?:age)?\.?\s*[:=]?\s*([A-Z0-9\-\/]{3,20})/i],
  eta: [/eta\s*[:=]?\s*(\d{1,2}[\-\/]\w{3,9}[\-\/]\d{2,4})/i, /arrival\s*(?:date)?\s*[:=]?\s*(\d{1,2}[\-\/]\w{3,9}[\-\/]\d{2,4})/i],
  etd: [/etd\s*[:=]?\s*(\d{1,2}[\-\/]\w{3,9}[\-\/]\d{2,4})/i, /departure\s*(?:date)?\s*[:=]?\s*(\d{1,2}[\-\/]\w{3,9}[\-\/]\d{2,4})/i],
  shippingLine: [/(?:shipping\s*line|carrier|line)\s*[:=]?\s*([A-Z][A-Za-z\s]{2,25})/i],
  sealNo: [/seal\s*(?:no|number|#)?\s*[:=]?\s*([A-Z0-9]{5,20})/i],
};

/**
 * Search Gmail for emails related to a specific container
 * @param {string} token - Gmail OAuth access token
 * @param {string} reeferNo - Container/reefer number to search for
 * @returns {Promise<{messages: Array, error?: string}>}
 */
export async function searchGmailForContainer(token, reeferNo) {
  if (!token || !reeferNo) return { messages: [], error: 'Missing token or reefer number' };
  
  try {
    // Search for emails containing the reefer number
    const query = encodeURIComponent(`"${reeferNo}"`);
    const res = await fetch(
      `${GMAIL_API_BASE}/messages?q=${query}&maxResults=30`,
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
      return { messages: [], matchedDocs: {}, vesselInfo: {} };
    }
    
    // Fetch each message's metadata (subject, from, date, snippet)
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
    
    // Process each message
    const processedMessages = validMessages.map(msg => {
      const headers = msg.payload?.headers || [];
      const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
      
      // Decode body text (handle multipart)
      let bodyText = '';
      try {
        if (msg.payload?.body?.data) {
          bodyText = atob(msg.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        } else if (msg.payload?.parts) {
          const textPart = msg.payload.parts.find(p => p.mimeType === 'text/plain') ||
                           msg.payload.parts.find(p => p.mimeType === 'text/html');
          if (textPart?.body?.data) {
            bodyText = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          }
        }
      } catch (e) {
        bodyText = msg.snippet || '';
      }
      
      // Strip HTML tags for pattern matching
      bodyText = bodyText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      
      return {
        id: msg.id,
        threadId: msg.threadId,
        subject: getHeader('Subject'),
        from: getHeader('From'),
        date: getHeader('Date'),
        snippet: msg.snippet || '',
        bodyText,
        hasAttachments: (msg.payload?.parts || []).some(p => p.filename && p.filename.length > 0),
      };
    });
    
    // Match emails to checklist items
    const matchedDocs = {};
    for (const docDef of DOC_KEYWORD_MAP) {
      for (const email of processedMessages) {
        const textToSearch = `${email.subject} ${email.snippet} ${email.bodyText}`.toLowerCase();
        const subjectText = email.subject || '';
        
        // Check keyword terms
        const keywordMatch = docDef.searchTerms.some(term => 
          textToSearch.includes(term.toLowerCase())
        );
        
        // Check subject regex patterns
        const patternMatch = docDef.subjectPatterns.some(pattern => 
          pattern.test(subjectText) || pattern.test(email.bodyText)
        );
        
        if (keywordMatch || patternMatch) {
          if (!matchedDocs[docDef.key]) {
            matchedDocs[docDef.key] = {
              category: docDef.category,
              emails: []
            };
          }
          // Avoid duplicates
          if (!matchedDocs[docDef.key].emails.find(e => e.id === email.id)) {
            matchedDocs[docDef.key].emails.push({
              id: email.id,
              subject: email.subject,
              from: email.from,
              date: email.date,
              snippet: email.snippet,
              hasAttachments: email.hasAttachments,
            });
          }
        }
      }
    }
    
    // Extract vessel/container info from all emails
    const vesselInfo = {};
    for (const email of processedMessages) {
      const fullText = `${email.subject} ${email.bodyText}`;
      for (const [field, patterns] of Object.entries(VESSEL_PATTERNS)) {
        if (vesselInfo[field]) continue; // Already found
        for (const pattern of patterns) {
          const match = fullText.match(pattern);
          if (match && match[1]) {
            vesselInfo[field] = match[1].trim();
            break;
          }
        }
      }
    }
    
    return {
      messages: processedMessages,
      matchedDocs,
      vesselInfo,
      totalFound: data.resultSizeEstimate || processedMessages.length,
    };
    
  } catch (err) {
    console.error('[GmailScan] Error:', err);
    return { messages: [], error: err.message };
  }
}

/**
 * Get a printable version of a specific Gmail message
 * @param {string} token - Gmail OAuth access token
 * @param {string} messageId - Gmail message ID
 * @returns {Promise<string>} - HTML content of the email
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
    
    // Try to get HTML body
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
