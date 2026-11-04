# Math’as Connect — Doctrine d’intégration efficace et retour d’expérience transversal
**Décision du professeur : 4 novembre 2026.** Document opérationnel pérenne, fondé sur les rapports et incidents du dépôt jusqu’aux PR #169 et #170. **Objectif : réaliser directement la future version élève**, la valider en sécurité puis la publier, sans multiplier les prototypes, les LAB parallèles ni les conversations qui recommencent le même travail.

**Ordre de préséance :** décision pédagogique récente du professeur → contrats techniques réellement déployés et code actuel → guide permanent → archives datées. Les audits historiques ne valent pas preuve LIVE. Relire AGENTS.md et docs/integrations/README.md. La présente doctrine précise la priorité de livraison ; elle ne supprime ni les vérifications serveur ni l’interdiction de tester sur des élèves réels.

## 1. Charte à lire AVANT toute intégration (une minute)

1. **Partir du moteur pédagogique existant** et de sa version exacte ; conserver les modes, la méthode, les visuels et les règles natives. L’intégration est une couche légère, pas une réécriture du jeu.
2. **Viser immédiatement le produit scolaire définitif** : authentification Connect, XP et sauvegardes serveur si applicables, trophées, progression, professeur, HUB et projection selon capacités. Les essais temporaires ne doivent être qu’une recette limitée de CE MÊME candidat, non une nouvelle application ou un parcours parallèle.
3. **Le jeu déclare ses capacités.** XP : avec / sans ; trophées : avec / sans ; score : avec / sans ; projection : classement / exploits / pourcentage réellement mesuré / sans objet. Ne jamais inventer un score, un trophée, du HARD ou des XP pour forcer une interface commune.
4. **Les XP sont des crédits Connect confirmés par le serveur**, propres à cette app et à ses jalons. Sur les boutons d’activité, montrer « Reste N XP » quand le droit est connu ; zéro confirmé = « Reste 0 XP » ; état inconnu = aucun faux chiffre. Positionnement en bas à droite, lisible et sans chevauchement.
5. **Les coupes sont des réussites permanentes propres au jeu.** Afficher dans la case/bouton de l’exercice, de la série ou du mode les trophées à récupérer et ceux déjà acquis, lorsqu’ils sont réellement accessibles, sans masquer les conditions pédagogiques. Le HUB compte des TROPHÉES VISIBLES, pas des drapeaux techniques ; pour les deux additions, c’est 20, pas 25.
6. **Un score n’est jamais obligatoire.** S’il existe, garder le record personnel, le meilleur du jour et l’historique natifs ; sur projection, résultats strictement isolés par app_key avec consentement explicite du joueur. Aucune publication implicite d’une partie.
7. **Les interfaces professeur et élèves font partie du livrable.** Carte et miniature officielles, disponibilité par classe et par jeu, réglages, résultats prof/Monsieur T, synchronisation HUB, retour HUB, sauvegarde et réouverture ; projection connectée si la capacité est pertinente.
8. **Une intégration est finie uniquement quand elle est effectivement livrée** : GitHub main fusionné, GitHub Pages sur le bon SHA, SQL/Edge sur les bonnes versions si nécessaires, catalogues et visibilité vérifiés, recette fictive authentifiée tracée, rollback localisé. « Code prêt dans une PR » ≠ « visible par les élèves ».
9. **Sécurité non négociable, parcours de validation frugal.** Ne jamais prendre les vrais élèves comme cobayes, truquer des XP, désactiver les permissions ou réinitialiser les comptes pour aller plus vite. Le laboratoire sert de courte porte de recette, pas de destination du développement.
10. **Une seule source de vérité et un seul responsable d’intégration.** Même branche, même manifeste de livraison, pas de PR concurrentes qui modifient les mêmes couches ; ne pas laisser des brouillons oubliés après accord de publication.

## 2. Fiche de décision obligatoire : une ligne par capacité

