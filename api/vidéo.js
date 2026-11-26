
export default async function handler(req, res) {
  const API_KEY = process.env.AGNES_API_KEY;
  const BASE_URL = "https://apihub.agnes-ai.com";
  const MODEL = "agnes-video-2.5-flash";

  if (!API_KEY) {
    return res.status(500).json({
      error: "Clé Agnes manquante. Configure AGNES_API_KEY dans Vercel."
    });
  }

  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json"
  };

  try {
    if (req.method === "POST") {
      const { prompt, duration, aspect_ratio } = req.body || {};

      if (!prompt || !String(prompt).trim()) {
        return res.status(400).json({ error: "Décris la vidéo à créer." });
      }

      const seconds = Math.min(12, Math.max(4, Number(duration) || 5));

      const response = await fetch(`${BASE_URL}/v1/videos`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: MODEL,
          prompt: String(prompt).trim(),
          mode: "text",
          seconds: String(seconds),
          size: "720P",
          aspect_ratio: aspect_ratio || "16:9"
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error: data.error || data.message || "Erreur Agnes",
          details: data
        });
      }

      return res.status(200).json(data);
    }

    if (req.method === "GET") {
      const videoId = req.query.video_id;

      if (!videoId) {
        return res.status(400).json({ error: "video_id manquant." });
      }

      const url = new URL(`${BASE_URL}/agnesapi`);
      url.searchParams.set("video_id", videoId);
      url.searchParams.set("model_name", MODEL);

      const response = await fetch(url, { headers });
      const data = await response.json();

      return res.status(response.status).json(data);
    }

    return res.status(405).json({ error: "Méthode non autorisée." });

  } catch (error) {
    return res.status(500).json({
      error: "Erreur du serveur vidéo.",
      details: error.message
    });
  }
}
