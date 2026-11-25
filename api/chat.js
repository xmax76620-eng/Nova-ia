
module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Méthode non autorisée"
    });
  }

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Clé OpenRouter manquante sur Vercel"
      });
    }

    const { model, messages, message } = req.body || {};

    const conversation = Array.isArray(messages)
      ? messages
      : [{ role: "user", content: message || "" }];

    if (!conversation.length) {
      return res.status(400).json({
        error: "Aucun message reçu"
      });
    }

    const selectedModel = model || "openrouter/free";

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://nova-ai.vercel.app",
          "X-Title": "NOVA AI"
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: conversation
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Erreur OpenRouter"
      });
    }

    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({
      error: error.message || "Erreur serveur"
    });
  }
};