| Capacité | Décision à fixer avant le code | Résultat final visible / preuve |
| --- | --- | --- |
| Identité | app_key immuable, dépôt moteur + commit, nom de carte, classes autorisées | Même compte Connect, progrès propre au jeu et aucune fuite entre classes/jeux |
| Activité / pédagogie | Unité de réussite, niveaux, séries, aides, modes réellement lançables, contraintes au départ | Vraie saisie au clavier, bonnes réponses et déblocages inchangés |
| XP Connect | Pas d’XP OU barème/version par jalons ; maxima, compléments, premier crédit, répétition 0, reset/repeatXp | Gain sur ACK serveur, animation + jauge + « Reste N XP » sur boutons pertinents ; aucune valeur locale fictive |
| Trophées | Pas de trophées OU clés et coupe visuelle correspondante ; conditions réelles, permanentes, platine éventuelle | Petites coupes encore gagnables dans la **case de l’exercice/mode** ; coupes acquises distinctes ; compteur HUB exact |
| Score | Aucun score OU unité de points, meilleur personnel/jour/historique, compatibilité entre modes | Score à l’écran seulement s’il a un sens ; records natifs préservés, pas de panneau Connect redondant |
| Projection | Sans objet OU classement / exploit / réussite réellement instrumentée | Affichage propre à l’app et à la classe, volontaire si données individuelles, pas de score d’un autre jeu |
| Sauvegarde | Contenu restaurable, version de schéma, offline admis, révision + reset_epoch | Retour HUB/reconnexion/autre appareil sans perte, ACK idempotent, aucun crédit doublé |
| Professeur | Résultats de l’app, détails, réglages classe/élève, visibilité, reset seul jeu, Monsieur T | Gestion du jeu et du tableau sans affecter les autres applications |
| UX / diffusion | Miniature approuvée, favicon commun, petits écrans, catalogue quatre espaces, rollback | Jeu atteint depuis le HUB scolaire prévu après décision de publication |

**Capacité absente = SANS OBJET, pas une dette fictive.** Exemple : un abaque peut valoriser précision, progrès ou étapes franchies sans produire un classement en points ; on peut lui proposer XP/trophées/progrès si son contrat le prévoit, sans lui inventer un score numérique. Les choix pédagogiques ne se déduisent pas d’un jeu voisin.

## 3. Règles UX à ne jamais perdre

### XP : information située là où l’élève choisit sa partie
- Le libellé « Reste N XP » indique le **maximum encore accessible dans la configuration choisie**, et non un gain garanti pour la prochaine partie. Il dépend des droits serveur, niveau, longueur, mode et options pédagogiques sélectionnées.
- Une seule indication officielle dans chaque bouton concerné, discrète, en **bas à droite**, en gardant toute la surface cliquable. Réserver les emplacements des coupes à côté des XP. Tester 320–390 px et PC projeté.
- Inclure séries classiques, 3 vies, Mort subite et HARD *uniquement* si ces modes existent et ont un droit XP. « Reste 0 XP » seulement après réponse serveur confirmée. Masquer les indices Connect en libre, non approuvé ou serveur indisponible.
- Relire au chargement authentifié, lors d’un changement de niveau/choix pertinent et après ACK ; ne jamais calculer de faux restes depuis un ancien texte DOM ou un score.
- Règle de déblocage : afficher la ligne HARD **seulement quand accessible**. Une clé stockée à zéro ne prouve pas un déblocage ; le mode existe quand le serveur et le menu natif le permettent.
- Préserver l’animation de gain XP confirmée (popup, mouvement, jauge) et distinguer le gain reçu du simple texte de notification. Ne pas exiger un score pour accorder des XP.

### Trophées : dans l’exercice, pas perdus dans une page annexe
- À proximité de chaque activité/série/option susceptible d’en fournir, montrer les **petites coupes disponibles ou restantes**, et identifier celles obtenues, sans surcharger la zone pédagogique. Ne pas ajouter des récompenses inexistantes ni afficher un trophée HARD verrouillé comme gagnable immédiatement.
- Pour 3 vies, le patron actuel dit **sans trophée** ; la Mort subite et HARD suivent leurs récompenses natives. Les coupes Platine/Tout débloqué gardent un statut particulier selon le jeu.
- Le total HUB et les coupes dans les boutons proviennent d’une interprétation commune des *récompenses réelles*. Deux additions : 6 bronze + 6 argent + 7 or + platine = **20 coupes visuelles**, bien que leur stockage contienne 25 indicateurs internes. Tester 0/20, partiel et 20/20.
- Une réussite déjà acquise demeure après reset de parcours ; ne pas l’attribuer ou l’animer une deuxième fois. Un retour serveur NULL pour « jamais gagné » doit produire un état **valide et vide** quand le contrat garantit cette situation, pas « trophées indisponibles » ni un faux reçu.
- La case de l’exercice est la **vue de décision**, le HUB le **résumé**, l’archive personnelle l’**historique** : ne pas multiplier les cadres concurrents.

