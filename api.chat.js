
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
      error: "Clé OpenRouter absente dans Vercel."
    });
  }

  const { model, messages } = req.body || {};

  // Autoriser uniquement les modèles gratuits
  if (
    typeof model !== "string" ||
    !model.endsWith(":free")
  ) {
    return res.status(400).json({
      error: "Seuls les modèles gratuits sont autorisés."
    });
  }

  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > 40
  ) {
    return res.status(400).json({
      error: "Conversation invalide."
    });
  }

  const safeMessages = messages.map(message => ({
    role:
      message.role === "assistant"
        ? "assistant"
        : "user",
    content: String(message.content || "").slice(0, 12000)
  }));

  try {
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
          model,
          messages: safeMessages,
          max_tokens: 1200
        })
      }
    );

    const payload = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          payload.error?.message ||
          "Erreur du fournisseur IA."
      });
    }

    return res.status(200).json(payload);

  } catch (error) {
    return res.status(502).json({
      error: "Impossible de joindre OpenRouter."
    });
  }
};
