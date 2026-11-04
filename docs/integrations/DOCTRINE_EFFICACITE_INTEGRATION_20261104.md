# Math’as Connect — doctrine d’intégration efficace, orientée version élèves

**Date : 4 novembre 2026 — synthèse transversale des comptes rendus, audits, incidents et PR.**  
**Statut : [DÉCISION professeur] pour les objectifs exprimés le 04/11 ; [REPO vérifié] pour les pratiques et incidents listés ; [PROPOSÉ] pour les optimisations encore non implémentées.**  
Ce document décrit **la façon de travailler pour la prochaine application** ; il n’atteste pas qu’une application particulière est aujourd’hui achevée. Vérifier les versions GitHub / Supabase / Pages au démarrage de toute mission.

> **Doctrine : viser dès le premier jour la version finale utilisable par les élèves, sans multiplier les prototypes. Tester juste ce qui est nécessaire à la sécurité et à la pédagogie ; terminer en publiant et en vérifiant les vraies connexions.**
>
> **Ne jamais sacrifier le jeu pédagogique, les acquis, la vie privée ou les règles Math’as Connect pour gagner quelques minutes.**

## 1. Les 12 règles à transmettre à tout nouvel agent

1. **Un jeu = un moteur préservé + une app_key stable + un contrat explicite.** Ne jamais modifier les autres jeux pour faire fonctionner le nouveau. Garder SHA du moteur et archive ZIP de l’ancien si une bascule le remplace.
2. **Cibler directement la sortie scolaire.** Une seule branche de livraison, une vraie page élève Connect comme cible, son catalogue, ses pages professeur et sa projection selon les capacités. Ne pas passer par trois versions de laboratoire si la même intégration peut être éprouvée directement.
3. **Le laboratoire est un sas de recette, pas une seconde application à développer.** Utiliser uniquement les élèves fictifs approuvés et les contrôles d’authentification requis ; si un pilote fermé est indispensable, il doit exécuter le **même code** que la future version élèves et être très court. Un lien Pages « secret » n’est pas un contrôle de sécurité.
4. **Les XP sont des jalons de compétence, pas un score de partie.** Barème du jeu, preuve côté serveur, crédit définitif par jalon ou par complément, double envoi = zéro XP supplémentaire. Un outil sans XP est admissible.
5. **Sur tous les boutons donnant des XP, afficher discrètement « Reste N XP »**, en bas à droite sans chevauchement. Y compris « Reste 0 XP » si zéro est confirmé ; cacher entièrement si la valeur est indisponible, la session non approuvée ou le mode libre. Ne pas écrire « Reste… XP » dans le titre du bouton. Le nombre est le droit **encore accessible** pour cette configuration, non la récompense promise pour la prochaine partie.
6. **Dans les cases/boutons d’exercice, montrer les trophées qui restent à obtenir**, quand le jeu en possède et que la condition est liée à cette case ou ce mode. Une coupe acquise et une coupe restant à gagner doivent être visuellement différentes ; le badge ne doit jamais cacher le texte, les XP ou la surface cliquable. Aucun trophée fictif pour compléter une grille.
7. **Trophées permanents et comptage exact.** Le compteur représente les trophées **pédagogiquement visibles et atteignables**, pas les sous-indicateurs techniques. Pour les deux additions auditées : 20 coupes visibles, et non 25 drapeaux internes ; pour l’Abaque, son propre contrat de six coupes. Une remise à zéro du parcours ne reprend ni ne recrédite un trophée déjà gagné.
8. **Le score est une capacité optionnelle.** Ne pas fabriquer de score ou de concours pour un exercice où cela n’a aucun sens. Si l’application possède un score, définir ses unités, records, modes comparables, date locale et règles de projection ; sinon statut « sans score », pas zéro inventé.
9. **Projection branchée dès la conception, pas en dernière minute.** Chaque app avec classement utilise son propre score, sa propre période de remise à zéro et son consentement explicite **par événement certifié**. Ne jamais copier les points d’une autre app ni exposer un score privé. Pour les apps sans score, déterminer explicitement si des réussites/trophées autorisés sont présentables sans classement.
10. **Boucle élève → serveur → HUB → professeur → projection complète.** Le même acquis doit être conservé après reconnexion, changer d’app, reload, déconnexion puis retour ; et s’afficher correctement sur chaque surface autorisée. « Fonctionne dans le jeu » ne signifie pas « intégré à Math’as ».
11. **Une seule source officielle pour chaque donnée.** XP, trophées, accès HARD et reçus proviennent de Connect, jamais du simulateur LAB, d’un texte réécrit par le moteur ou du localStorage libre. Séparer les trois couches : moteur natif, wrapper d’iframe, hôte Connect.
12. **Terminer réellement la livraison.** CI du SHA exact, migrations ciblées si requises, Edge à la bonne version et JWT, fusion, Pages « SUCCESS », catalogue ouvert dans les espaces souhaités, test HTTP du contenu publié, essai authentifié fictif quand nécessaire, puis compte rendu. **Une PR ouverte, même verte, n’est pas mise en ligne.**

