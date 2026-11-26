
export default async function handler(req, res) {
  const API_KEY = process.env.AGNES_API_KEY;
  const BASE = "https://apihub.agnes-ai.com";
  const MODEL = "agnes-video-2.5-flash";

  if (!API_KEY) {
    return res.status(500).json({
      error: "Clé AGNES_API_KEY absente dans Vercel."
    });
  }

  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json"
  };

  async function readResponse(response) {
    const text = await response.text();

    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return { message: text || "Réponse vide du fournisseur vidéo." };
    }
  }

  try {
    if (req.method === "POST") {
      const body = typeof req.body === "string"
        ? JSON.parse(req.body)
        : (req.body || {});

      const prompt = String(body.prompt || "").trim();

      if (!prompt) {
        return res.status(400).json({
          error: "La description de la vidéo est obligatoire."
        });
      }

      const seconds = Math.min(
        12,
        Math.max(4, Number(body.duration) || 5)
      );

      const payload = {
        model: MODEL,
        prompt,
        mode: "text",
        seconds: String(seconds),
        size: "720P",
        aspect_ratio: body.aspect_ratio || "16:9",
        n: 1
      };

      const response = await fetch(BASE + "/v1/videos", {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      const data = await readResponse(response);

      if (!response.ok) {
        console.error("Agnes creation error:", response.status, data);

        return res.status(response.status).json({
          error: data.message || data.error || "Agnes refuse la génération.",
          details: data
        });
      }

      return res.status(200).json(data);
    }

    if (req.method === "GET") {
      const videoId = String(req.query?.video_id || "").trim();

      if (!videoId) {
        return res.status(400).json({
          error: "Identifiant vidéo manquant."
        });
      }

      const url =
        BASE +
        "/agnesapi?video_id=" + encodeURIComponent(videoId) +
        "&model_name=" + encodeURIComponent(MODEL);

      const response = await fetch(url, { headers });
      const data = await readResponse(response);

      if (!response.ok) {
        console.error("Agnes polling error:", response.status, data);

        return res.status(response.status).json({
          error: data.message || data.error || "Erreur de suivi vidéo.",
          details: data
        });
      }

      return res.status(200).json(data);
    }

    return res.status(405).json({
      error: "Méthode non autorisée."
    });

  } catch (error) {
    console.error("NOVA video error:", error);

    return res.status(500).json({
      error: "Erreur serveur vidéo.",
      details: error.message
    });
  }
}
