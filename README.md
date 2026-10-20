# Voxelle-Québec — Tuques, cônes et nids-de-poule

RPG d'action et d'exploration en voxels dans le navigateur, dans un Québec satirique et fictif. Inspiré du *genre* des RPG voxel en monde ouvert ; tout le code, l'art, les noms et les textes sont originaux.

- Monde généré (graine fixe) : Fleuve, rives, campagne, forêt boréale, érablières, Laurentides enneigées ; Vieille-Ville fortifiée avec château fictif, villages à clocher, cabanes à sucre, chantiers.
- Ennemis : cônes-golems, bureaucrates zombies, déneigeuses folles, ratons voleurs de poutine, mouches noires, nids-de-poule qui mordent, et le Cône Suprême.
- Quêtes en français québécois, contrats de village, dépanneur, butin, piasses, XP et niveaux, cerf-volant fléché pour planer, blocs à casser et poser, cycle jour-nuit avec aurores boréales, neige, musique trad procédurale.
- Graphismes : voxels de 50 cm (un personnage fait environ 3,5 voxels de haut), maillage glouton avec occlusion ambiante par sommet, grain et variations de teinte par voxel dans le nuanceur, ombres portées du soleil et de la lune, brouillard, eau animée (reflets, écume sur les rives), herbes, fleurs et bleuets, nuages en amas de voxels, modèles détaillés.
- Performance : génération et maillage dans un Web Worker, 3 niveaux de détail (voxels fins près du joueur, puis cellules de 1 m et de 2 m), qualité automatique (ombres puis distance de vue), densité réduite sur mobile.
- Premiers pas guidés au premier lancement (7 étapes, à passer ou à revoir dans la pause), suivi qui donne toujours la prochaine action, repère à l'écran vers l'objectif avec la distance, plan des salles visitées dans les donjons.
- Saisons : 4 saisons de 3 jours de jeu (HUD et journal). Hiver : neige au sol et sur les toits, fleuve et lacs gelés où l'on marche (ça glisse), patinoire avec patineurs, carnaval avec le bonhomme Frimousse et une butte pour la traîne sauvage. Printemps : temps des sucres, dégel, pluie. Été : verdure, animaux, lucioles. Automne : érables rouges, bouleaux jaunes, feuilles qui tombent. Météo pondérée par saison, teintes par uniformes du nuanceur (aucun remaillage), une petite activité par saison.
- Ta cabane : quête « Ton bout de terrain » (Me Hortense Brisebois, notaire, à l'est du village), repère « Chez vous » sur la carte, meubles fabriqués à l'établi (lit = dormir jusqu'au matin et point de réveil, coffre de 24 places sauvegardé, poêle, table, chaise berçante, cadre à trophées, tapis), on reprend des forces chez soi, raccourci « Retour à la cabane » (touche H, pause, carte).
- Clavier/souris, manette, tactile. Sauvegarde locale (`voxelle-quebec-v2` ; une sauvegarde v1 est reprise sans les blocs modifiés).

Lancer : `node tools/serve.js 8765` puis http://localhost:8765/ (les modules ES ne marchent pas en file://).
Tests : `node tools/bot.js` (parcours complet), `node tools/quests.js` (toutes les quêtes) et `node tools/premiers-pas.js` (premiers pas, suivi, tactile, donjons), `node tools/saisons.js` (saisons, glace, cabane, meubles, coffre, lit, sauvegarde), avec Playwright de /workspace/tnd-run. Captures comparatives : `node tools/graph.js graph-apres`, `node tools/v4shots.js apres-v4` ; mesures : `node tools/perf.js`.

Three.js (MIT) est inclus dans vendor/. Police Jersey 10 (OFL) dans assets/fonts/.
