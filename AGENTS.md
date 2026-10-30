# Instructions locales — FireworX Studio

## Suivi de projet commun

Avant toute intervention substantielle et avant de rendre la main :

1. Lire `../Code_ObsidianVault/MAINTENANCE-AGENTS.md`.
2. Lire l'état courant du projet dans `../Code_ObsidianVault/Projets/fireworx-studio/Projet.md` et `../Code_ObsidianVault/Projets/fireworx-studio/Etat.md`.
3. Mettre à jour `Etat.md`, `Decisions.md` (si décision structurante) et ajouter un checkpoint dans `../Code_ObsidianVault/Projets/fireworx-studio/Checkpoints/` avant un relais.

## Périmètre et sécurité de publication

- Ce dépôt est la publication autonome de **FireworX Studio** (site de présentation à `/` via `index.html` et `site/`, éditeur Web MIDI à `/editor/` via `editor/index.html` et `src/`).
- Exécuter systématiquement `npm test`, `META_CSP=1 npm run build` et `npm run leak-gate -- --artifact dist` avant tout commit ou publication.
- Ne jamais affaiblir `scripts/leak-gate.mjs` ni la politique CSP stricte (`style-src 'self'`, `script-src 'self'`).
