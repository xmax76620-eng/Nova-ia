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

    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: result.error?.message || "Erreur OpenRouter."
      });
    }

    const models = (result.data || [])
      .filter(m =>
        m?.id &&
        (m.id.endsWith(":free") || m.id === "openrouter/free")
      )
      .map(m => ({
        id: m.id,
        name: m.name || m.id
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({ models });

  } catch (error) {
    return res.status(502).json({
      error: error.message || "OpenRouter inaccessible."
    });
  }
};
