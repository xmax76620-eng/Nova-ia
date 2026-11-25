module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Méthode non autorisée."
    });
  }

  const key = process.env.OPENROUTER_API_KEY;

  if (!key) {
    return res.status(500).json({
      error: "Clé OPENROUTER_API_KEY absente dans Vercel."
    });
  }

  const { model, messages } = req.body || {};

  const isFree = id =>
    typeof id === "string" &&
    (id.endsWith(":free") || id === "openrouter/free");

  if (!isFree(model)) {
    return res.status(400).json({
      error: "Sélectionne un modèle gratuit."
    });
  }

  if (!Array.isArray(messages) || !messages.length || messages.length > 50) {
    return res.status(400).json({
      error: "Conversation invalide."
    });
  }

  const safeMessages = messages.map(m => ({
    role: m?.role === "assistant" ? "assistant" : "user",
    content: String(m?.content || "").slice(0, 16000)
  }));

  async function ask(modelId) {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "X-Title": "NOVA AI"
        },
        body: JSON.stringify({
          model: modelId,
          messages: safeMessages,
          max_tokens: 1800
        })
      }
    );

    let data = {};
    try {
      data = await response.json();
    } catch (_) {}

    if (!response.ok) {
      const error = new Error(
        data.error?.message || `OpenRouter HTTP ${response.status}`
      );
      error.status = response.status;
      throw error;
    }

    if (!data.choices?.[0]?.message?.content) {
      throw new Error("Réponse vide du modèle.");
    }

    return data;
  }

  try {
    try {
      const result = await ask(model);
      result.nova_model_used = model;
      return res.status(200).json(result);

    } catch (first) {
      const retryable =
        !first.status ||
        [400, 404, 429].includes(first.status) ||
        first.status >= 500;

      if (!retryable) {
        return res.status(first.status).json({
          error: first.message
        });
      }

      let backups = [];

      try {
        const response = await fetch(
          "https://openrouter.ai/api/v1/models",
          {
            headers: {
              Authorization: `Bearer ${key}`
            }
          }
        );

        const catalog = await response.json();

        if (response.ok && Array.isArray(catalog.data)) {
          backups = catalog.data
            .map(x => x?.id)
            .filter(id => isFree(id) && id !== model)
            .slice(0, 3);
        }
      } catch (_) {}

      for (const backup of backups) {
        try {
          const result = await ask(backup);
          result.nova_model_used = backup;
          result.nova_fallback = true;
          return res.status(200).json(result);
        } catch (_) {}
      }

      return res.status(502).json({
        error: `Le modèle sélectionné et les modèles de secours ont échoué. ${first.message}`,
        attempted_model: model
      });
    }

  } catch (error) {
    return res.status(502).json({
      error: error.message || "Erreur serveur NOVA AI."
    });
  }
};