## 2. Matrice de capacités à remplir AVANT le code

Pour toute nouvelle app, décider et écrire « OUI / NON / NON APPLICABLE / À DÉCIDER » pour chacune des colonnes ci-dessous, avec condition et preuve. Une colonne absente ne devient **jamais** implicitement « oui ».

| Capacité | Décision pédagogique nécessaire | Conséquence technique / écran |
| --- | --- | --- |
| Mode libre | Oui par défaut si moteur autonome | Fonctionne sans Auth ni réseau Connect, cache isolé |
| Identification Connect | Nécessaire pour les acquis scolaires | JWT et élève/appareil/classe approuvés par serveur |
| XP | Seulement si des acquis/jalons ont du sens | Barème par app et niveau ; « Reste N XP » officiel sur boutons concernés |
| Trophées | Seulement si distinctions natives/validées | Coupes à obtenir dans la case concernée ; acquis permanents ; total visible exact |
| Score / record personnel | Facultatif ; dépend de l’activité | Record du jour/historique uniquement si significatifs ; pas de score créé pour remplir une carte |
| Projection du score | Facultative si score absent ; si présente, réglable par professeur | Score isolé par app, événement certifié + consentement explicite ; aucun chiffre inter-jeux |
| Exploits projetés | Seulement avec preuve et affichage autorisé | Trophée, série parfaite, performance, Top 5, remontée suivant les règles vérifiées |
| Niveaux / modes / HARD | Respect des conditions du moteur | Verrous fondés sur la lecture officielle ; ne pas révéler HARD grâce à un record 0 |
| Sauvegarde/reprise | Selon la nature du jeu, expliciter le minimum | État par fiche/app/époque, reprise et ACK contrôlé, sans mélange entre libre et Connect |
| Tableau professeur | Résultats compact/détail pertinents | App isolée, filtre de classe, réinitialisation ciblée, droits enseignant |
| HUB et miniature | Oui pour tout jeu diffusé | Vraie carte, vrai lanceur, retour HUB, image officielle, cinq espaces/catalogues selon choix professeur |
| Animations | Uniquement depuis événement authentique | Delta XP, trophée, nouvelle place ; jamais une animation déclenchée par un mock ou par simple rafraîchissement |

**Décision spécifique à prendre en début de projet :** les seuils XP, le nombre de coupes visibles, les modes accessibles, le calcul exact des points et les éventuelles exceptions (Master, 3 vies, HARD, méthodes, aides). Ne pas reprendre automatiquement le plafond d’Addition ou celui de Mélange.

## 3. Invariants pédagogiques et visuels

### XP et progression globale
- Les XP Connect alimentent une progression **globale** entre applications ; leurs droits et paliers restent **propres à chaque app**. Pour un meilleur acquis, seul le **complément** est crédité. Rejouer la même performance donne zéro par défaut, même après refresh. Les niveaux n’octroient pas eux-mêmes des XP en double.
- Dans le HUB et le profil, conserver niveau, jauge, prochain seuil, XP et trophées réels. Les célébrations de niveau suivent uniquement la confirmation serveur et ne se répètent pas à chaque retour sur le HUB.
- Sur les boutons de séries, niveaux et modes : badge officiel petit, en bas à droite ; si des coupes sont dans le même coin, placer les XP **à gauche** ou au-dessus selon la largeur. Tester le rectangle final de chaque élément à 390 et 1160 px. Le texte principal du bouton reste lisible et cliquable.
- La somme « XP encore accessibles » doit tenir compte des options **sélectionnées au début** de la partie, du niveau, des droits déjà attribués, des jalons partagés entre modes et de l’époque du parcours. Ce n’est pas l’estimation calculée par le jeu. Une valeur serveur indisponible n’est jamais « 0 ».
- Le mode libre, Master et la démo n’importent ni crédits ni nouveaux déblocages artificiels dans le compte scolaire.

