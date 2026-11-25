module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "Clé OpenRouter absente dans Vercel." });
  }

  const { model, messages } = req.body || {};
  const isFree = id => typeof id === "string" &&
    (id.endsWith(":free") || id === "openrouter/free");

  if (!isFree(model)) {
    return res.status(400).json({ error: "Choisis un modèle gratuit." });
  }
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
    return res.status(400).json({ error: "Conversation invalide." });
  }

  const safeMessages = messages.map(m => ({
    role: m && m.role === "assistant" ? "assistant" : "user",
    content: String((m && m.content) || "").slice(0, 12000)
  }));

  async function ask(modelId) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Title": "NOVA AI"
      },
      body: JSON.stringify({
        model: modelId,
        messages: safeMessages,
        max_tokens: 1200
      })
    });

    let data = {};
    try { data = await response.json(); } catch (_) {}

    if (!response.ok) {
      const error = new Error(
        (data.error && data.error.message) ||
        `Erreur OpenRouter HTTP ${response.status}.`
      );
      error.status = response.status;
      throw error;
    }
    if (!data.choices || !data.choices[0] ||
        !data.choices[0].message ||
        !data.choices[0].message.content) {
      throw new Error("Le fournisseur n'a pas renvoyé de réponse exploitable.");
    }
    return data;
  }

  try {
    try {
      const result = await ask(model);
      result.nova_model_used = model;
      return res.status(200).json(result);
    } catch (firstError) {
      const code = firstError.status;
      const canRetry = !code || code === 400 || code === 404 ||
        code === 429 || code >= 500;

      if (!canRetry) {
        return res.status(code || 502).json({ error: firstError.message });
      }

      // Essaye jusqu'à deux autres modèles gratuits si le modèle choisi échoue.
      let alternatives = [];
      try {
        const list = await fetch("https://openrouter.ai/api/v1/models", {
          headers: { Authorization: `Bearer ${key}` }
        });
        const catalog = await list.json();
        if (list.ok && Array.isArray(catalog.data)) {
          alternatives = catalog.data
            .map(item => item && item.id)
            .filter(id => isFree(id) && id !== model)
            .slice(0, 2);
        }
      } catch (_) {}

      for (const alternative of alternatives) {
        try {
          const result = await ask(alternative);
          result.nova_model_used = alternative;
          result.nova_fallback = true;
          return res.status(200).json(result);
        } catch (_) {}
      }

      return res.status(502).json({
        error: `Le modèle choisi a échoué et les modèles de secours aussi. Détail : ${firstError.message}`,
        attempted_model: model
      });
    }
  } catch (error) {
    return res.status(502).json({
      error: error.message || "Impossible de joindre OpenRouter."
    });
  }
};
