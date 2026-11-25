module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Méthode non autorisée"
    });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Clé OpenRouter manquante sur Vercel"
    });
  }

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/models",
      {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({
        error: error
      });
    }

    const result = await response.json();

    const models = (result.data || [])
      .filter(model =>
        model.id.endsWith(":free") ||
        model.id === "openrouter/free"
      )
      .map(model => ({
        id: model.id,
        name: model.name || model.id
      }));

    return res.status(200).json({
      models
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
};
