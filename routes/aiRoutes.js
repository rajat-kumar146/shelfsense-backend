const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const router = express.Router();

// Free models to try in order — if one fails, try the next
const FREE_MODELS = [
  "google/gemma-3-4b-it:free",
  "mistralai/mistral-7b-instruct:free",
  "microsoft/phi-3-mini-128k-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
];

// POST /api/ai/chat
router.post("/chat", protect, async (req, res) => {
  const { messages, systemPrompt } = req.body;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENROUTER_API_KEY not set in .env" });
  }

  const body = JSON.stringify({
    messages: [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ],
    max_tokens: 1024,
  });

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
    "HTTP-Referer": "http://localhost:5173",
    "X-Title": "ShelfSense",
  };

  // Try each model until one works
  for (const model of FREE_MODELS) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...JSON.parse(body), model }),
      });

      const data = await response.json();

      // Skip if provider error or no content
      if (!response.ok || data.error) {
        console.warn(`[AI] Model ${model} failed:`, data.error?.message || response.status);
        continue;
      }

      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        console.warn(`[AI] Model ${model} returned empty content`);
        continue;
      }

      console.log(`[AI] Responded using model: ${model}`);
      return res.json({ content: text });

    } catch (err) {
      console.warn(`[AI] Model ${model} threw error:`, err.message);
      continue;
    }
  }

  // All models failed
  res.status(503).json({
    error: "All free AI models are currently unavailable. Please try again in a moment.",
  });
});

module.exports = router;