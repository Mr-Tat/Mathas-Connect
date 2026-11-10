# Multiplication simple — guidé collectif (10/11/2026)

## Décisions pédagogiques validées
- Première étape : **multiplication simple seulement**, puis retour d’expérience avant les trois autres jeux.
- Même paire d'opérations par classe, réponses et corrections **individuelles**, sans synchroniser les chiffres du professeur.
- Seul le professeur lance/arrête la séance, ouvre de nouvelles pages ou choisit une page déjà enregistrée. Les élèves avancent **librement par défaut** dès que la suivante est ouverte ; une **Page obligatoire** exige la validation des deux calculs, correction après erreur acceptée.
- « M'entraîner en attendant » utilise le guidé individuel, puis « Rejoindre la classe » rétablit les opérations partagées.
- Corrigés exclusivement professeur sous les cases, avec ligne de résultats et ligne de petits reports, confirmation Oui/Non neutre. **Pas de mode « Élève au tableau » ni de PIN** (options abandonnées).
- XP : **SANS OBJET** ; trophées : **SANS OBJET** ; scores : **SANS OBJET** (aucun nouveau barème ni résultat scolaire).

## Architecture
- Moteur original inchangé ; pont natif injecté uniquement depuis l'hôte Connect, points d'insertion vérifiés ; les activités non guidées et le mode libre restent inchangés.
- Edge dédiée « connect-guided-multiplication » : authentification, inscription/permission, visibilité HUB, décisions professeur côté serveur. Les élèves n'ont qu'un accès à la lecture.
- Table RLS privée de séance : deux opérations par page, config, progression des pages et version ; aucune réponse, score, XP ou donnée de résultat élève.
- Poll léger et reprise après réseau absent.