### Trophées et coupes
- Identifier toutes les distinctions du moteur, leurs **conditions pédagogiques réellement atteignables**, leurs états non acquis/acquis, leur affichage en contexte et leur total dans le HUB. Une condition partielle et une coupe complète ne comptent pas pareil.
- Afficher les coupes **dans la case de l’exercice ou du mode concerné** quand cela aide l’élève à choisir son prochain objectif. Montrer celles encore à récupérer et distinguer sans ambiguïté les coupes acquises. Les indicateurs peuvent être réduits visuellement si l’espace est serré, mais pas supprimés pour faire place à un badge Connect.
- Ne pas laisser les sous-conditions techniques remonter comme autant de coupes dans le HUB (incident 25 indicateurs contre 20 coupes des additions).
- Un élève nouveau a **0 acquis**, mais doit quand même voir les trophées disponibles à gagner : gérer correctement le retour SQL NULL d’un registre vide. Un échec de lecture n’est pas un état « aucun trophée ».
- Réinitialiser le score ou l’exercice ne détruit jamais les trophées permanents, n’émet pas de doublon et ne rejoue pas l’animation de première acquisition.

### Scores et projection
- Les points appartiennent au moteur, non au barème XP. Des applications sans points peuvent rester pleinement utiles dans Math’as Connect. Une app n’affiche pas un bouton « partager » si aucun score comparable n’existe.
- Pour une app avec score : distinguer meilleur du jour (jour civil Europe/Brussels), records historiques, modes et niveaux, et meilleure performance admissible pour le tableau. **Ne jamais fusionner le classement des applications**.
- La proposition d’envoi est un **choix Oui/Non** explicite, attaché à l’événement officiel : le clic sur le meilleur score du jour peut rouvrir le choix, mais le score local doit correspondre à un événement certifié. Les anciens résultats privés ne deviennent pas publics par défaut.
- Rendre les résultats professeur utilisables, dans la classe et l’application adéquates, et vérifier le tableau de projection sur une véritable réponse Edge. Ne pas confondre « données présentes dans Supabase » et « panneau effectivement alimenté » (incident « Nouveaux exploits » statique).
- **État Projection V2 vérifié en code le 04/11/2026 :** actualisation seulement si projection active/visible toutes les 20 s ; rotation des applications toutes les 30 s ; exploits récents certifiés, par app, avec autorisation d’affichage ; remontée spectaculaire à partir de 3 places avec record certifié ; mouvements un élève à la fois, différés jusqu’à l’affichage du bon jeu, sans replay. Ces paramètres doivent être **relus** lors des futures intégrations ; ne pas les traiter comme des constantes éternelles.
- Les « % de réussite » exigent un vrai dénominateur des exercices **effectivement commencés** ; en l’absence de télémétrie complète, afficher « — » et jamais un taux fictif.

### Préserver le jeu
- Respecter les modes, reports, retenues, emprunts, méthodes, aides, tables autorisées, choix d’opérations, paramètres HARD, conditions de déblocage et animations d’origine.
- Préserver les records natifs et les cartes existantes : **brancher** Connect sur le vrai composant, ne pas le remplacer par un nouveau cadre en doublon. Vérifier le DOM *après* les scripts du moteur.
- Garder les miniatures demandées par le professeur, optimisées et testées via l’URL Pages ; favicon Math’as sur toutes les pages. Vérifier petits écrans, clavier, focus, menus ouverts vers un espace disponible et préférence de mouvements réduits.

## 4. Incidents documentés — chercher ici AVANT de déboguer

