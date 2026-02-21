# Multiplayer Web (Render-ready)

Ce repo contient maintenant une V1 multijoueur web en plus de l'app Electron locale.

## Structure

- `multiplayer/server` : API Node + Socket.IO (autorite de jeu)
- `multiplayer/web` : client React (navigateur)
- `render.yaml` : blueprint Render (API + site statique)

## Lancer en local

1. Installer les deps multijoueur:

```bash
npm run mp:install
```

2. Terminal A - serveur:

```bash
npm run mp:server:dev
```

3. Terminal B - client web:

```bash
npm run mp:web:dev
```

4. Ouvrir l'URL Vite (souvent `http://localhost:5173`).

## Deploiement Render

1. Pousser le repo sur GitHub.
2. Dans Render: `New` -> `Blueprint`.
3. Selectionner le repo et valider `render.yaml`.
4. Render cree 2 services:
   - `limite-game-api` (Node)
   - `limite-game-web` (Static)
5. Une fois deploye, partager l'URL du service web avec les joueurs.

## Gameplay reseau supporte

- Room code (creation/join)
- Lobby (host configure la partie)
- Manche: reponses libres + timer (30/45/60)
- Revelation anonyme des propositions
- Mode gagnant: juge ou vote tour par tour
- Score + rotation automatique du juge
- Fin de partie: X points ou N manches

## Notes

- Le contenu est tire de `resources/packs/core.json`.
- Limite actuelle: 10 joueurs max par room.