## État actuel et reprise après incident
- **Décision validée du 10/11/2026** : une sauvegarde de secours locale élève doit survivre à F5/couac dans le même onglet. Réalisation : [PR #294](https://github.com/Mr-Tat/Mathas-Connect/pull/294). `collective-draft.mjs` et extensions du pont natif ; namespace `sessionStorage` par classe / utilisateur / séance, contrôle des calculs, 120 Kio et 12 h maximum ; aucun écrit élève sur le réseau ; aucun changement de mode obligatoire ou de navigation.
- **Preuve ciblée sur #294** : [Chromium + tests Node](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/42856327937) : 31 tests réussis, 0 échec ; vérification F5, réponses sur deux pages, isolation A/B, UUID nouveau, expiration, quota bloqué. **À vérifier après fusion : Pages sur SHA exact, puis recette hébergée réelle.** SQL/Edge non modifiés par #294.
- **Passation aux trois autres calculs écrits** : [document de transfert final](PASSATION_GUIDE_COLLECTIF_AUTRES_CALCULS_20261110.md) ; suivre ses décisions finales plutôt que les variantes anciennes décrites plus bas.

## Historique initial et preuves à distinguer
- Code fusionné sur `main` : [PR #279](https://github.com/Mr-Tat/Mathas-Connect/pull/279) (pilote), [PR #280](https://github.com/Mr-Tat/Mathas-Connect/pull/280) (lancer/rejoindre depuis un guidé déjà ouvert). Dernier SHA fonctionnel `c0fa401c`.
- Code : PR #279 ; tests navigateur Chromium **13+ cas réussis** au SHA `55854831` (run [42813878262](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/42813878262)). Tests d'intégration et de validation manuelle existants réussis. La suite globale comporte 4 échecs de référence hors périmètre (3 miniatures, guide Laboratoire), plus une assertion de test du pilote corrigée ensuite.
- SQL : migration `guided_multiplication_classroom_20261110` **appliquée** le 10/11/2026 sur le projet Connect ; RLS et grants service_role vérifiés, table vide.
- Edge : `connect-guided-multiplication` **déployée** (version 1 ACTIVE, vérification JWT active) ; aucun score ou profil élève modifié.
- GitHub Pages : **publication réussie le 10/11/2026** pour SHA `c0fa401c`, [workflow #42815242183](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/42815242183).
- Tests navigateur Chromium : le pilote et le correctif #280 réussis, dont prof/élève, copie des opérations, pages, passage libre, entraînement et mode Élève au tableau ; recette authentifiée en classe **non encore exécutée**.
- Les quatre échecs récurrents du test de régression global concernent des miniatures et le guide de laboratoire hors de ce chantier ; ne pas les présenter comme des tests du guidé collectif.
- Recette fictive encore à réaliser en vrai navigateur connecté : Monsieur T / Élève A ou B (classe TEST), mêmes calculs et réponses indépendantes, pages ordinaires libres / obligatoires, entraînement puis retour, F5 et sauvegarde de secours, fermeture de l'onglet professeur, petit écran, réseau intermittent.
- Ne modifier aucune visibilité de classe, aucun résultat de vrais élèves et aucune application autre que Multiplication simple.

## Incidents corrigés et raccourcis
- Au premier branchement, le contrôleur collectif était initialisé avant son drapeau de disponibilité : erreur d'accès anticipé à une variable et absence d'iframe. Corrigé en initialisant après le pont natif ; le module optionnel tombe désormais en panne sans bloquer le jeu.
- Les fixtures de test ne servaient pas les nouveaux modules : ajout explicite aux routes du serveur HTTP de Chromium.
- Le clavier natif utilise des champs `readonly` remplis par le pavé virtuel ; les essais Playwright ne doivent pas recourir à `locator.fill()` sur ces champs.
- Le besoin de pouvoir démarrer et rejoindre depuis le guidé ouvert a entraîné la PR #280, testée avec de vrais moteurs Chromium simulés.
- PR #282 (ergonomie demandée en classe) : bouton professeur aligné à droite du grand « Exercice guidé » ; bouton élève « Rejoindre la classe » dans le guidé individuel, visible même sans séance. La vérification de l'existence de la séance ne part **que sur son clic**. Une fois inscrit à la séance, une synchronisation légère suit les pages débloquées. Tests Chromium sur 320/390/1160 px et vérification qu'aucun appel collectif n'a lieu avant le clic. Déploiement Pages à confirmer séparément.

## Identification visible de la classe — PR #283 (10/11/2026)
- Le lancement collectif et la recherche élève continuent à utiliser l'**ID de classe Connect** validé côté serveur. Le nom visible est déduit de cette ID, pas de l'étiquette de rubrique « Toutes » du HUB.
- Le professeur voit le badge près du lancement collectif ; l'élève le voit près de « Rejoindre la classe » ; le profil Connect visible dans la partie affiche la classe juste après le niveau, en mode professeur comme en mode élève.
- Classe TEST (rubrique « Toutes ») et Phase 1 sont explicitement distinguées ; les autres classes officielles ont leurs libellés habituels. Une nouvelle classe non reconnue affichera son préfixe d'ID, sans inventer un nom.
- Contrôles : Chromium du guidé et des comptes simulés TEST / Phase 1 / Monsieur T, y compris la version compacte. SQL/Edge : aucun changement. Recette réelle des deux comptes : encore à faire.

## Fin de séance à la fermeture de l'onglet professeur — 10/11/2026
- Périmètre : **seulement** la séance guidée collective Multiplication, jamais la connexion Math'as Connect, les XP, les records ou les comptes élèves.
- Fermeture/navigation réelle de la page du professeur : un `pagehide` non-bfcache envoie une notification authentifiée via `fetch(...,keepalive:true)` ; une simple bascule vers un autre onglet ne déclenche pas cette notification.
- Le serveur attend **15 secondes** avant de considérer le départ effectif : un rechargement F5 de la **même** page/onglet peut la reprendre. Une génération de page (UUID neuf) empêche un ancien signal de fermeture arrivé en retard de tuer la page rechargée.
- Présence du professeur renouvelée toutes les **25 secondes**, même lorsque son onglet est à l'arrière-plan, sans requêtes supplémentaires côté élève avant son clic « Rejoindre ». L'Edge expire côté serveur toute séance sans présence au-delà de **10 minutes**, pour les mobiles, crashs et fermetures sans signal. Les navigateurs peuvent suspendre les onglets en arrière-plan ; ce délai minimise les fermetures injustifiées mais ne garantit pas une séance éternelle en cas de suspension système prolongée.
- Les élèves qui ferment leur onglet ne terminent jamais la séance du professeur. Une séance terminée retourne `active:false` à la prochaine lecture, sans effacer les réponses locales.
- Champs SQL privés ajoutés : `host_client_id`, `host_page_id`, `host_seen_at`, `close_requested_at` ; aucune donnée élèves. Actions Edge : `resume`, `heartbeat`, `closing`, verrouillées au professeur, même onglet et même génération. La révision pédagogique reste inchangée par la présence.
- Preuves attendues : tests du contrat temporel, Chromium (passage autre onglet / pagehide non persisted), intégration native inchangée, SQL vérifié, Edge publiée, Pages publiée, puis recette réelle Monsieur T / Élève A. Déploiements SQL, Edge et Pages à suivre séparément.
- **Limite navigateur** : un signal de fermeture n'est jamais garanti à 100 % (particulièrement sur mobile), d'où le délai de secours de 10 minutes ; on ne prétend pas à une détection instantanée universelle.
- **Livraison vérifiée** : [PR #284](https://github.com/Mr-Tat/Mathas-Connect/pull/284) fusionnée, commit `e34ca844` ; [Chromium et contrat temporel réussis](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/42828269673) ; migration SQL `guided_multiplication_host_presence_20261110` appliquée, 4 colonnes confirmées ; Edge `connect-guided-multiplication` **v2 ACTIVE**, JWT obligatoire ; [GitHub Pages réussi](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/42828591893). Les 8 échecs globaux sont préexistants et hors périmètre, pas de nouvelle défaillance Multiplication.
- **État réel** : code + CI + Pages + SQL + Edge livrés ; **recette de fermeture/rechargement avec Monsieur T et Élève A sur navigateurs réels encore à effectuer**.

## Navigation et page obligatoire — 10/11/2026
- **Deux interfaces, même chemin** : Monsieur T et l'élève ouvrent tous deux **Exercice guidé**. Le professeur y voit « Lancer la séance » et l'élève « Rejoindre la classe ». Le raccourci de lancement sur le menu professeur est retiré.
- **Pages conservées pendant toute la séance** : deux opérations par page, ajoutées côté serveur ; le professeur peut revenir à une page déjà ouverte et la reprendre sans fabriquer de nouveaux calculs. « Nouvelle page » n'en crée une que lorsque le professeur est déjà sur la dernière.
- **Élèves** : « Précédente » toujours autorisé, « Suivant » autorisé **par défaut** dès que le professeur a ouvert la page suivante, sans obligation de réussir la page courante. Aucune avance automatique forcée ni publication de réponses.
- **Page obligatoire** : le professeur active/désactive cette obligation sur la page qu'il affiche. Un élève doit avoir **réussi les deux calculs** de toute page obligatoire avant de la quitter vers l'avant. Il ne peut pas sauter une page obligatoire en empruntant un raccourci ; les autres pages restent libres. Ce réglage est conservé au serveur et synchronisé après la jonction.
- **Arrivée tardive et obligation rétroactive** : si un élève rejoint lorsque le professeur est déjà plus loin, il débute à la première page obligatoire antérieure non réussie ; sinon il rejoint la page affichée. Une page rendue obligatoire après qu'un élève l'a dépassée bloque ses passages suivants jusqu'à ce qu'il revienne la réussir, sans déplacement automatique.
- **Mémoire élève** : les chiffres saisis, retenues, corrections et statuts « réussis » restent locaux à son ordinateur et indexés par page. Ils sont préservés lors des retours arrière et de « M'entraîner en attendant », sans stockage dans les données de score. La mémoire est réinitialisée lors d'une nouvelle séance collective.
- **Corrigés professeur** : bouton « Afficher les réponses » dans les contrôles de professeur, avec confirmation « Oui / Non » neutre avant de montrer les deux résultats de la page. « Masquer les réponses » les cache ; ils sont automatiquement masqués lors d'un changement de page. Le mode « Élève au tableau » et le code associé sont retirés.
- Le système de présence/fermeture de l'onglet professeur (#284), les classes et l'authentification, les barèmes et les preuves de résultats sont inchangés.
- **Livraison vérifiée** : [PR #286](https://github.com/Mr-Tat/Mathas-Connect/pull/286) fusionnée, Chromium et tests Multiplication réussis ; migration `guided_multiplication_page_requirements_20261110` appliquée et contrôlée ; Edge `connect-guided-multiplication` **v3 ACTIVE / JWT obligatoire** ; GitHub Pages [#42840487880](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/42840487880) réussie. [PR #288](https://github.com/Mr-Tat/Mathas-Connect/pull/288) fusionnée après tests Chromium, pour empêcher le contournement d'une page obligatoire par un élève arrivé en retard ou une obligation ajoutée ultérieurement. GitHub Pages [#42842075805](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/42842075805) **réussie** pour le commit `66519561`. La recette réelle Monsieur T + Élève A reste nécessaire.

## Protection des chemins natifs de navigation — correctif complémentaire
- Le guidé collectif bloque aussi la touche **Entrée** et la touche **✓** du pavé numérique dans les pages terminées : ces actions ne peuvent plus générer des opérations hors des pages ouvertes par le professeur, ni contourner une page obligatoire.
- Lors du retour à une page, afficher aussi les reports latéraux, les chiffres déjà saisis et les traces de corrections, afin que l'état visuel corresponde à la mémoire locale.
- Aucun changement aux règles Supabase, aux comptes, XP, trophées ou résultats de jeu ; uniquement le pont Connect Multiplication et ses tests navigateur.
- Tests Chromium à confirmer sur le SHA final ; ensuite contrôler le déploiement GitHub Pages et la recette réelle en classe.

## Corrigé comparatif sous les cases — 10/11/2026
- Dans l'interface professeur, « Afficher les réponses » garde sa confirmation neutre Oui/Non, puis ajoute **deux lignes directement dans la grille de chaque opération** : une ligne de chiffres du résultat, alignée sous les cases de saisie, et juste en dessous une **petite ligne de reports**, alignée sur les mêmes colonnes. Le marqueur « r » identifie les reports ; seuls les reports positifs sont écrits, pas les zéros.
- Les reports affichés sont les **retenues entrantes** utilisées par le moteur natif (méthodes haut et côté). Exemple : 247 × 6 = 1482, reports « 2 » au rang des centaines et « 4 » au rang des dizaines. Chaque chiffre est une superposition de texte dans la grille, **jamais une valeur écrite dans les champs de réponse ou de report**, et n'intervient ni dans la correction, ni dans les scores.
- « Masquer les réponses » supprime les deux lignes et conserve exactement les saisies existantes. Changer de page cache également le corrigé. Les élèves ne voient jamais ces lignes.
- Tests Chromium : résultats 247×6 et 139×8, retenues correctes, polices plus petites, alignement avec cases, aucun changement de saisie après révélation/masquage. Aucun SQL, Edge, XP, trophée ni visibilité modifiés.

## Bandeau collectif compact — PR #293 (10/11/2026)
- Badge de classe déplacé **à droite du titre** « Guidé collectif · page X/Y · Professeur/Élève », même ligne sur grand écran, retour à la ligne propre sur écran étroit.
- Le badge est retiré de la rangée des commandes, qui devient complètement masquée quand ses boutons « Lancer / Rejoindre » sont inactifs ; suppression de la hauteur vide et réduction des marges.
- Trois groupes de commandes professeur, séparés d'orange : « Précédente / Suivante » | « Page obligatoire / Afficher les réponses » | « Terminer la séance ». Deux groupes élèves : navigation | entraînement/retour. Espacement accru entre boutons ; retour à la ligne autorisé sur mobile.
- Aucun changement des permissions, des séances, des exercices, des résultats ni des XP. À confirmer séparément : tests Chromium, fusion PR, Pages et recette visuelle.

## Sauvegarde de secours locale — PR #294
- **Portée** : uniquement élèves connectés en guidé collectif. Enregistrement `sessionStorage` dans l'onglet de l'élève ; `studentId` = UUID du compte Connect authentifié, avec classe et UUID de séance pour l'isolation. Aucun impact sur compte, XP, scores, autres modes ou affichage professeur.
- **État conservé** : les deux opérations par page, chiffres de réponse et reports saisis, traces de correction, indicateur de réussite vérifié, et page affichée. Capture à chaque action native de clavier/pavé/validation, avant navigation et `pagehide`.
- **Restauration** : après F5, cliquer explicitement « Rejoindre la classe » ; une lecture du serveur valide la séance ; les nombres sont comparés à ceux du serveur ; les valeurs sont restaurées seulement si elles sont cohérentes et sous les bornes. Pages obligatoires antérieures gardent leur priorité. Les sauvegardes d'une autre séance sont purgées.
- **Limitations honnêtes** : sauvegarde locale de confort (même onglet / appareil), pas de synchronisation entre appareils ; si les données locales sont effacées/bloquées ou navigateur fermé sans reprise de session, la restauration peut ne plus être possible. Le jeu reste fonctionnel.
- **Recette** : test automatique réussie à 31/31 sur Chromium et Node ; recette connectée réelle avec Élève A/Monsieur T encore à exécuter.

## Retour d'expérience à compléter
- Source de divergence : chaque navigateur tire aléatoirement ses propres opérations ; la séance doit porter les nombres déterminés côté serveur.
- Ne pas déclencher les clics natifs automatiques « Nouveaux calculs » pendant le guidé collectif.
- Contrôles professeur validés par Edge, pas simplement par le paramètre URL ou le verrou local de présentation.
