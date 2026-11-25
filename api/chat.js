
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  // Vérification de la méthode
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Méthode non autorisée."
    });
  }

  // Récupération de la clé OpenRouter
  const key = process.env.OPENROUTER_API_KEY;

  if (!key) {
    return res.status(500).json({
      error: "Clé OpenRouter absente dans Vercel."
    });
  }

  const { model, messages } = req.body || {};

  // Autoriser uniquement les modèles gratuits
  const isFree = id =>
    typeof id === "string" &&
    (id.endsWith(":free") || id === "openrouter/free");

  if (!isFree(model)) {
    return res.status(400).json({
      error: "Seuls les modèles gratuits sont autorisés."
    });
  }

  // Vérification de la conversation
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > 50
  ) {
    return res.status(400).json({
      error: "Conversation invalide."
    });
  }

  const safeMessages = [];
  let imageCount = 0;

  // Vérification des messages et des images
  for (const message of messages) {
    if (
      !message ||
      !["user", "assistant"].includes(message.role)
    ) {
      return res.status(400).json({
        error: "Rôle de message invalide."
      });
    }

    // Messages texte classiques
    if (typeof message.content === "string") {
      if (!message.content.trim()) {
        return res.status(400).json({
          error: "Message vide."
        });
      }

      safeMessages.push({
        role: message.role,
        content: message.content.slice(0, 16000)
      });

      continue;
    }

    // Les contenus multimodaux sont réservés aux messages utilisateur
    if (
      message.role !== "user" ||
      !Array.isArray(message.content)
    ) {
      return res.status(400).json({
        error: "Contenu de message invalide."
      });
    }

    const parts = [];

    for (const part of message.content) {

      // Texte dans un message avec image
      if (
        part?.type === "text" &&
        typeof part.text === "string"
      ) {
        parts.push({
          type: "text",
          text: part.text.slice(0, 16000)
        });

      // Image
      } else if (part?.type === "image_url") {
        const url = part.image_url?.url;

        if (
          typeof url !== "string" ||
          !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(url)
        ) {
          return res.status(400).json({
            error: "Image invalide ou format non accepté."
          });
        }

        const base64 = url.split(",")[1];

        if (base64.length > 1400000) {
          return res.status(413).json({
            error: "Image trop volumineuse. Maximum 1 Mo par image."
          });
        }

        imageCount++;

        if (imageCount > 3) {
          return res.status(400).json({
            error: "Maximum 3 images par envoi."
          });
        }

        parts.push({
          type: "image_url",
          image_url: {
            url: url
          }
        });

      } else {
        return res.status(400).json({
          error: "Élément de message non accepté."
        });
      }
    }

    if (!parts.length) {
      return res.status(400).json({
        error: "Message vide."
      });
    }

    safeMessages.push({
      role: message.role,
      content: parts
    });
  }

  // Envoi d'une demande à OpenRouter
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

    const content =
      data.choices?.[0]?.message?.content;

    if (
      !content ||
      (
        typeof content !== "string" &&
        !Array.isArray(content)
      )
    ) {
      throw new Error(
        "Le modèle a renvoyé une réponse vide."
      );
    }

    return data;
  }

  // Recherche de modèles gratuits de secours
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
      .filter(item =>
        item?.id &&
        isFree(item.id) &&
        item.id !== model &&
        (
          !imageCount ||
          item.architecture?.input_modalities?.includes("image")
        )
      )
      .map(item => item.id)
      .slice(0, 5);
  }

  // Exécution et système de secours
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
          // Passage au modèle suivant
        }
      }

      return res.status(502).json({
        error:
          "Aucun modèle gratuit compatible n'a répondu. Essaie un autre modèle ou réessaie plus tard.",
        original_error: firstError.message
      });
    }

  } catch (error) {
    return res.status(500).json({
      error:
        error.message ||
        "Erreur interne de NOVA AI."
    });
  }
};