| Symptomatique | Cause réelle rencontrée | Solution ou raccourci réutilisable | Preuve / référence |
| --- | --- | --- | --- |
| Partie enregistrée mais XP manquants | Edge, allowlist et RPC de crédit non alignées ; état et XP en écritures séparées | Contrat appKey unique ; transaction serveur état + XP + reçu ; échec tardif rollback | Audit Addition multiple ; RETEX_ERREURS |
| JWT correct mais preuve refusée en HTTP 503/400 | Vérification d’expectedStudentId sur une route qui résout déjà la fiche serveur ; sessionId exigé mais exclu de la liste des champs | Test de **vraie requête** sur le prédicat Edge ; conserver allowlist exacte cohérente | PR #129 et #133 |
| XP attribués depuis un bouton natif non certifié | Le wrapper servait une interface mais le clic lançait l’ancienne voie libre | Intercepter le **vrai bouton**, prouver le flux serveur, vérifier le second clic « Démarrer » | PR #147 |
| « Reste N XP » en double ou collé au titre | Simulateur LAB + badge Connect ; réécriture tardive de textContent/innerHTML en texte nu | Couper le simulateur **avant** création d’iframe Connect ; inspecter les **nœuds texte** et géométrie finale | PR #150, #152 ; RETEX_ADDITIONS_UI |
| HARD visible trop tôt | Présence d’un champ de record à zéro assimilée à un droit de jeu | Déblocage à partir de student-load officiel et test du **mode lançable** | PR #148, #150 |
| Trophées non visibles sur profil neuf | RPC renvoie NULL quand aucun acquis n’existe | Snapshot officiel initial avec coupes non acquises ; une panne RPC reste une panne, non un faux 0 | PR #149 |
| « 25 trophées » alors que l’élève voit 20 coupes | Sous-indicateurs V3 additionnés comme objets visibles ; Platine dérivée oubliée | Mapper drapeaux → trophées **pédagogiques** au serveur ; tests vide/partiel/complet | PR #151 |
| Coupes / XP se chevauchent sur Mort subite | Positionnement absolu au même coin et padding insuffisant | Badge XP à gauche des coupes, repli sur deux lignes si nécessaire ; assertions de rectangles | PR #152 |
| Bouton Mort subite perd sa légende | Script natif remplace textContent et détruit les sous-éléments du bouton | Ne modifier que le texte de secours, conserver l’arbre DOM enrichi | PR #150 |
| Sélection Niveau coupée par le haut | Portal natif ouvert explicitement vers le haut derrière barre fixe | Position sous le bouton, visualViewport, max-height et scroll interne | PR #150 |
| Le meilleur score du jour / podium disparaissent | Nouveau module Connect masquait les surfaces natives et recréait ses propres cartes | Ne pas masquer les surfaces natives ; rendre le Top du jour cliquable **sur place** | PR #163 |
| Les scores d’Addition semblent exister dans Soustraction | Modèle de classement gardait des élèves sans score du jeu courant comme lignes vides | Filtrer par appKey et seulement score publié ; vrai conteneur vide, jamais de score partagé | PR #162 |
| Panneau d’exploits vide malgré trophées en base | HTML affichait un texte fixe, API professeur ne renvoyait pas les événements | Boucler réellement événement certifié serveur → Edge → panneau visible ; test du panneau et des droits | PR #167 |
| Remontée observée sur la mauvaise application | Re-rendu à chaque refresh sans état de comparaison propre à chaque app | File de mouvements par app ; jouer uniquement quand sa page est à l’écran ; pas au premier chargement | PR #169 |
| Cartes de classement trop étroites / podium illisible | CSS flex et largeur auto ; tests sans feuille CSS chargée | Vérifier dimensions calculées Chromium, type MIME CSS, état 5/14/16 élèves | PR #160, #161, #162 |
| Résultats perdus après reset / deux onglets | Mauvaise époque, mauvais ACK ou cache d’un ancien élève | Événement durable, ACK exact, contrôle resetEpoch, quarantaine non destructive, 409 traité | PR #122 ; RETEX_ERREURS |
| Les tests montrent un faux échec | Chaîne attendue ancienne, vrai site inaccessible, CSS servi avec mauvais MIME, PostgreSQL socket prêt mais TCP non prêt | Examiner logs avant de changer le produit ; isoler CI locale, réseau et contrat ; garder assertions de sécurité | RETEX_ERREURS ; PR #160 |
| La PR est verte mais le jeu n’est pas en ligne | Fusion non faite, Pages non terminé, Edge/SQL non redéployés, cache ancien, catalogue resté caché | Vérifier séparément **PR merged, main, Pages success, Edge ACTIVE + code exact, SQL, visibilité et navigateur connecté** | PR #162–#169 ; RECETTE_ET_PUBLICATION |
| Deux agents modifient les mêmes fichiers | PR concurrentes à objectifs divergents, double travail LAB, reprise sans statut | Une conversation/branche propriétaire par application ; autres agents = PR non chevauchantes ; reprise courte et SHA | PR #140/#141 et #142 ; issue #125 |
| Bilan ancien pris pour état du jour | Audits datés décrivant des fonctions désormais remplacées | Marquer [HISTORIQUE] ; relire HEAD main, SQL, Edge et site publié | SOURCES_ET_STATUT |

