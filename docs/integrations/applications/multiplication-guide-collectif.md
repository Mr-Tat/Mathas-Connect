# Multiplication simple — guidé collectif (10/11/2026)

## Décisions pédagogiques validées
- Première étape : **multiplication simple seulement**, puis retour d’expérience avant les trois autres jeux.
- Même paire d'opérations par classe, réponses et corrections **individuelles**, sans synchroniser les chiffres du professeur.
- Seul le professeur lance/arrête la séance et ouvre de nouvelles pages ; les élèves ne peuvent passer qu'après l'ouverture et normalement après correction.
- Le professeur peut activer « passage libre » pour permettre de rejoindre la page ouverte sans terminer.
- « M'entraîner en attendant » utilise le guidé individuel, puis « Rejoindre la classe » rétablit les opérations partagées.
- Corrigés uniquement côté professeur, sous les opérations, plus bas dans la page, confirmation Oui/Non neutre. « Élève au tableau » masque/verrouille les commandes et corrigés, PIN local provisoire pour en sortir.
- XP : **SANS OBJET** ; trophées : **SANS OBJET** ; scores : **SANS OBJET** (aucun nouveau barème ni résultat scolaire).

## Architecture
- Moteur original inchangé ; pont natif injecté uniquement depuis l'hôte Connect, points d'insertion vérifiés ; les activités non guidées et le mode libre restent inchangés.
- Edge dédiée « connect-guided-multiplication » : authentification, inscription/permission, visibilité HUB, décisions professeur côté serveur. Les élèves n'ont qu'un accès à la lecture.
- Table RLS privée de séance : deux opérations par page, config, progression des pages et version ; aucune réponse, score, XP ou donnée de résultat élève.
- Poll léger et reprise après réseau absent.

## État et preuves à distinguer
- Code fusionné sur `main` : [PR #279](https://github.com/Mr-Tat/Mathas-Connect/pull/279) (pilote), [PR #280](https://github.com/Mr-Tat/Mathas-Connect/pull/280) (lancer/rejoindre depuis un guidé déjà ouvert). Dernier SHA fonctionnel `c0fa401c`.
- Code : PR #279 ; tests navigateur Chromium **13+ cas réussis** au SHA `55854831` (run [42813878262](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/42813878262)). Tests d'intégration et de validation manuelle existants réussis. La suite globale comporte 4 échecs de référence hors périmètre (3 miniatures, guide Laboratoire), plus une assertion de test du pilote corrigée ensuite.
- SQL : migration `guided_multiplication_classroom_20261110` **appliquée** le 10/11/2026 sur le projet Connect ; RLS et grants service_role vérifiés, table vide.
- Edge : `connect-guided-multiplication` **déployée** (version 1 ACTIVE, vérification JWT active) ; aucun score ou profil élève modifié.
- GitHub Pages : **publication réussie le 10/11/2026** pour SHA `c0fa401c`, [workflow #42815242183](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/42815242183).
- Tests navigateur Chromium : le pilote et le correctif #280 réussis, dont prof/élève, copie des opérations, pages, passage libre, entraînement et mode Élève au tableau ; recette authentifiée en classe **non encore exécutée**.
- Les quatre échecs récurrents du test de régression global concernent des miniatures et le guide de laboratoire hors de ce chantier ; ne pas les présenter comme des tests du guidé collectif.
- Recette fictive à faire : Monsieur T / Élève A ou B (classe TEST), questions identiques, saisies indépendantes, page suivante, passage libre, entraînement/rejoint, verrouillage tableau, petit écran, réseau intermittent.
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

## Navigation par pages et lancement uniquement dans le guidé — 10/11/2026
- **Même chemin au menu** : professeur et élèves ouvrent d'abord « Exercice guidé ». Le professeur trouve ensuite « Lancer la séance » ou « Reprendre la séance », l'élève « Rejoindre la classe ». Pas de bouton collectif supplémentaire au menu.
- Le professeur voit ← Précédente et Page suivante → pour revisiter des pages déjà ouvertes ; Nouvelle page → uniquement depuis la dernière page créée. Les mêmes opérations restent enregistrées au serveur jusqu'à la fin de la séance.
- Les élèves disposent de ← Précédente, Suivant → et « Dernière page ». Le moteur garde localement leurs chiffres, retenues, erreurs et états de réussite par page pendant la séance, jamais dans la table de scores. Une nouvelle séance efface l'ancienne mémoire.
- **Par défaut, passage libre** vers toute page déjà ouverte, même sans avoir terminé les deux calculs précédents.
- Le professeur marque « Page obligatoire » sur la page affichée. Pour franchir cette page, l'élève doit faire **réussir les deux calculs**. L'interdiction s'applique aussi au raccourci « Dernière page ». Les retours en arrière restent possibles.
- Suppression du mode « Élève au tableau ». Bouton professeur « Afficher les réponses » / « Masquer les réponses » pour les deux calculs, après confirmation neutre Oui/Non, sans envoyer les corrections aux élèves.
- SQL : colonnes `teacher_page_index` et `required_pages`, aucune réponse élève. Edge : `set-page` et `set-required` avec contrôle JWT de professeur et révision optimiste.
- Livraisons à confirmer distinctement : Chromium et contrats, intégration Multiplication, migration SQL, Edge puis GitHub Pages. La recette réelle TEST n'est pas remplacée par ces tests.

## Retour d'expérience à compléter
- Source de divergence : chaque navigateur tire aléatoirement ses propres opérations ; la séance doit porter les nombres déterminés côté serveur.
- Ne pas déclencher les clics natifs automatiques « Nouveaux calculs » pendant le guidé collectif.
- Contrôles professeur validés par Edge, pas simplement par le paramètre URL ou le verrou local de présentation.
