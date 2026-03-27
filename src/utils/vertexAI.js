/**
 * Google Gemini API Helper (Generative Language API)
 * 
 * Uses the Generative Language API endpoint which supports standard API keys.
 * This gives access to the same Gemini models (gemini-2.5-flash, etc.) as Vertex AI.
 * 
 * Required env vars:
 *   VITE_GEMINI_API_KEY – GCP API key with Generative Language API enabled
 */

const getApiKey = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API Key is missing. Set VITE_GEMINI_API_KEY in .env');
  return apiKey;
};

/**
 * Build the Gemini API endpoint URL.
 * Docs: POST https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}
 */
const buildEndpoint = (model, method = 'generateContent') => {
  const apiKey = getApiKey();
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}?key=${apiKey}`;
};

/**
 * Send a text chat completion to Gemini.
 * 
 * @param {Object} options
 * @param {string} options.systemPrompt  - System instruction text
 * @param {string} options.userMessage   - User's message
 * @param {string} [options.model]       - Model ID (default: gemini-2.5-flash)
 * @param {number} [options.temperature] - Temperature (default: 0.05)
 * @param {number} [options.maxTokens]   - Max output tokens (default: 2048)
 * @returns {Promise<string>} The model's text response
 */
export async function chatCompletion({
  systemPrompt,
  userMessage,
  model = 'gemini-2.5-flash',
  temperature = 0.05,
  maxTokens = 2048,
}) {
  const endpoint = buildEndpoint(model);

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userMessage }],
      },
    ],
    systemInstruction: {
      role: 'system',
      parts: [{ text: systemPrompt }],
    },
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      responseMimeType: 'text/plain',
    },
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `Gemini API error: ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No response from Gemini.');
  return text;
}

/**
 * Send a vision (image + text) request to Gemini.
 * 
 * @param {Object} options
 * @param {string} options.prompt       - Text prompt
 * @param {string} options.imageBase64  - Base64-encoded image data (raw, no data: prefix)
 * @param {string} options.mimeType     - e.g., "image/jpeg"
 * @param {string} [options.model]      - Model ID (default: gemini-2.5-flash)
 * @param {number} [options.maxTokens]  - Max output tokens (default: 1500)
 * @returns {Promise<string>} The model's text response
 */
export async function visionCompletion({
  prompt,
  imageBase64,
  mimeType = 'image/jpeg',
  model = 'gemini-2.5-flash',
  maxTokens = 1500,
}) {
  const endpoint = buildEndpoint(model);

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: maxTokens,
    },
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `Gemini vision error: ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No response from Gemini vision.');
  return text;
}

export default { chatCompletion, visionCompletion };
