# NOVA AI — fichiers du projet

## Site GitHub Pages
1. Dans ton dépôt `nova-ai`, ajoute `index.html` à la racine.
2. Ouvre Settings → Pages.
3. Choisis Deploy from a branch, `main`, dossier `/ (root)`, puis Save.
4. Le site sera publié à l'adresse GitHub Pages de ton dépôt.

## API (Cloudflare Worker)
GitHub Pages héberge le site, mais n'exécute pas le serveur. Le fichier `worker.js` doit donc rester déployé comme Worker Cloudflare.
1. Ouvre ton Worker Cloudflare et remplace son code par le contenu de `worker.js`.
2. Dans Settings → Variables and Secrets, ajoute un secret `OPENROUTER_API_KEY` contenant ta clé OpenRouter.
3. Déploie le Worker.
4. Sur ton site NOVA AI, colle l'URL HTTPS du Worker dans la fenêtre de réglages.

IMPORTANT : ne mets jamais la clé OpenRouter dans `index.html` ou dans le dépôt GitHub. Les modèles gratuits disponibles peuvent changer selon OpenRouter.
