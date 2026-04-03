import { createClient } from '@supabase/supabase-js';

export const config = {
    maxDuration: 60, // Vercel Cron needs more time (Pro allows up to 300s, Hobby 10s. Default is 10s in Hobby but let's request 60s)
};

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Secure the cron route using Vercel CRON Secret (if environment provides it)
    const authHeader = req.headers.authorization;
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized CRON request' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: 'Supabase credentials missing' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the persistent refresh token
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const clientId = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!refreshToken || !clientId || !clientSecret) {
        return res.status(500).json({ 
            error: 'Google OAuth variables (GOOGLE_REFRESH_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) missing.' 
        });
    }

    let accessToken = '';
    try {
        // Exchange refresh token for an active access token
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            })
        });

        if (!tokenRes.ok) {
            const err = await tokenRes.text();
            console.error('[CRON] Token refresh failed:', err);
            return res.status(500).json({ error: 'Failed to refresh Google token' });
        }

        const tokenData = await tokenRes.json();
        accessToken = tokenData.access_token;
    } catch (e) {
        return res.status(500).json({ error: 'Error exchanging refresh token', details: e.message });
    }

    // --- Execute Sync Logic securely on the Server ---
    const GMAIL_API_BASE = 'https://www.googleapis.com/gmail/v1/users/me';
    let syncedCount = 0;

    try {
        const listRes = await fetch(`${GMAIL_API_BASE}/messages?maxResults=50`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (!listRes.ok) throw new Error("Failed to fetch Gmail list");
        const listData = await listRes.json();
        const messageIds = (listData.messages || []).map(m => m.id);

        if (messageIds.length === 0) {
            return res.status(200).json({ status: 'Success', synced: 0, message: 'No new emails' });
        }

        const { data: existing } = await supabase.from('shipping_emails').select('message_id').in('message_id', messageIds);
        const existingSt = new Set((existing || []).map(e => e.message_id));
        const toSync = messageIds.filter(id => !existingSt.has(id));

        if (toSync.length === 0) {
            return res.status(200).json({ status: 'Success', synced: 0, message: 'All emails already synced' });
        }

        for (const msgId of toSync) {
            const msgRes = await fetch(`${GMAIL_API_BASE}/messages/${msgId}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            const msgData = await msgRes.json();

            const headers = msgData.payload?.headers || [];
            const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
            const from = headers.find(h => h.name === 'From')?.value || 'Unknown Server';
            const dateStr = headers.find(h => h.name === 'Date')?.value || new Date().toISOString();
            
            // Extract body manually without importing front-end only modules
            let bodyText = '';
            const extractParts = (part) => {
                if (part.mimeType === 'text/plain' && part.body?.data) {
                    try { bodyText += Buffer.from(part.body.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); } catch(e) {}
                }
                if (part.mimeType === 'text/html' && !bodyText && part.body?.data) {
                    try {
                        let html = Buffer.from(part.body.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
                        bodyText += html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
                    } catch(e) {}
                }
                if (part.parts) part.parts.forEach(extractParts);
            };
            extractParts(msgData.payload || {});

            const { data: emailRecord, error: emailErr } = await supabase
                .from('shipping_emails')
                .insert([{
                    message_id: msgId,
                    subject: subject,
                    sender: from,
                    email_date: new Date(dateStr).toISOString(),
                    snippet: msgData.snippet || '',
                    body_text: bodyText
                }])
                .select()
                .single();

            if (emailErr || !emailRecord) continue;

            const parts = [];
            const gatherParts = (p) => {
               if (p.filename && p.body?.attachmentId) parts.push(p);
               if (p.parts) p.parts.forEach(gatherParts);
            };
            gatherParts(msgData.payload || {});

            for (const part of parts) {
                const attachRes = await fetch(`${GMAIL_API_BASE}/messages/${msgId}/attachments/${part.body.attachmentId}`, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                const attachData = await attachRes.json();

                if (attachData.data) {
                    const mimeType = part.mimeType || 'application/octet-stream';
                    // Convert Base64 URL to standard Base64 Buffer for Node.js
                    const base64Data = attachData.data.replace(/-/g, '+').replace(/_/g, '/');
                    const buffer = Buffer.from(base64Data, 'base64');
                    
                    const safeName = part.filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                    const storagePath = `${emailRecord.id}/${Date.now()}-${safeName}`;
                    
                    const { error: uploadErr } = await supabase.storage
                        .from('shipping_documents')
                        .upload(storagePath, buffer, { contentType: mimeType, upsert: true });
                        
                    if (!uploadErr) {
                        await supabase.from('email_attachments').insert([{
                            email_id: emailRecord.id,
                            filename: part.filename,
                            mime_type: mimeType,
                            storage_path: storagePath
                        }]);
                    }
                }
            }
            syncedCount++;
        }
        
        return res.status(200).json({ status: 'Success', synced: syncedCount });
    } catch (e) {
        console.error('[CRON] Sync error:', e);
        return res.status(500).json({ error: 'Sync pipeline crashed', details: e.message });
    }
}
