export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code, redirect_uri } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Missing authorization code' });
    }

    const clientId = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return res.status(500).json({ 
            error: 'Server is missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables.' 
        });
    }

    try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code: code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirect_uri || 'postmessage', // react-oauth/google uses 'postmessage' for front-end auth flows
                grant_type: 'authorization_code'
            })
        });

        const tokenData = await tokenRes.json();

        if (!tokenRes.ok) {
            console.error('[OAuth] Token exchange failed:', tokenData);
            return res.status(400).json({ error: tokenData.error_description || 'Failed to exchange token' });
        }

        return res.status(200).json({ 
            refresh_token: tokenData.refresh_token,
            access_token: tokenData.access_token,
            expires_in: tokenData.expires_in
        });

    } catch (e) {
        console.error('[OAuth] Network error exchange:', e);
        return res.status(500).json({ error: 'Internal server error during exchange', details: e.message });
    }
}