## 5. Le chemin le plus court vers une véritable version élèves

**Une seule trajectoire, avec des contrôles à des endroits fixes, pas des générations successives.**

| Étape | Travail à faire une fois | Livrable / porte |
| --- | --- | --- |
| **0. Préflight (lecture seule)** | Vérifier dépôts et droits outils, HEAD, PR concurrentes, moteur, SQL/Edge existants et disponibilité des outils. Lire guides et fiches, ne pas solliciter de secret sans vérifier l’accès déjà présent. | Une fiche d’application, appKey, capacités OUI/NON, risques P0 |
| **1. Spécification minimale** | Identifier la vraie fin de partie, variantes, options, conditions d’XP, coupes et éventuel score ; définir comportement professeur/HUB/projection. | Tableau de jalons **chiffré** et scénarios d’acceptation ; seules ambiguïtés pédagogiques remontent au professeur |
| **2. Intégration Connect directement scolaire** | Copier le moteur à SHA figé, adapter à l’auth officielle, construire le lanceur final, les badges « Reste N XP », trophées à gagner, sauvegarde, offres de partage si score, liaison professeur et HUB. | **Un seul candidat final** et une PR principale ; pas un nouveau prototype |
| **3. Sécurité et tests ciblés** | Tests purs du contrat, PostgreSQL jetable si écriture XP, test Deno/Edge s’il change, Chromium vrai moteur au clavier, mobile, flux fin→ACK→XP→trophée→HUB→prof→projection ; régression limitée aux surfaces touchées. | CI verte sur SHA exact, aucune anomalie P0/P1, plan de retrait |
| **4. Livraison en couches** | SQL additif gardé si nécessaire → vérifier RLS/grants → Edge/version/JWT si nécessaire → Pages → catalogue/feature flag → vérifier vraies URLs. Ne pas redéployer une Edge inchangée. | Provenance **LIVE** par couche, catalogue ouvert dans les classes autorisées |
| **5. Recette authentifiée brève et clôture** | Une session fictive approuvée sur Pages quand l’Auth et les XP l’exigent : lancer la vraie carte, jouer une partie, confirmer/recharger XP, trophée et score; vérifier résultats professeur et proposition projection si applicable. | « OUVERT AUX ÉLÈVES » uniquement quand démontré ; sinon défaut bloquant nommé, pas une énième version de laboratoire |

**Règle de décision pour le Laboratoire, actualisée le 04/11/2026 :** le guide historique du 31/10 demandait un déploiement d’abord dans le LAB. La priorité exprimée maintenant est **la version finale élèves sans multiplication des essais**. Le LAB reste nécessaire lorsqu’une opération sensible doit être prouvée **sans exposer les élèves réels** : sa carte utilise le **même candidat final**, sous garde de visibilité/permissions et pour une durée de recette limitée. Il n’est plus une étape de développement systématique ni un espace de variantes concurrentes. Ne jamais court-circuiter l’autorisation et les tests de sécurité pour gagner du temps.

**Raccourcis concrets :**
- Réutiliser les modèles **TEMPLATE_FICHE_APPLICATION** et **TEMPLATE_PASSAGE_FLAMBEAU** ; un rapport d’une page et une PR bien renseignée valent mieux que trois ZIP contradictoires.
- Réutiliser les **adaptateurs/contrats communs** testés, mais pas les algorithmes ni les IDs d’une autre application. Inspecter **une seule fois** les sélecteurs et les mutations natives, puis écrire des tests ciblés.
- Dans les moteurs HTML volumineux/générés, préférer adaptateur/bridge, confirmer le motif de remplacement exact, et noter commit + SHA. Ne pas patcher à l’aveugle 700 Ko de HTML.
- Réserver un seul **test complet réaliste** par famille de comportement (clavier → fin → reçu), puis des cas unitaires exhaustifs pour les bornes ; un test géométrique sur petit et grand écran avant de déclarer la maquette bonne.
- Relire le contenu publié par HTTP (cache-buster) et la réponse Edge actuelle au lieu de conclure à la vue d’un commit Git.
- **Fusionner et publier après réussite**, sans oublier la PR : la recette de classe attend une URL élèves fonctionnelle et un compte rendu final, pas un brouillon GitHub.

