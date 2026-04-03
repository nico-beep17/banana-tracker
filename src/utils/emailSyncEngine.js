import { supabase } from '../supabaseClient';
import { getEmailBody, getEmailHtmlForPrint } from './gmailScanner';

const GMAIL_API_BASE = 'https://www.googleapis.com/gmail/v1/users/me';

// Utility to convert Base64 URL Safe string to Blob for Supabase upload
const base64toBlob = (b64Data, contentType = '') => {
    // Decode base64url to base64
    let base64 = b64Data.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    const byteCharacters = atob(base64);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        byteArrays.push(new Uint8Array(byteNumbers));
    }
    return new Blob(byteArrays, { type: contentType });
};

export async function syncLatestEmailsToDatabase(gmailToken, setProgress = null) {
    if (!gmailToken) throw new Error("Missing Gmail Token");

    // 1. Fetch latest 50 emails that haven't been synced yet
    // Since we can't easily filter by "not synced" in Gmail API without a history ID, 
    // we'll fetch 50 and skip those already in the DB.
    if (setProgress) setProgress("Fetching inbox list...");
    
    // We only care about emails with attachments usually, but let's grab top 50
    const listRes = await fetch(`${GMAIL_API_BASE}/messages?maxResults=50`, {
        headers: { Authorization: `Bearer ${gmailToken}` }
    });
    
    if (!listRes.ok) throw new Error("Failed to fetch Gmail list");
    const listData = await listRes.json();
    const messageIds = (listData.messages || []).map(m => m.id);

    if (messageIds.length === 0) {
        if (setProgress) setProgress("No emails found.");
        return 0;
    }

    // Check which ones are already in Supabase
    const { data: existing } = await supabase
        .from('shipping_emails')
        .select('message_id')
        .in('message_id', messageIds);
        
    const existingSt = new Set((existing || []).map(e => e.message_id));
    const toSync = messageIds.filter(id => !existingSt.has(id));

    if (toSync.length === 0) {
        if (setProgress) setProgress("Everything is already up to date.");
        return 0;
    }

    let syncedCount = 0;

    for (const msgId of toSync) {
        if (setProgress) setProgress(`Syncing email ${syncedCount + 1} of ${toSync.length}...`);
        
        try {
            const msgRes = await fetch(`${GMAIL_API_BASE}/messages/${msgId}`, {
                headers: { Authorization: `Bearer ${gmailToken}` }
            });
            const msgData = await msgRes.json();

            // Extract metadata
            const headers = msgData.payload.headers || [];
            const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
            const from = headers.find(h => h.name === 'From')?.value || 'Unknown Server';
            const dateStr = headers.find(h => h.name === 'Date')?.value || new Date().toISOString();
            const snippet = msgData.snippet || '';
            const bodyText = getEmailBody(msgData.payload);

            // 1. Save email to Supabase
            const { data: emailRecord, error: emailErr } = await supabase
                .from('shipping_emails')
                .insert([{
                    message_id: msgId,
                    subject: subject,
                    sender: from,
                    email_date: new Date(dateStr).toISOString(),
                    snippet: snippet,
                    body_text: bodyText
                }])
                .select()
                .single();

            if (emailErr || !emailRecord) {
                console.error("Failed to insert email", msgId, emailErr);
                continue;
            }

            // 2. Download and upload attachments
            const parts = msgData.payload.parts || [];
            for (const part of parts) {
                if (part.filename && part.body && part.body.attachmentId) {
                    if (setProgress) setProgress(`Uploading attachment: ${part.filename}...`);
                    
                    const attachRes = await fetch(`${GMAIL_API_BASE}/messages/${msgId}/attachments/${part.body.attachmentId}`, {
                        headers: { Authorization: `Bearer ${gmailToken}` }
                    });
                    const attachData = await attachRes.json();

                    if (attachData.data) {
                        const mimeType = part.mimeType || 'application/octet-stream';
                        const blob = base64toBlob(attachData.data, mimeType);
                        
                        // Sanitize filename to avoid weird character issues in S3
                        const safeName = part.filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                        const storagePath = `${emailRecord.id}/${Date.now()}-${safeName}`;
                        
                        const { data: uploadData, error: uploadErr } = await supabase.storage
                            .from('shipping_documents')
                            .upload(storagePath, blob, { contentType: mimeType, upsert: true });
                            
                        if (uploadErr) {
                            console.error("Failed to upload attachment", part.filename, uploadErr);
                        } else {
                            // Insert attachment record
                            await supabase.from('email_attachments').insert([{
                                email_id: emailRecord.id,
                                filename: part.filename,
                                mime_type: mimeType,
                                storage_path: storagePath
                            }]);
                        }
                    }
                }
            }
            
            syncedCount++;
        } catch(err) {
            console.error("Failed syncing message", msgId, err);
        }
    }
    
    if (setProgress) setProgress("Sync complete!");
    return syncedCount;
}

// Utility to get the public URL for an attachment
export function getAttachmentUrl(storagePath) {
    const { data } = supabase.storage.from('shipping_documents').getPublicUrl(storagePath);
    return data.publicUrl;
}
