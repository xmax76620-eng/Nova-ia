
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  // Vérification de la méthode
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      error: "Méthode non autorisée."
    });
  }

  // Récupération de la clé OpenRouter
  const key = process.env.OPENROUTER_API_KEY;

  if (!key) {
    return res.status(500).json({
      error: "Clé OPENROUTER_API_KEY absente dans Vercel."
    });
  }

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/models",
      {
        headers: {
          Authorization: `Bearer ${key}`
        }
      }
    );

    let result = {};

    try {
      result = await response.json();
    } catch (_) {}

    if (!response.ok) {
      return res.status(response.status).json({
        error: result.error?.message || "Erreur OpenRouter."
      });
    }

    // Récupération des modèles gratuits
    const models = (result.data || [])
      .filter(model =>
        model?.id &&
        (
          model.id.endsWith(":free") ||
          model.id === "openrouter/free"
        )
      )
      .map(model => ({
        id: model.id,
        name: model.name || model.id
      }))
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );

    if (!models.length) {
      return res.status(502).json({
        error: "OpenRouter n'a renvoyé aucun modèle gratuit."
      });
    }

    return res.status(200).json({
      models
    });

  } catch (error) {
    return res.status(502).json({
      error:
        error.message ||
        "OpenRouter inaccessible."
    });
  }
};
