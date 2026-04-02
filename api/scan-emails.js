export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { emails, reeferNo, imageAttachments } = req.body;
    if (!emails || !reeferNo) {
        return res.status(400).json({ error: 'Missing emails or reeferNo in request body.' });
    }

    const apiKey = process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Gemini API key not configured.' });
    }

    const model = 'gemini-3.1-pro';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Build the prompt with all email data
    const emailSummaries = emails.map((e, i) => 
        `--- Email ${i + 1} ---\nSubject: ${e.subject}\nFrom: ${e.from}\nDate: ${e.date}\nBody:\n${(e.bodyText || e.snippet || '').slice(0, 3000)}\n`
    ).join('\n');

    const systemPrompt = `You are an expert shipping documentation analyst for a banana export company (LAVC/LFJ) in the Philippines.

Analyze the following emails related to container/reefer number "${reeferNo}" and return a JSON response.

TASK 1 - DOCUMENT DETECTION:
For each email, determine if it contains or references any of these shipping documents. Use smart context understanding (not just keyword matching). Consider the email subject, body, attached file names, and context clues:

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
- eta: Estimated Time of Arrival (any date format)
- etd: Estimated Time of Departure (any date format)
- shippingLine: Carrier/shipping line name (e.g., COSCO, EVERGREEN, ONE)
- sealNo: Container seal number
- bookingNo: Booking reference number
- portOfLoading: Port of loading
- portOfDischarge: Port of discharge/destination port

IMPORTANT: If an email mentions a DELAY, CHANGE, or AMENDMENT to vessel/ETA/ETD, use the UPDATED information, not the original.

Return ONLY valid JSON in this exact format:
{
  "matchedDocs": {
    "atwObtained": { "found": true/false, "confidence": "high/medium/low", "emailIndex": 0, "reason": "brief reason" },
    ...repeat for all document keys
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
  "summary": "1-2 sentence summary of document completion status"
}`;

    // Build content parts — text + any image attachments
    const parts = [{ text: systemPrompt + '\n\nEMAILS:\n' + emailSummaries }];

    // Add image attachments for vision analysis (e.g., scanned docs, photos of certificates)
    if (imageAttachments && imageAttachments.length > 0) {
        for (const img of imageAttachments.slice(0, 10)) { // Max 10 images
            parts.push({
                inlineData: {
                    mimeType: img.mimeType || 'image/jpeg',
                    data: img.base64Data
                }
            });
            parts.push({
                text: `[Image attachment from email "${img.fromEmail || 'unknown'}" - filename: ${img.filename || 'unknown'}. Analyze this image for shipping document content.]`
            });
        }
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts }],
                generationConfig: {
                    maxOutputTokens: 4096,
                    temperature: 0.1,
                    responseMimeType: 'application/json',
                },
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.error('[AI Scan] Gemini error:', err);
            return res.status(response.status).json({ error: err?.error?.message || 'Gemini API error' });
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        
        if (!text) {
            return res.status(200).json({ error: 'Empty response from Gemini' });
        }

        try {
            const parsed = JSON.parse(text);
            return res.status(200).json(parsed);
        } catch (e) {
            // Try to extract JSON from the response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return res.status(200).json(JSON.parse(jsonMatch[0]));
            }
            return res.status(200).json({ rawText: text, error: 'Failed to parse AI response' });
        }
    } catch (err) {
        console.error('[AI Scan] Error:', err);
        return res.status(500).json({ error: err.message });
    }
}
