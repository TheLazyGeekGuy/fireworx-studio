# FireworX Studio

Éditeur et bibliothèque de presets du **TC Electronic FireworX**, dans le navigateur, fondés sur MIDI Studio. Projet communautaire indépendant.

**[Ouvrir l’éditeur](https://bcr32-studio.github.io/fireworx-studio.github.io/)** · [English](README.md) · [Manuel français illustré](docs/instruments/fireworx/USER-MANUAL.fr.md)

Version alpha, cible **FireworX OS 2.00+**. L’application pilote le matériel externe et ne traite pas son audio. La validation de toutes les versions de firmware, interfaces MIDI et cartes reste à faire.

## Démarrer

1. Ouvrir l’éditeur dans un navigateur compatible Web MIDI et autoriser MIDI/SysEx.
2. Dans **MIDI / Buffer**, choisir les ports si la détection automatique ne trouve pas une paire unique.
3. Attendre les deux lectures P0 concordantes et l’état de connexion vérifié avant d’éditer.

Sans autorisation MIDI, l’édition et les fichiers restent disponibles localement. Une seule application doit piloter le matériel à la fois.

Français/anglais avec détection de la langue du navigateur ; manuel intégré, illustré, suivant le thème, exportable en HTML autonome.

## Fonctions et limites

Façades matérielle/moderne, rappel des presets, matrice compacte, paramètres des blocs, modulations décodées, Alpha/Ext et MIDI Learn, bibliothèque locale, fichiers JSON/SysEx et variations aléatoires reproductibles.

Les écritures P0 passent par le transport protégé avec comparaison et relecture. STORE User/Carte sauvegarde la destination et vérifie l’écriture ; sa qualification matérielle complète et la conservation après redémarrage restent à valider. Le DSP est estimé. La lecture/écriture des affectations CTRL globales et la relecture du BPM global ne sont pas établies. Le MIDI Learn ne configure pas le menu CTRL physique. Le dump User groupé n’est pas entièrement décodé/restauré. Consulter les limites détaillées du manuel.

## Données et publication

Préférences, presets et journaux restent dans le profil du navigateur, sauf export demandé. Aucun serveur applicatif, télémétrie ou service d’envoi de presets. GitHub assure l’hébergement et peut traiter les données d’accès habituelles. Les comptes et contributions GitHub publics restent visibles.

La publication contient uniquement les sources utiles, les tests synthétiques et la documentation utilisateur. Les données privées et les fichiers de travail restent exclus. Les licences sont conservées.

Installation, tests et déploiement : voir le [README anglais](README.md#development). Le workflow GitHub Actions publie automatiquement le site après les contrôles sur `main`. Licence MIT.