## 6. Contrôle qualité minimal (et non négociable)

Utiliser **OK / ÉCHEC / NON EXÉCUTÉ / SANS OBJET**. Pas de validation par intuition ou par capture d’un prototype.

| Preuve | Question qui doit recevoir une réponse |
| --- | --- |
| **Pédagogie** | Les niveaux, aides, méthodes, corrections et modes du moteur natif sont-ils restés exacts ? |
| **Connect** | Le jeu sait-il distinguer libre/Connect, élève approuvé, classe, Monsieur T et révocation ? |
| **XP** | Une vraie fin prouvée donne-t-elle le bon delta ? Un double clic/reload donne-t-il 0 XP en plus ? Le « Reste N XP » est-il vrai et unique ? |
| **Trophées** | Les coupes restant à gagner sont-elles visibles dans les bonnes cases ? Déblocage et compteur HUB sont-ils identiques après reload/reset ? |
| **Score** | Existe-t-il vraiment pour ce jeu ? Si non, la projection ne fabrique-t-elle aucun classement ? Si oui, records et consentement sont-ils corrects ? |
| **HUB / professeur** | L’application est-elle lancée depuis la vraie carte, correctement activable par classe, avec résultats et réglages appropriés ? |
| **Projection** | L’application s’affiche-t-elle à sa propre page sans les scores des autres ? Les exploits sont-ils authentiques et consentis ? |
| **UX** | 320/390 px et écran scolaire, clavier, focus, menus, coupes/XP sans chevauchement, chargement et bouton retour HUB ? |
| **Persistance** | Offline et ACK (si applicables), cache isolé, reset de cette app uniquement, acquis permanents intacts ? |
| **Livraison** | SHA main, runs CI, Pages succès, versions Edge/SQL si modifiées, catalogue classes et essai hébergé authentifié sont-ils attestés ? |
| **Retour** | Comment masquer / désactiver cette app seule sans supprimer XP, trophées, reçus ni autres jeux ? |

## 7. Les compléments qui manquaient souvent aux comptes rendus

1. **Une définition claire de « TERMINÉ ».** Quatre statuts indépendants : fonctionnel dans le jeu / relié à Connect / publié sur le site / ouvert aux élèves et vérifié. Pas de « fini » générique.
2. **Un inventaire des capacités, y compris des ABSENCES.** Sans score, sans XP, sans coupes, sans HARD, sans mode connecté hors ligne : mentionner **sans objet** plutôt qu'inventer.
3. **Un tableau des responsabilités.** Source moteur autonome, adaptateur Connect, serveur XP, registre trophées, catalogue, projection et professeur : à qui appartient la règle ? Ne pas modifier trois couches pour une seule étiquette.
4. **Une visibilité réelle des objectifs pédagogiques.** L’élève sait ce qui reste à gagner : XP accessibles et trophées de sa case ; mais les données indisponibles ne sont pas transformées en faux zéros.
5. **Le coût / les performances en classe.** Pas d’appel par frappe, pas de polling XP, de relecture de tous les élèves sur chaque animation ni d’écritures de diagnostic ; vérifier requêtes et rafraîchissements existants, assets optimisés et autonomie faible réseau. Conserver un point de suivi de consommation GitHub Pages/Supabase.
6. **La réversibilité sans destruction.** Une sauvegarde du moteur original et un interrupteur de visibilité sont plus utiles qu’une restauration globale risquant de supprimer les progrès.
7. **L’accessibilité pédagogique.** Contraste, lisibilité, clavier, 320 px, animation réduite, messages compréhensibles pour l’élève ; une interface jolie mais impraticable sur PC scolaire n’est pas livrée.
8. **Un propriétaire de l’intégration.** Une branche principale et une personne/conversation responsable des fusions ; passage de flambeau qui dit exactement quoi faire ensuite et ce qui est déjà en production.
9. **Une doctrine de preuve.** Séparer [DÉCISION professeur], [REPO], [CI simulée], [HTTP Pages], [EDGE/SQL LIVE], [NAVIGATEUR AUTHENTIFIÉ] et [NON EXÉCUTÉ], toujours avec date et SHA.
10. **Une observation après publication.** Vérifier le premier retour d’usage en classe et corriger un éventuel P1 par un patch étroit, sans rouvrir une nouvelle suite de LAB/branches parallèles.