### Score : utile mais non universel
- Les points du jeu, XP, trophées et rang au tableau sont **quatre objets différents**. Un HARD peut donner une réussite sans points ; une app utile n’a pas forcément de record.
- Quand un score existe : conserver « Meilleur score du jour », les coupes et records historiques natifs ; ajouter la proposition de projection **sur la surface existante**, non en remplaçant l’ensemble de la page.
- Un score n’est proposé à la projection qu’après preuve serveur, amélioration admissible et **oui explicite**. Au clic ultérieur sur la case du jour : relire la preuve correspondante ; refuser score local différent, score égal/inférieur ou avant reset. Une réponse « non » ne publie rien.
- Si pas de score : retirer/masquer la fonctionnalité de classement au lieu de fabriquer un « 0 point » ; conserver résultats, étapes et réussites. Pourcentages uniquement si tentatives commencées et critères de réussite sont réellement journalisés.
- Isolation stricte : app_key + élève + classe + mode/parcours/époque. Si Soustraction n’a aucun score publié, le tableau n’affiche **aucune carte Addition** à sa place.

### Projection, exploits et animations
- Le tableau professeur vérifie ses droits et ne charge rien avant « Afficher / Actualiser ». Score individuel et avatar visibles seulement selon le consentement/les permissions appropriés.
- La projection V2 utilise une lecture des résultats toutes les **20 s** quand elle est ouverte et visible ; rotation des applications à **30 s**. Aucun polling XP des jeux pour alimenter le tableau.
- Exploits certifiés et filtrés par jeu : trophée, série parfaite, >10 bonnes réponses en Mort subite, Top 5, remontée spectaculaire. Fenêtre serveur de **36 h** pour les événements prévus ; ne pas inventer d’événement depuis le navigateur.
- Remontée spectaculaire : au moins **3 places** grâce à un meilleur score personnel certifié, contexte de classement comparable. Les dépassements se jouent **élève par élève** (~550 ms), joueur qui dépasse +12 %, dépassé −10 %, petites étincelles à l’arrivée. Un mouvement d’un seul rang peut être animé sans devenir un « exploit ».
- **La file d’animation est par application.** Si Addition est affichée pendant qu’un élève progresse en Soustraction, conserver le mouvement jusqu’à la page Soustraction ; ne jamais jouer la remontée d’une autre app ni la rejouer au retour. Premier chargement, changement de classe, changement de population ou reset ne génèrent aucun faux exploit. Annuler proprement quand l’onglet est masqué ou au départ.
- Le tableau contient au maximum **16 cartes (8+8)** selon configuration, avatars du HUB avant le prénom, podium 1/2/3 numéroté, cartes compactes et lisibles. Une évolution ne doit pas déformer le rendu déjà validé.
- Profil HUB : récompenses de personnalisation aux niveaux 3/6/10/15/20, 24 animaux/24 objets/24 smileys et 20 fonds dont transparent ; célébrer au retour HUB sur acquis réellement confirmés, une seule fois par palier.

## 4. Retour d’expérience : symptômes, cause, correction et raccourci

