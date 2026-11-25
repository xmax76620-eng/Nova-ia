
module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
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

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/models",
      {
        headers: {
          Authorization: `Bearer ${key}`
        }
      }
    );

    const payload = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Impossible de récupérer les modèles."
      });
    }

    const freeModels = (payload.data || [])
      .filter(model =>
        typeof model.id === "string" &&
        model.id.endsWith(":free")
      )
      .map(model => ({
        id: model.id,
        name: model.name || model.id
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({
      data: freeModels
    });

  } catch (error) {
    return res.status(502).json({
      error: "Erreur de connexion à OpenRouter."
    });
  }
};
