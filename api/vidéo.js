export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  return res.status(501).json({
    error: "Le service vidéo n'est pas encore connecté à son fournisseur API.",
    details: "La route video.js est créée, mais nécessite la configuration du fournisseur vidéo."
  });
}
