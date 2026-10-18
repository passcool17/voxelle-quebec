# Voxelle-Québec — Tuques, cônes et nids-de-poule

RPG d'action et d'exploration en voxels dans le navigateur, dans un Québec satirique et fictif. Inspiré du *genre* des RPG voxel en monde ouvert ; tout le code, l'art, les noms et les textes sont originaux.

- Monde généré (graine fixe) : Fleuve, rives, campagne, forêt boréale, érablières, Laurentides enneigées ; Vieille-Ville fortifiée avec château fictif, villages à clocher, cabanes à sucre, chantiers.
- Ennemis : cônes-golems, bureaucrates zombies, déneigeuses folles, ratons voleurs de poutine, mouches noires, nids-de-poule qui mordent, et le Cône Suprême.
- Quêtes en français québécois, contrats de village, dépanneur, butin, piasses, XP et niveaux, cerf-volant fléché pour planer, blocs à casser et poser, cycle jour-nuit avec aurores boréales, neige, musique trad procédurale.
- Clavier/souris, manette, tactile. Sauvegarde locale.

Lancer : `node tools/serve.js 8765` puis http://localhost:8765/ (les modules ES ne marchent pas en file://).
Tests : `node tools/bot.js` (parcours complet) et `node tools/quests.js` (toutes les quêtes), avec Playwright de /workspace/tnd-run.

Three.js (MIT) est inclus dans vendor/. Police Jersey 10 (OFL) dans assets/fonts/.