| Symptôme vécu | Cause démontrée | Correctif / raccourci à réutiliser |
| --- | --- | --- |
| Scores sauvés mais XP absents | RPC, barème et Edge sur versions différentes ; écritures séparées | Préflight des signatures SQL et versions Edge ; transaction unique état + reçu + preuve + XP, tests rollback |
| XP doublés dans les boutons | Simulateur LAB et badge officiel simultanés ; fragment « Reste XP » copié en nœud texte | Dès le démarrage Connect, neutraliser le simulateur, inspecter le **texte final** et le DOM dans Chromium ; test « exactement une occurrence » |
| XP et coupes Mort subite superposés | Deux éléments ancrés à droite au même endroit | Tester leurs **rectangles réels** à 1160 px et 390 px ; déplacer XP à gauche des coupes ou sur ligne adaptée |
| HARD visible avant déblocage | Records HARD à 0 interprétés comme mode ouvert | Se baser sur droits officiels *et* condition native du menu, pas la présence d’une clé |
| Bouton Mort subite perd son texte/bonus | Moteur natif écrase textContent après le patch UI | Conserver la structure enrichie et détecter les mutations tardives avant toute retouche CSS |
| Menu Niveau masqué sous la barre fixe | Portail de liste positionné volontairement au-dessus | Corriger la géométrie dans l’adaptateur, ouvrir sous le bouton, limiter à visualViewport |
| Coupe « 1/25 » au lieu de « 1/20 » | Flags de sous-objectifs comptés comme trophées visuels ; platine dérivée | Déclarer le catalogue **des coupes affichées** ; vérifier HUB et moteur sur profils vide/partiel/complet |
| Trophées invisibles sur profil neuf | RPC retourne NULL pour aucune récompense, UI croit à une panne | Convertir NULL en état vide uniquement si la réponse est authentifiée et validée ; erreur serveur reste erreur |
| « Meilleur score du jour » et historique disparus | Nouveau panneau Connect masque les surfaces natives puis les remplace | Étendre la **carte existante** d’un clic de consentement ; ne pas ajouter un cadre récapitulatif redondant |
| Le classement reprend les scores du mauvais jeu | Élèves sans score représentés comme faux rangs ; colonnes fantômes | Filtrer score absent **par app_key**, conserver le conteneur réellement vide et un message spécifique |
| Rien sous « Nouveaux exploits » | Panneau fixé à un texte de remplacement, aucun événement transmis par Edge | Vérifier le circuit événement → API prof → front ; exploit seulement sur preuve serveur et consentement |
| Animation déclenchée sur une autre application | Rafraîchissement global et rendu sans mémoire par jeu | File par app, snapshots comparables, animation au retour sur la page pertinente, pas de rejouage |
| Une PR fusionnée mais rien dans le navigateur | Confusion entre Git main, GitHub Pages, Edge Supabase, SQL et cache navigateur | Vérifier success du déploiement **sur SHA exact**, hash/URL HTTP publique et version Edge ; changer la version des import JS/HTML |
| Jeu annoncé prêt mais impossible depuis le HUB | Lien direct d’essai confondu avec la vraie carte ; enable serveur ≠ visibilité par classe | Vérifier la chaîne carte élève → catalogue classe → route authentifiée → moteur → ACK → professeur, dans les 4 espaces selon réglages |
| CI verte mais bug visuel évident | Assertions de classes CSS/DOM, pas du texte rendu, ni des géométries | Chromium sur vrai moteur, vrais clics, saisie au clavier, captures desktop/mobile, assertions d’occurrences/position |
| Une PR bloque pour un libellé historique | Test fige une chaîne ancienne, la visibilité d’un autre jeu ou un chemin de cache | Distinguer erreur d’assertion, dépendance réseau et défaut produit ; ne jamais modifier le catalogue élève pour « faire passer » un test |
| Deux conversations travaillent sur les mêmes fichiers | PRs concurrentes, branche obsolète, correctifs écrasés | Responsable unique, lecture du main/PR avant écrire, branche portée limitée, comparer diff et SHAs avant fusion |
| Intégration figée dans des versions test | Produit final construit **après** une succession de LAB, pilotes, hôtes et routes temporaires | Construire l’hôte scolaire cible tout de suite, réutiliser une seule classe fictive pour recette, ouvrir dès preuves et accord ; retirer le câblage expérimental redondant |
| Source autonome altérée sans traçabilité | Copie moteur modifiée en place, tests d’empreinte cassés | Manifeste repo+commit+SHA, ZIP d’archive, patch minimal en adaptateur ; tests de comparaison source |
| App suivante reprend les XP d’une autre | Copie du contrat au lieu d’audit des vraies durées/méthodes | Écrire une table de 3 à 8 exemples chiffrés **de la nouvelle app** avant le SQL et une preuve de plafond |
| Reprise hors ligne crée un doublon | Nouvelle preuve/UUID lors du retry, identité ou époque non revérifiée | UUID durable, ACK exact, une requête, déduplication serveur, quarantaine ancienne époque, pas d’effacement de file sans ACK |
| Compte d’un autre élève réutilisé | Appareil réattribué, cache local lié seulement au JWT | Caches et file isolés par app, classe, sujet Auth, fiche élève résolue, reset_epoch et mode libre/Connect |
| Tests de publication ne couvrent pas la vraie école | Chromium simulé pris pour un vrai élève connecté | Journal de preuve à 4 niveaux ; dernier essai avec profil fictif approuvé, vrai navigateur Pages et vraie carte HUB |

