
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  const key = process.env.OPENROUTER_API_KEY;

  if (!key) {
    return res.status(500).json({
      error: "Clé OpenRouter absente dans Vercel."
    });
  }

  const { model, messages } = req.body || {};

  const isFree = id =>
    typeof id === "string" &&
    (id.endsWith(":free") || id === "openrouter/free");

  if (!isFree(model)) {
    return res.status(400).json({
      error: "Seuls les modèles gratuits sont autorisés."
    });
  }

  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > 50
  ) {
    return res.status(400).json({
      error: "Conversation invalide."
    });
  }

  let imageCount = 0;
  const safeMessages = [];

  for (const message of messages) {
    if (
      !message ||
      !["user", "assistant"].includes(message.role)
    ) {
      return res.status(400).json({
        error: "Un message est invalide."
      });
    }

    if (typeof message.content === "string") {
      if (!message.content.trim()) {
        return res.status(400).json({
          error: "Un message est vide."
        });
      }

      safeMessages.push({
        role: message.role,
        content: message.content.slice(0, 16000)
      });

      continue;
    }

    if (
      message.role !== "user" ||
      !Array.isArray(message.content) ||
      message.content.length > 10
    ) {
      return res.status(400).json({
        error: "Contenu multimédia invalide."
      });
    }

    const parts = [];

    for (const part of message.content) {
      if (
        part?.type === "text" &&
        typeof part.text === "string"
      ) {
        parts.push({
          type: "text",
          text: part.text.slice(0, 16000)
        });
        continue;
      }

      if (
        part?.type === "image_url" &&
        typeof part.image_url?.url === "string"
      ) {
        const url = part.image_url.url;

        const validImage =
          /^data:image\/(jpeg|png|webp);base64,/i.test(url);

        if (!validImage) {
          return res.status(400).json({
            error: "Format d'image non accepté. Utilise JPG, PNG ou WEBP."
          });
        }

        const base64 = url.split(",")[1] || "";
        const estimatedBytes = Math.floor(base64.length * 0.75);

        if (estimatedBytes > 3 * 1024 * 1024) {
          return res.status(413).json({
            error: "Image trop volumineuse. Maximum : 3 Mo par image."
          });
        }

        imageCount++;

        if (imageCount > 3) {
          return res.status(400).json({
            error: "Maximum 3 images par conversation envoyée."
          });
        }

        parts.push({
          type: "image_url",
          image_url: { url }
        });

        continue;
      }

      return res.status(400).json({
        error: "Type de pièce jointe non accepté."
      });
    }

    safeMessages.push({
      role: message.role,
      content: parts
    });
  }

  async function ask(modelId) {
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
          model: modelId,
          messages: safeMessages,
          max_tokens: 2000,
          temperature: 0.7
        })
      }
    );

    let data = {};

    try {
      data = await response.json();
    } catch (_) {}

    if (!response.ok) {
      const error = new Error(
        data.error?.message ||
        `Erreur OpenRouter : ${response.status}`
      );

      error.status = response.status;
      throw error;
    }

    const content = data.choices?.[0]?.message?.content;

    if (
      !content ||
      (typeof content !== "string" && !Array.isArray(content))
    ) {
      throw new Error("Le modèle a renvoyé une réponse vide.");
    }

    return data;
  }

  async function getBackupModels() {
    const response = await fetch(
      "https://openrouter.ai/api/v1/models",
      {
        headers: {
          Authorization: `Bearer ${key}`
        }
      }
    );

    if (!response.ok) return [];

    const catalog = await response.json();

    return (catalog.data || [])
      .filter(item => {
        if (!item?.id || !isFree(item.id) || item.id === model) {
          return false;
        }

        if (!imageCount) return true;

        const modalities = item.architecture?.input_modalities || [];
        return modalities.includes("image");
      })
      .map(item => item.id)
      .slice(0, 3);
  }

  try {
    try {
      const result = await ask(model);

      result.nova_model_used = model;
      result.nova_fallback = false;

      return res.status(200).json(result);

    } catch (firstError) {
      const retryable =
        !firstError.status ||
        [400, 404, 408, 429].includes(firstError.status) ||
        firstError.status >= 500;

      if (!retryable) {
        return res.status(firstError.status || 502).json({
          error: firstError.message
        });
      }

      let backups = [];

      try {
        backups = await getBackupModels();
      } catch (_) {}

      for (const backup of backups) {
        try {
          const result = await ask(backup);

          result.nova_model_used = backup;
          result.nova_fallback = true;
          result.nova_original_model = model;

          return res.status(200).json(result);

        } catch (_) {
          // On essaie le prochain modèle compatible.
        }
      }

      return res.status(502).json({
        error: imageCount
          ? "Aucun modèle gratuit compatible avec l'analyse d'image n'a répondu. Essaie un autre modèle."
          : "Aucun modèle gratuit n'a répondu. Réessaie dans quelques instants.",
        original_error: firstError.message
      });
    }

  } catch (error) {
    return res.status(500).json({
      error: error.message || "Erreur interne de NOVA AI."
    });
  }
};