## 8. Instruction courte à recopier au lancement du prochain jeu

> Intègre [NOM DU JEU] **directement en version finale élève Math’as Connect**. Lis AGENTS.md, ce document, la fiche et les incidents. Vérifie d’abord tes accès GitHub et Supabase ainsi que l’état de main, Edge et Pages. Préserve le moteur autonome et son contrat pédagogique. Déclare explicitement si ce jeu possède XP, trophées et score : n’invente aucune capacité absente. Affiche les vrais **« Reste N XP »** sur les boutons concernés et **les coupes à obtenir** dans les cases d’exercice, selon l’état officiel, sans badge en double. Prends en charge les niveaux, trophées permanents, sauvegarde, HUB, professeur/Monsieur T, catalogue et projection adaptée au jeu (score certifié et consentement si pertinent). Une seule branche/PR de sortie ; tests ciblés de contrat, XP, rendu et réseau ; un sas fictif authentifié uniquement s’il est nécessaire ; publication GitHub Pages et Edge/SQL selon leur ordre sûr ; **fusion, vérification des versions live et ouverture contrôlée pour élèves**. Signale uniquement les choix pédagogiques manquants, les blocages P0/P1 ou les permissions indispensables. Termine par un compte rendu court : ouvert / non ouvert, preuves, anomalie et prochaine action.

## 9. Sources de ce RETEX (historiques, à ne pas prendre pour des états live)

- Guide permanent : [README](README.md), [référence technique](REFERENCE_TECHNIQUE.md), [contrat scores/XP/trophées](CONTRAT_COMMUN_SCORES_XP_TROPHEES.md), [recette](RECETTE_ET_PUBLICATION.md), [erreurs](RETEX_ERREURS.md), [automation](AUTOMATISATION.md), [sources et contradictions](SOURCES_ET_STATUT.md).
- Deux additions : [RETEX interface](RETEX_ADDITIONS_UI_20261103.md), [modes certifiés](COMPLETE_2_ADDITIONS_MODES_20261103.md), [patron d’exercices](PATRON_REUTILISABLE_OBJECTIF_RECORD_3_VIES_XP_20261101.md), PR [#129](https://github.com/Mr-Tat/Mathas-Connect/pull/129), [#133](https://github.com/Mr-Tat/Mathas-Connect/pull/133), [#147](https://github.com/Mr-Tat/Mathas-Connect/pull/147) à [#153](https://github.com/Mr-Tat/Mathas-Connect/pull/153), [#163](https://github.com/Mr-Tat/Mathas-Connect/pull/163).
- Mélange : [intégration](../CALCULS_MELANGES_INTEGRATION_20261030.md), [publication](../PUBLICATION_CALCULS_MELANGES_20261030.md), [XP et sélection](../CALCULS_MELANGES_XP_SELECTION_20261030.md).
- Addition multiple : [audit critique](../AUDIT_ADDITION_PLUSIEURS_2026-10-29.md), [préparation](../PREPARATION_PROCHAINES_INTEGRATIONS_20261029.md).
- Abaque : [fiche](ABAQUE_LONGUEURS_FICHE.md), [passage de flambeau](ABAQUE_LONGUEURS_PASSAGE_FLAMBEAU.md), [déploiement](ABAQUE_LONGUEURS_DEPLOIEMENT.md).
- Projection : [contrat V2](PROJECTION_V2_CHANTIERS_20261031.md) et PR [#160](https://github.com/Mr-Tat/Mathas-Connect/pull/160), [#162](https://github.com/Mr-Tat/Mathas-Connect/pull/162), [#167](https://github.com/Mr-Tat/Mathas-Connect/pull/167), [#169](https://github.com/Mr-Tat/Mathas-Connect/pull/169).
- Les anciens ZIP, comptes rendus et PR documentent des **incidents passés**, non des anomalies encore actives. Toute affirmation d'état réel doit être vérifiée à nouveau au jour de l'intégration.