**Sources des incidents :** docs/integrations/RETEX_ERREURS.md ; RETEX_ADDITIONS_UI_20261103.md ; PR #147, #149–#154, #151, #163, #167, #169. Ne pas considérer des incidents historiques comme des pannes actuelles sans reproduction.

## 5. Chemin le plus court vers la version élève (une seule chaîne)

**Lot 0 — préflight (lecture seule, 1 fois).** Lire AGENTS, ce rapport, guide et fiche. Vérifier HEAD main/PR concurrentes, repo moteur/commit, clés et catalogues, inventaire SQL/Edge LIVE, droits outils. Classer ce qui est déjà implémenté : **ne pas réimplémenter une fonction opérationnelle**. Décider explicitement les capacités XP / trophées / score / projection et ce qui est sans objet.

**Lot 1 — contrat pédagogique et squelette final.** Avec un moteur source épinglé, dessiner *directement* la future carte scolaire et son hôte Connect. Un seul routeur/bridge réutilisable, un app_key, une fiche. Conserver la démo libre existante séparée, mais **ne pas créer plusieurs variantes LAB du jeu final**. Chercher les vraies fins (lastWork, réponses, trophées différés), chemins du clavier, modes et boutons effectifs.

**Lot 2 — chemin vertical complet minimal.** Faire réussir UNE activité réelle : carte HUB fictive → session approuvée → activité complète → preuve → RPC atomique / ACK → XP le cas échéant → coupe si admissible → sauvegarde/retour HUB → résultat professeur → affichage de projection si prévu. Une fois cette chaîne prouvée, étendre à tous modes/niveaux avec les mêmes adaptateurs. Ce parcours évite de découvrir à la fin qu’une belle UI ne crédite rien.

**Lot 3 — garanties + visuels.** Tester une matrice **courte mais complète des branches pertinentes** : premier succès, progrès, répétition 0, interruption, reset, changement de classe, double clic/onglet, tous modes réellement accessibles, 320 px, clavier et saisie spécifique. Contrôler XP restant et trophées au bon endroit, aucune collision et pas d’erreur en mode libre.

**Lot 4 — livraison multi-couches.** Une PR/manifest du même SHA ; CI ciblée + non-régression ; SQL seulement si nécessaire, gardé et réversible ; Edge JWT/version prouvée ; fusion, Pages SUCCESS, contrôle HTTP des vrais fichiers, cache-bust des scripts. Faire l’essai connecté sur **profils fictifs déjà approuvés**, idéalement au labo existant mais sur le moteur final lui-même, pas dans une nouvelle version expérimentale. Puis rendre visible dans les classes **autorisées** en vérifiant les 4 catalogues, la page prof et la projection.

**Lot 5 — fermeture, pas de suspens.** Laisser une seule fiche de livraison : APP, main SHA, Edge v/JWT, SQL version/hash, Pages SHA, classes visibles, preuves OK/ÉCHEC/NON EXÉCUTÉ, anomalies, retrait réversible, coût réseau. Fermer/rebaser PRs obsolètes ; mettre à jour le RETEX, pas 5 documents concurrents. Après accord du professeur et vérification des portes, **ne pas laisser la livraison en brouillon**.

### Point d’équilibre : « prêt pour élèves » ≠ « exposé pendant le développement »

La cible technique EST le jeu final dès le premier jour. Un **seul passage court en classe fictive TEST**, avec le même build final et les services sécurisés, suffit normalement à la recette authentifiée. Il reste interdit d’exposer de nouvelles écritures XP aux élèves réels avant les contrôles de sécurité et l’accord sur l’ouverture. Le lancement direct final supprime la **multiplication des architectures de test**, pas la vérification avant l’ouverture.

## 6. Réutilisation concrète et raccourcis de code

