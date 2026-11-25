module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "Clé OpenRouter absente dans Vercel." });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` }
    });
    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: (result.error && result.error.message) || "Erreur OpenRouter."
      });
    }

    const data = (result.data || [])
      .filter(item => item && typeof item.id === "string" &&
        (item.id.endsWith(":free") || item.id === "openrouter/free"))
      .map(item => ({ id: item.id, name: item.name || item.id }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({ data });
  } catch (error) {
    return res.status(502).json({
      error: error.message || "Impossible de joindre OpenRouter."
    });
  }
};
