const fs = require('fs');

let content = fs.readFileSync('src/utils/gmailScanner.js', 'utf8');

if (!content.includes("import { supabase }")) {
    content = "import { supabase } from '../supabaseClient';\n" + content;
}

const newFunction = `
export async function searchGmailForContainer(token, container, customQuery = null) {
  if (!container) return { messages: [], error: 'Missing container data' };
  
  try {
    let queryTerms = [];
    
    if (customQuery && customQuery.trim() !== '') {
        queryTerms.push(customQuery.trim());
    } else {
        if (container.reeferNo) {
            queryTerms.push(container.reeferNo.replace(/[^A-Za-z0-9\\s]/g, ''));
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
        
        const voyageStr = (container.voyageNo || '').trim().replace(/\\t/g, ' ');
        if (voyageStr) {
            const vesselOnly = voyageStr.split(' ').filter(w => !/\\d/.test(w)).join(' ').trim();
            if (vesselOnly && vesselOnly.length > 3) queryTerms.push(vesselOnly);
            else queryTerms.push(voyageStr);
        }
    }
    
    queryTerms = queryTerms.filter(Boolean);
    if (queryTerms.length === 0) return { messages: [], matchedDocs: {}, vesselInfo: {}, totalFound: 0 };
    
    // Build SQL ILIKE queries dynamically
    let orQuery = queryTerms.map(t => \`body_text.ilike.%$\{t}%\`).join(',');
    let orSubjectQuery = queryTerms.map(t => \`subject.ilike.%$\{t}%\`).join(',');

    const { data: emails, error: dbErr } = await supabase
        .from('shipping_emails')
        .select('id, message_id, subject, sender, email_date, snippet, body_text')
        .or(\`$\{orQuery},$\{orSubjectQuery}\`)
        .order('email_date', { ascending: false })
        .limit(40);

    if (dbErr) throw dbErr;

    if (!emails || emails.length === 0) {
      return { messages: [], matchedDocs: {}, vesselInfo: {}, totalFound: 0 };
    }

    const processedMessages = [];
    const imageAttachments = [];

    // Fetch attachments manually due to PostgREST subquery limits or just simplicity
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
        threadId: msg.message_id, // fallback
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
           isPdf: a.mime_type === 'application/pdf' || /\\.pdf$/i.test(a.filename),
           isImage: (a.mime_type || '').startsWith('image/') || /\\.(jpg|jpeg|png|gif|webp)$/i.test(a.filename),
           storagePath: a.storage_path
        })),
      });
    }

    // Process attachments to send to Gemini Vision (via base64 download from Supabase)
    const rawRefs = processedMessages.flatMap(m => 
      m.attachmentRefs.filter(a => a.isImage || a.isPdf).map(a => ({ ...a, fromEmail: m.subject }))
    );
    
    // Prioritize PDF/docs over standard images
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
            const base64Data = Buffer.from(buffer).toString('base64');
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

    // Send to Gemini 3.1 Pro for AI analysis
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
          if (attachName && sourceEmail.attachmentRefs) {
             const ref = sourceEmail.attachmentRefs.find(r => r.filename.toLowerCase() === attachName.toLowerCase());
             if (ref) matchedUrl = supabase.storage.from('shipping_documents').getPublicUrl(ref.storagePath).data.publicUrl;
          }
          // fallback link if not found perfectly but there's a priority ref
          if (!matchedUrl && imageAttachments.length > 0 && sourceEmail.hasAttachments) {
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
      totalFound: processedMessages.length,
      aiSummary: aiResult?.summary || null,
      imagesAnalyzed: imageAttachments.length,
    };
    
  } catch (err) {
    console.error('[DBScan] Error:', err);
    return { messages: [], error: err.message };
  }
}
`;

// Extract export async function searchGmailForContainer... up to the end of the function body.
const startRegex = /export async function searchGmailForContainer[^\{]+\{/;
const startIndex = content.search(startRegex);
if (startIndex !== -1) {
    // Find the matching closing brace for the function
    let openBraces = 0;
    let i = content.indexOf('{', startIndex);
    openBraces = 1;
    let endIndex = -1;
    for (i = i + 1; i < content.length; i++) {
        if (content[i] === '{') openBraces++;
        if (content[i] === '}') {
            openBraces--;
            if (openBraces === 0) {
                endIndex = i;
                break;
            }
        }
    }
    
    if (endIndex !== -1) {
        content = content.substring(0, startIndex) + newFunction + content.substring(endIndex + 1);
        
        // Also modify the analyzeWithAI prompt heavily so Gemini knows to output attachmentFilename
        const promptAddition = \` "attachmentFilename": "If you looked at a specific file from imageAttachments or email inline to verify this document, output the EXACT filename here.", \`;
        content = content.replace(/"emailIndex": "Index of the email \(0-N\)....",/, '"emailIndex": "Index of the email (0-N).... ",' + promptAddition);
        
        fs.writeFileSync('src/utils/gmailScanner.js', content);
        console.log("Successfully replaced searching module.");
    } else {
        console.log("Failed to find end of function.");
    }
} else {
    console.log("Failed to find start of function.");
}
