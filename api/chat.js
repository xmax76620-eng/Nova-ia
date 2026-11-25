export default async function handler(req, res) {
  // Vérifier la méthode
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Méthode non autorisée"
    });
  }

  // Récupérer la clé OpenRouter depuis Vercel
  const key = process.env.OPENROUTER_API_KEY;

  if (!key) {
    return res.status(500).json({
      error: "Clé OpenRouter absente dans Vercel"
    });
  }

  try {
    const { model, messages } = req.body || {};

    // Vérifier les données reçues
    if (!model || !Array.isArray(messages)) {
      return res.status(400).json({
        error: "Modèle ou messages manquants"
      });
    }

    // Envoyer la demande à OpenRouter
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model,
          messages: messages
        })
      }
    );

    const result = await response.json();

    return res.status(response.status).json(result);

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
