module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return res.status(500).json({ error: "La clé OpenRouter n'est pas configurée dans Vercel." });

  const { model, messages } = req.body || {};
  if (typeof model !== "string" || !model.endsWith(":free")) {
    return res.status(400).json({ error: "NOVA AI accepte uniquement les modèles gratuits se terminant par :free." });
  }
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
    return res.status(400).json({ error: "Conversation invalide ou trop longue." });
  }

  const safeMessages = messages.map(m => ({
    role: m && (m.role === "assistant" || m.role === "user") ? m.role : "user",
    content: String((m && m.content) || "").slice(0, 12000)
  }));

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nova-ai-liard-eight.vercel.app",
        "X-Title": "NOVA AI"
      },
      body: JSON.stringify({ model, messages: safeMessages, max_tokens: 1200 })
    });
    const payload = await response.json();
    if (!response.ok) {
      const message = payload && payload.error && payload.error.message;
      return res.status(response.status).json({ error: message || "Le fournisseur IA a refusé la requête." });
    }
    return res.status(200).json(payload);
  } catch {
    return res.status(502).json({ error: "Impossible de joindre OpenRouter." });
  }
};