- **Deux additions / Objectif record** : apps/objective-record/eleve.mjs, native-connect-bridge.mjs, school-official-unlocks.mjs, school-score-view.mjs ; voir les tests school-native-xp et school-extended.browser. Reprendre les *interfaces*, jamais les IDs/dom du mauvais moteur.
- **Jeux connectés classiques** : apps/calculs-melanges/{connect-host.mjs,completion-contract.mjs,offline-queue.mjs,sync-protocol.mjs,connect-hydration.mjs}. Réutiliser la séparation mode libre/Connect, file/ACK et preuve initiale, adapter la pédagogie.
- **Trophées** : registre permanent connect_trophy_achievements et réponse student-load officielle ; déterminer une seule carte des coupes visibles et de leurs conditions pour HUB et exercice.
- **Projection** : connect-projection-v2 + projection-v2-live.js. Ajouter seulement les capacités de l’app autorisées, app_key isolée, choix d’envoi, préservation des préférences de classe et exploitation sans fausses données.
- **Identité et profil** : connect-context.js, rôle professeur-joueur/Monsieur T, et les validations d’appareil/classe existantes. Ne jamais croire un student_id arbitraire donné par le navigateur.
- **Visuels** : miniature exactement fournie par professeur, WebP léger, favicon Math’as sur **toutes les pages** ; vérifier depuis l’URL Pages, pas seulement une ressource locale.
- **Tests utiles** : première preuve au clavier, doublon XP, reset_epoch, 2 onglets, HARD verrouillé, zéro XP affiché, coupes visibles, simulation + vrai DOM, rang vide sur autre app, publication/consentement et onglets 320/390/1160 px.
- **Archives** : ZIP des moteurs/dépôts d’origine avant remplacement, mais ne pas maintenir simultanément deux moteurs « officiels » actifs. Épingler le commit source, ne pas rompre l’intégrité d’un moteur généré : modifier sa **source de génération** plutôt que le HTML reconstruit.

## 7. Compléments recommandés pour toute fiche de lancement

Ces points manquaient parfois dans les premiers comptes rendus :

1. **Contrat de capacités public** : score facultatif, trophées facultatifs, XP facultatifs, télémétrie % facultative. Pas de « zéro » dans une fonction qui n’existe pas.
2. **Traçabilité de bout en bout** : événement → reçu → ACK → UI → HUB → professeur → projection ; pour chaque maillon, préciser qui est source d’autorité et comment prouver le dernier résultat.
3. **États non heureux** : session en attente/révoquée, serveur indisponible, chargement partiel, refus de publier, sauvegarde locale pendante, app désactivée. Montrer « indisponible » ou « en attente », pas un succès fictif.
4. **Consentement et vie privée** : noms/prénoms/avatars et événements au projecteur seulement selon la politique de visibilité. Surveiller aussi les logs, messages et captures de tests : aucun secret ou résultat personnel publié dans GitHub.
5. **Performance et coûts** : pas de requête par frappe ou paillette ; lecture du profil au chargement/retour et après ACK, pas de polling XP ; projections déjà cadencées à 20 s lorsque visibles. Identifier les index et les charges plutôt qu’augmenter aveuglément la fréquence.
6. **Accessibilité et matériel scolaire** : vrai clavier, focus, touch, petits écrans, projecteur, effets non bloquants, contraste et préférences de mouvement ; aucun effet ne doit décider des XP ou empêcher de jouer.
7. **Décisions de classe** : app installée ≠ app activée ≠ visible dans le HUB d’Observation/Phase 1/Phase 2/2 ECO ≠ intégrée au labo. Respecter les réglages individuels du professeur et les exclusions.
8. **Fiabilité de la recette** : fixture fictive approuvée déjà prête, test de jeu complet et retour au HUB en un seul scénario, statut des 4 couches prouvé, plan de retrait sans destruction.
9. **Coordination** : une intégration = un propriétaire, une fiche, une branche de référence ; ne pas faire deux développements concurrents dans des conversations séparées. Vérifier les droits réels des outils plutôt que réclamer un token ou abandonner une tâche réalisable.
10. **Terminé veut dire livré** : pas seulement PR ou Edge active. Archiver un petit reçu de livraison et fermer les discussions/PR expérimentales inutiles.

## 8. Définition de terminé : checklist de livraison élève

