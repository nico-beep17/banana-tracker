export default async function handler(req, res) {
    // Allow requests from any origin (covers Capacitor APK WebView with file:// or null origin)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt in request body.' });
    }

    const apiKey = process.env.VITE_GEMINI_API_KEY || "AIzaSyB5JwwJYAKVOd_oSLecdAuwk6U58R21AxM";
    if (!apiKey) {
        return res.status(500).json({ error: 'Gemini API key not configured on server.' });
    }

    const model = 'gemini-2.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    { role: 'user', parts: [{ text: prompt }] }
                ],
                generationConfig: {
                    maxOutputTokens: 700,
                    temperature: 0.6,
                },
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return res.status(response.status).json({ error: err?.error?.message || 'Gemini API error' });
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        return res.status(200).json({ result: text || '' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
