import { Router } from 'express';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function callGemini(apiKey, model, body, retries = 0) {
  const url = `${GEMINI_BASE}/${model}:generateContent`;
  console.log(`[Gemini] ${model} -> ${url} (attempt ${retries + 1})`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  console.log(`[Gemini] Response status: ${response.status}`);

  if (response.status === 429 && retries < MAX_RETRIES) {
    const delay = BASE_DELAY_MS * Math.pow(2, retries);
    console.log(`Rate limited (429). Retrying in ${delay}ms (attempt ${retries + 1}/${MAX_RETRIES})...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return callGemini(apiKey, model, body, retries + 1);
  }

  return response;
}

function parseGeminiResponse(data) {
  const text = [];
  let image = null;

  const parts = data?.candidates?.[0]?.content?.parts ?? [];

  for (const part of parts) {
    if (part.text) {
      text.push(part.text);
    }
    if (part.inlineData) {
      image = {
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType,
      };
    }
  }

  return { text: text.join('\n'), image };
}

export function createGenerateRouter(apiKey) {
  const router = Router();

  router.post('/generate', async (req, res) => {
    try {
      const { model, prompt, referenceImages = [] } = req.body;

      if (!model || !prompt) {
        return res.status(400).json({ error: 'model and prompt are required' });
      }

      const parts = [
        { text: prompt },
        ...referenceImages.map((img) => ({
          inline_data: {
            mime_type: img.mimeType,
            data: img.data,
          },
        })),
      ];

      const body = {
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      };

      const response = await callGemini(apiKey, model, body);

      if (response.status === 401 || response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`Auth error ${response.status}:`, JSON.stringify(errorData, null, 2));
        return res.status(401).json({ error: errorData?.error?.message || 'Invalid API key' });
      }

      if (response.status === 429) {
        return res.status(429).json({ error: 'Rate limited' });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData?.error?.message || `Gemini API error (${response.status})`;

        if (
          message.toLowerCase().includes('safety') ||
          message.toLowerCase().includes('blocked') ||
          message.toLowerCase().includes('filter')
        ) {
          return res.status(400).json({ error: `Content filtered: ${message}` });
        }

        return res.status(502).json({ error: message });
      }

      const data = await response.json();

      // Check for content filtering in a successful response
      const finishReason = data?.candidates?.[0]?.finishReason;
      if (finishReason === 'SAFETY' || finishReason === 'BLOCKED') {
        const safetyMessage = data?.candidates?.[0]?.safetyRatings
          ?.filter((r) => r.blocked)
          ?.map((r) => r.category)
          ?.join(', ') || 'Content was filtered';
        return res.status(400).json({ error: `Content filtered: ${safetyMessage}` });
      }

      const result = parseGeminiResponse(data);
      return res.json(result);
    } catch (err) {
      console.error('Generate error:', err);
      return res.status(502).json({ error: err.message || 'Internal server error' });
    }
  });

  router.post('/test-connection', async (req, res) => {
    try {
      const { model = 'gemini-2.5-flash-image' } = req.body || {};

      const body = {
        contents: [{ parts: [{ text: 'Respond with "ok".' }] }],
      };

      const response = await callGemini(apiKey, model, body);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData?.error?.message || `API error (${response.status})`;
        return res.json({ success: false, error: message });
      }

      return res.json({ success: true, model });
    } catch (err) {
      console.error('Test connection error:', err);
      return res.json({ success: false, error: err.message || 'Connection failed' });
    }
  });

  return router;
}