- [ ] Moteur natif fonctionne ; identité, options et vraie fin prouvées, sans régression autres jeux.
- [ ] XP selon contrat (ou SANS OBJET), décompte visible sur chaque bouton concerné, gain ACK/jauge correct, répétition 0, pas de simulation.
- [ ] Trophées selon contrat (ou SANS OBJET) visibles dans la case des exercices/modes, permanents, compteur HUB exact.
- [ ] Scores personnels natifs préservés (ou SANS OBJET) ; pas de mélange entre jeux ; consentement pour score projeté.
- [ ] Sauvegarde, reprise, sortie, retour HUB et affichage professeur/Monsieur T vérifiés, sans double récompense.
- [ ] Projection : capacité explicitée, vrai score/exploit seulement si disponible et autorisé, jeu isolé, aucun classement fictif.
- [ ] Miniature officielle, favicon, 320/390 px, clavier, réglages professeur, visibilité correcte des catalogues.
- [ ] Sécurité JWT/RLS/service_role et SQL/Edge du SHA exact ; aucune opération sur résultats d’élèves réels pour tests.
- [ ] CI sur commit exact + navigateur réel avec profil fictif approuvé ; statut NON EXÉCUTÉ visible si une preuve manque.
- [ ] main fusionné + Pages SUCCESS sur SHA exact + Edge live si concernée + vérification HTTP et carte HUB ; rollback localisé.
- [ ] Retour d’expérience et fiche de passage de flambeau mis à jour ; aucune PR/brouillon obsolète laissée sans suite.

## 9. Références vérifiables et priorité des sources

**Guides communs :** [README intégrations](README.md) ; [Référence technique](REFERENCE_TECHNIQUE.md) ; [Contrat scores/XP/trophées](CONTRAT_COMMUN_SCORES_XP_TROPHEES.md) ; [Erreurs historiques](RETEX_ERREURS.md) ; [Recette/publication](RECETTE_ET_PUBLICATION.md) ; [Automatisation](AUTOMATISATION.md) ; [Source et contradictions](SOURCES_ET_STATUT.md).

**Cas utiles :**
- [RETEX interface additions du 03/11](RETEX_ADDITIONS_UI_20261103.md) et PR [#147](https://github.com/Mr-Tat/Mathas-Connect/pull/147), [#149](https://github.com/Mr-Tat/Mathas-Connect/pull/149), [#150](https://github.com/Mr-Tat/Mathas-Connect/pull/150), [#151](https://github.com/Mr-Tat/Mathas-Connect/pull/151), [#152](https://github.com/Mr-Tat/Mathas-Connect/pull/152).
- Rendu score personnel et consentement : PR [#153](https://github.com/Mr-Tat/Mathas-Connect/pull/153), [#163](https://github.com/Mr-Tat/Mathas-Connect/pull/163).
- Classement et animations : PR [#162](https://github.com/Mr-Tat/Mathas-Connect/pull/162), [#166](https://github.com/Mr-Tat/Mathas-Connect/pull/166), [#167](https://github.com/Mr-Tat/Mathas-Connect/pull/167), [#169](https://github.com/Mr-Tat/Mathas-Connect/pull/169).
- Profil HUB : PR [#157](https://github.com/Mr-Tat/Mathas-Connect/pull/157), [#158](https://github.com/Mr-Tat/Mathas-Connect/pull/158).
- Retours de release : [COMPLETE_2_ADDITIONS_MODES_20261103.md](COMPLETE_2_ADDITIONS_MODES_20261103.md), [ABAQUE_LONGUEURS_PASSAGE_FLAMBEAU.md](ABAQUE_LONGUEURS_PASSAGE_FLAMBEAU.md), [PATRON_REUTILISABLE_OBJECTIF_RECORD_3_VIES_XP_20261101.md](PATRON_REUTILISABLE_OBJECTIF_RECORD_3_VIES_XP_20261101.md).

**Important :** de nombreux rapports antérieurs étaient exacts à leur date mais sont devenus obsolètes (ancienne limite uniforme 500 XP, « 25 trophées visuels », routes LAB comme finalité, projection sans exploits). Ne jamais les copier comme état courant. Toujours réexaminer HEAD main, les paramètres de classe, l’Edge et le catalogue réellement actifs.
