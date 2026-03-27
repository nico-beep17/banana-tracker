/**
 * Vertex AI Gemini API Helper
 * 
 * Wraps the Vertex AI REST API for Gemini models (text + vision).
 * 
 * Required env vars:
 *   VITE_VERTEX_API_KEY      – GCP API key with Vertex AI API enabled
 *   VITE_VERTEX_PROJECT_ID   – GCP project ID (e.g., "my-project-123456")
 *   VITE_VERTEX_LOCATION     – GCP region (e.g., "us-central1")
 */

const getConfig = () => {
  const apiKey    = import.meta.env.VITE_VERTEX_API_KEY;
  const projectId = import.meta.env.VITE_VERTEX_PROJECT_ID;
  const location  = import.meta.env.VITE_VERTEX_LOCATION || 'us-central1';

  if (!apiKey) throw new Error('Vertex AI API Key is missing. Set VITE_VERTEX_API_KEY in .env');
  if (!projectId) throw new Error('Vertex AI Project ID is missing. Set VITE_VERTEX_PROJECT_ID in .env');

  return { apiKey, projectId, location };
};

/**
 * Build the Vertex AI Gemini endpoint URL with API key as query param.
 * Docs: POST https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{LOCATION}/publishers/google/models/{MODEL}:generateContent?key={API_KEY}
 */
const buildEndpoint = (model, method = 'generateContent') => {
  const { apiKey, projectId, location } = getConfig();
  return `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:${method}?key=${apiKey}`;
};

/**
 * Send a text-only chat completion to Vertex AI Gemini.
 * 
 * @param {Object} options
 * @param {string} options.systemPrompt  - System instruction text
 * @param {string} options.userMessage   - User's message
 * @param {string} [options.model]       - Model ID (default: gemini-2.0-flash)
 * @param {number} [options.temperature] - Temperature (default: 0.05)
 * @param {number} [options.maxTokens]   - Max output tokens (default: 2048)
 * @returns {Promise<string>} The model's text response
 */
export async function chatCompletion({
  systemPrompt,
  userMessage,
  model = 'gemini-2.0-flash',
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
    const msg = err?.error?.message || `Vertex AI error: ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No response from Vertex AI Gemini.');
  return text;
}

/**
 * Send a vision (image + text) request to Vertex AI Gemini.
 * 
 * @param {Object} options
 * @param {string} options.prompt       - Text prompt
 * @param {string} options.imageBase64  - Base64-encoded image data (raw, no data: prefix)
 * @param {string} options.mimeType     - e.g., "image/jpeg"
 * @param {string} [options.model]      - Model ID (default: gemini-2.0-flash)
 * @param {number} [options.maxTokens]  - Max output tokens (default: 1500)
 * @returns {Promise<string>} The model's text response
 */
export async function visionCompletion({
  prompt,
  imageBase64,
  mimeType = 'image/jpeg',
  model = 'gemini-2.0-flash',
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
    const msg = err?.error?.message || `Vertex AI vision error: ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No response from Vertex AI vision.');
  return text;
}

export default { chatCompletion, visionCompletion };
