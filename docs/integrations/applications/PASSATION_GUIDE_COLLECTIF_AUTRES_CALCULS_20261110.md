# Passation — Porter le guidé collectif de Multiplication aux trois autres calculs écrits

**Projet :** Math’as Connect · **Date de référence :** 10 novembre 2026 · **Objet :** cahier de reprise pour une nouvelle conversation ChatGPT disposant de GitHub et Supabase.

> **Source de vérité :** contrôler \`main\`, les PR ouvertes, GitHub Pages, Supabase et les tests au moment de la reprise. Ce document décrit les **décisions finales**, non toutes les versions intermédiaires. Dernière optimisation finalisée : **#295**, synchronisation côté élèves uniquement sur « Rejoindre la classe » et « Suivant / Vérifier la suite », avec rendu événementiel et sauvegardes regroupées. #294 et #295 sont fusionnées et publiées.

## 1. Périmètre et ordre de travail

**Pilote / référence :** \`multiplication-ecrite-simple\`, dossier \`apps/multiplication-simple/\`. **Applications à adapter séparément :** \`addition-ecrite-simple\`, \`addition-ecrite-multiple\`, \`soustraction-ecrite-simple\`. Les deux dernières possèdent respectivement les dossiers \`apps/addition-plusieurs/\` et \`apps/soustraction-simple/\`. Pour **Addition simple**, retrouver la vraie source et son déploiement dans le catalogue HUB / les dépôts connectés ; ne pas supposer qu’elle est dans \`apps/addition-simple/\`, absent du dossier \`apps/\` vérifié le 10/11.

**Ne rien modifier dans le HUB, les quatre jeux, ni les classes sans audit des versions actives et des PR en cours.** Travailler jeu par jeu, sur branche dédiée, avec une fiche d’intégration à jour. Les autres modes et les données scolaires actuelles ne doivent pas régresser.

**Pour le guidé collectif uniquement : XP, trophées, scores, record et projection = SANS OBJET.** Ne jamais insérer des reçus, points ou droits d’XP dans cette activité. Les barèmes des autres modes restent exactement tels qu’approuvés.

## 2. Comportement final approuvé par le professeur

### Démarrage et groupe

1. Le professeur identifié par son véritable compte **Monsieur T** ouvre **Exercice guidé**, puis clique sur **« Lancer la séance » à l’intérieur de l’exercice**. **Aucun bouton de lancement à côté de la carte Exercice guidé** dans le menu.
2. L’élève ouvre lui aussi **Exercice guidé**, puis clique sur **« Rejoindre la classe »**, même si aucune séance n’est encore active. L’existence de la séance est vérifiée **uniquement à ce clic** ; message clair s’il n’y a aucune séance.
3. Une séance est liée à l’**ID de classe autorisé**, pas au titre du HUB. « Toutes » avec son ID correspond à **Classe TEST** ; une séance lancée en Phase 1 est invisible pour Élève A de TEST.
4. Le professeur voit le nom de classe auprès du titre **« Guidé collectif · page X/Y · Professeur »** ; l’élève voit le même type de badge. La classe figure aussi près du nom et du niveau du profil Connect.

### Calculs et circulation entre pages

- **Deux opérations par page**, déterminées et conservées par le serveur de séance : mêmes nombres chez tous les membres de la classe, mais **saisies, reports, fautes, corrections et rythme individuels**. Les réponses du professeur **ne se synchronisent jamais** vers les élèves.
- Le professeur dispose de **« Précédente » / « Page suivante » / « Nouvelle page »**. Une ancienne page est retrouvée sans nouvelle génération ; la nouvelle page ne se crée que depuis la dernière.
- Les élèves disposent de **« Précédente » / « Suivant »**. **Par défaut, ils peuvent avancer sans avoir terminé** dès que le professeur a ouvert la page suivante. Ils ne sont jamais téléportés de force quand le professeur change de page.
- Le professeur peut activer **« Page obligatoire » pour la page qu’il consulte**. Dans ce cas, l’élève doit **terminer et réussir les deux calculs** avant d’avancer. Les erreurs puis corrections sont acceptées : **pas d’exigence de premier essai parfait**. **Ne pas imposer des reports obligatoires supplémentaires** par rapport aux règles natives actuelles. Une obligation posée rétrospectivement bloque les déplacements suivants jusqu’à satisfaction.
- Un élève arrivé tard rejoint la page actuellement projetée **sauf s’il existe une page obligatoire antérieure non réussie**, auquel cas il débute à la première de ces pages.
- **« M’entraîner en attendant »** lance un guidé individuel séparé ; **« Rejoindre la classe »** récupère l’état individuel de la séance collective. Le guidé collectif reste non noté.

### Réponses du professeur et aspect visuel

- Dans les boutons professeur, **« Afficher les réponses »** ouvre une confirmation neutre **Oui/Non** (sans oui vert, ordre susceptible de changer). Après confirmation, les **bons chiffres du résultat** s’affichent sur une ligne **sous les cases de réponse**, alignés colonne par colonne, suivis d’une **petite ligne de reports**. Les reports affichés sont les reports entrants des opérations et **seulement ceux nécessaires**. Exemple en Multiplication : \`247 × 6 = 1482\` avec reports **2** et **4** dans les colonnes correspondantes.
- **« Masquer les réponses »** supprime ces lignes ; changement de page les cache aussi. **Ne jamais écrire ces valeurs dans les inputs natifs**, ni déclencher validation, score ou récompense. Adapter le calcul des reports et la disposition à chaque moteur ; ne pas copier la logique de multiplication aux additions/soustractions.
- **Pas de mode « Élève au tableau », pas de code PIN** : option abandonnée par le professeur. Ne pas la réintroduire.
- Bandeau **compact** : classe sur la ligne du titre, pas de rangée vide, commandes espacées et regroupées avec séparateurs **orange**. Chez le professeur : navigation | Page obligatoire + Réponses | Terminer. Chez l’élève : navigation | entraînement/retour. Responsive à 320 px.

### Fermeture et reprise

- **Changer simplement d’onglet** ne termine pas la séance professeur. Fermer/naviguer hors de la page du professeur envoie un signal de fin au serveur, suivi d’un **délai de grâce d’environ 15 s** (F5 et reprise). Heartbeat professeur ~**25 s**, expiration de secours côté serveur après **10 min** sans présence lorsqu’un navigateur n’envoie pas le signal ; un navigateur peut suspendre les minuteries : cette sécurité n’est pas une garantie de détection instantanée.
- L’onglet d’un élève peut être fermé sans terminer la séance des autres. **Ne pas déconnecter Math’as Connect** à la fermeture : seule la séance de guidé collectif est concernée.
- **Sauvegarde de secours des élèves lors d’un couac/F5** : dans \`sessionStorage\` de **leur onglet**, par **classe + identifiant authentifié d’élève + UUID de séance**. Elle conserve la page consultée, les saisies, reports, traces de correction et réussite locale des pages visitées. Sauvegarder après les actions du pavé, validation, navigation et \`pagehide\`. Lors de la réouverture, **aucune recherche serveur avant le clic « Rejoindre la classe »** ; après ce clic, récupérer la bonne séance serveur, vérifier les nombres/pages, puis restaurer le brouillon.
- Limiter volume (120 Kio), nombre de pages (120) et durée de secours (~12 h) ; ne jamais réutiliser le brouillon d’un autre élève, d’une autre classe ou d’une nouvelle séance ; invalider à la fin de séance. Si le stockage navigateur est bloqué, **ne pas bloquer le jeu** : rester avec la mémoire normale. **Pas d’envoi de réponses élèves à Supabase.** Il s’agit d’une reprise **sur le même onglet/appareil**, pas d’une synchronisation entre ordinateurs.

### Dernière décision de performance du 11 novembre 2026 — PR #295
- **Aucun polling de séance côté élève.** Après la première jonction, ne plus interroger Supabase toutes les 8 secondes. Il clique sur **« Suivant / Vérifier la suite »** pour récupérer la dernière version des pages et des obligations, même si le bouton ne connaissait aucune page supplémentaire. Si le professeur n'a pas avancé, afficher un message explicite. Le bouton doit donc rester cliquable.
- **« Précédente » purement locale**, sans requête serveur. « M'entraîner en attendant » local ; le retour via **« Rejoindre la classe »** vérifie la séance au clic.
- **Pages obligatoires vérifiées sur le statut serveur au clic de passage** pour prévenir le contournement d'un changement de règle depuis le dernier rafraîchissement ; les saisies restent locales.
- Professeur : conserver son signal de présence ~25 secondes et la reprise à l'ouverture, mais ne pas ajouter de statut toutes les 8 secondes. Rester fonctionnel si réseau momentanément indisponible (bouton de nouvelle tentative).
- Supprimer le rendu systématique du bandeau ~950 ms au profit des événements d'interface. Regrouper les écritures de sauvegarde rapprochées (~300 ms), avec sauvegarde immédiate à la navigation et `pagehide`. **Ne pas modifier les minuteries historiques des trophées ou scores sans audit et régressions dédiées.**
- Pilote : [PR #295](https://github.com/Mr-Tat/Mathas-Connect/pull/295) **fusionnée et publiée** le 11/11/2026 ; [CI 31/31](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/43006386483) ; [GitHub Pages validé](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/43006650293). Aucune migration SQL ou Edge nécessaire pour cette optimisation.

## 3. Architecture du pilote à inspecter (ne pas copier aveuglément)

| Couche | Référence Multiplication | Rôle |
|---|---|---|
| Hôte Connect | \`apps/multiplication-simple/index.html\` | Auth, rôle, classe réelle, identité élève, iframe natif, branchement conditionnel, URL Edge |
| Moteur d’origine | \`apps/multiplication-simple/game-original.html\` | Calcul, saisie, validation ; **préservé** |
| Adaptateur du moteur | \`apps/multiplication-simple/collective-native-bridge.js\` | Pages imposées, états individuels, mémoire/restauration de chaque page, résultat « solved » |
| Interface collectif | \`apps/multiplication-simple/collective-ui.mjs\` | Commandes professeur/élève, navigation, affichage corrigé, état et polling |
| Contrat pur | \`apps/multiplication-simple/collective-contract.mjs\` | Validité des pages, progression et obligations |
| Sauvegarde temporaire | \`apps/multiplication-simple/collective-draft.mjs\` (PR #294) | Vérification d’identité/séance, durée, taille, stockage local et purge |
| Service classe | \`supabase/functions/connect-guided-multiplication/index.ts\` | JWT + classes + droits, génération et historique de pages, obligation, version, session |
| Présence | \`supabase/functions/connect-guided-multiplication/lease.mjs\` | Heartbeat, fermeture, recharge, expiration |
| Table dédiée | \`public.connect_guided_multiplication_sessions\` | Une séance par classe avec pages et indicateurs d’obligation, **aucune réponse d’élève** |
| Sécurité classe | \`supabase/functions/connect-guided-multiplication/school-visibility.mjs\` | Vérification des droits et de la visibilité HUB |

**Ne pas mutualiser trop tôt des moteurs différents.** Garder des adaptateurs natifs par type d’opération. Un contrôleur commun peut être extrait seulement si ses interfaces ont été comparées et testées. Les corrections de « reports » des additions et soustractions **nécessitent un audit spécifique**, notamment les emprunts de soustraction et les additions à plusieurs termes.

## 4. Sécurité et limites invariantes

- Seul le **compte Monsieur T authentifié et autorisé** peut démarrer/arrêter la séance, créer une page, revenir sur la page projetée et modifier « Page obligatoire ». Un paramètre \`joueur=prof\` ou un bouton caché **n’est jamais** une preuve de droit ; valider côté Edge et base.
- Un élève doit être inscrit dans la bonne classe, avec le compte/appareil Connect autorisé. Ses actions sont **lecture seule** côté serveur, hormis l’authentification nécessaire ; il n’envoie jamais chiffres, copies, scores ou XP dans cette activité.
- La classe TEST est indépendante des classes réelles. **Aucune modification des presets, des droits, de l’accès global ou des résultats d’élèves existants** au motif de faire réussir une démo.
- Un module collectif indisponible ne doit **jamais empêcher le guidé individuel ou les autres modes** de se lancer.
- Le guidé individuel et le mode libre ne deviennent pas collectifs par simple ajout de CSS ; le branchement conditionnel n’intervient qu’en mode Connect.
- Les vérifications de publication sont **indépendantes** : code sur \`main\` + PR/CI, SQL, Edge/JWT, Pages, puis recette réelle avec deux profils fictifs.

## 5. Tests minimaux exigés pour chaque nouvelle application

1. Professeur en **Classe TEST** et Élève A approuvé dans TEST : session créée, bouton élève visible à l’intérieur d’Exercice guidé ; la découverte ne démarre qu’au clic ; aucune séance détectée dans une autre classe (par exemple Phase 1).
2. Deux copies du jeu reçoivent **les mêmes deux opérations par page**, mais les réponses, erreurs, reports et corrections ne circulent pas entre les copies.
3. Professeur crée pages 1, 2, 3, revient à 1 et repart à 3 : **les nombres ne changent pas**.
4. Élève peut quitter une page normale non terminée dès que le professeur a ouvert la suivante ; pas de déplacement forcé. Page obligatoire bloque le passage tant que les **deux calculs** ne sont pas validés, mais accepte une correction après erreur.
5. Passage tardif et obligation rétroactive : un élève ne contourne pas une ancienne page obligatoire, tout en gardant accès à « Précédente ».
6. Entraînement individuel entre deux pages puis retour collectif : réponses anciennes retrouvées.
7. Professeur affiche les solutions : chiffre/rang et petits reports corrects pour **les variantes du moteur testé** ; aucune entrée native changée ; masquage et changement de page réversibles.
8. Page professeur fermée → fin de séance après grâce ; simple changement d’onglet → la classe continue ; F5 rapide → reprise ; l’élève qui ferme sa page ne ferme pas la classe.
9. Élève A saisit des chiffres et reports sur deux pages, **F5**, puis « Rejoindre la classe » → même travail restauré, sans appel collectif préalable. Élève B sur le même ordinateur **ne récupère pas** le brouillon ; UUID de séance différent = pas de restauration.
10. Gestion des pannes : sessionStorage refusé/quota, réseau perdu/rétabli, actualisation, onglet caché, petit écran **320/390 px**, clavier/pavé natif et correction.
11. **Régressions obligatoires** : classique, 4/10/20 calculs, 3 vies, mort subite, barèmes, trophées, XP, records, projection, permissions et connexions déjà approuvés ; aucun changement de résultat réel.

Privilégier les tests ciblés et Chromium sur moteur authentique. Les tests avec appels serveur simulés **ne prouvent pas** la recette hébergée avec Monsieur T et Élève A. Faire cette recette séparément après publication.

## 6. Incidents et raccourcis utiles de la discussion

- Un mauvais compte/classe donne « Aucune séance » alors qu’une autre classe est active : afficher **la vraie classe ID**, pas le nom de catégorie « Toutes ».
- Le contrôleur collectif doit être initialisé **après** la disponibilité du pont natif ; en cas d’échec de chargement du module optionnel, le jeu ordinaire doit continuer.
- Le clavier du moteur natif utilise des champs **\`readonly\`** et un pavé virtuel : Playwright \`locator.fill()\` ne fonctionne pas ; déclencher les vraies touches du pavé.
- Les nouvelles dépendances \`.mjs\` doivent être servies par les fixtures Chromium et **versionnées dans les imports** pour éviter les anciennes copies en cache.
- Des fermetures \`pagehide\` peuvent arriver tardivement après un F5 : distinguer UUID d’onglet et UUID du chargement pour ne pas arrêter la séance rechargée.
- Pour le corrigé, **ajouter une grille d’affichage sous les inputs**, ne jamais remplir les inputs (ce serait une correction artificielle).
- Pour la sauvegarde, **ne jamais conserver l’état brut du DOM** : exporter l’état natif, vérifier séance/nombres/tailles et refuser un état « réussi » incohérent.
- Une PR fusionnée n’est **ni une preuve de Pages live**, ni une preuve d’Edge live, ni une recette en classe. Vérifier les trois séparément.
- Les rapports de tests globaux peuvent comporter des échecs anciens et hors périmètre ; distinguer les régressions **nouvelles** des échecs de référence.

## 7. PR et documentation de référence

- [#279](https://github.com/Mr-Tat/Mathas-Connect/pull/279) : première séance collective.
- [#280](https://github.com/Mr-Tat/Mathas-Connect/pull/280), [#282](https://github.com/Mr-Tat/Mathas-Connect/pull/282) : démarrer/rejoindre depuis le guidé et déclencher la recherche seulement au clic élève.
- [#283](https://github.com/Mr-Tat/Mathas-Connect/pull/283) : vraie classe visible.
- [#284](https://github.com/Mr-Tat/Mathas-Connect/pull/284) : fermeture de séance à la sortie de l’onglet professeur, délai, heartbeat.
- [#286](https://github.com/Mr-Tat/Mathas-Connect/pull/286), [#288](https://github.com/Mr-Tat/Mathas-Connect/pull/288) : historique de pages, obligations, avance libre, garde pour arrivées tardives.
- [#292](https://github.com/Mr-Tat/Mathas-Connect/pull/292) : résultats et petits reports sous les cases.
- [#293](https://github.com/Mr-Tat/Mathas-Connect/pull/293) : bandeau compact et séparateurs orange.
- [#294](https://github.com/Mr-Tat/Mathas-Connect/pull/294) : sauvegarde de secours locale, **statut et publication à vérifier à la reprise**.
- Consulter : \`AGENTS.md\`, \`docs/integrations/00_DEMARRER_ICI.md\`, \`docs/integrations/SUIVI_COURANT.md\`, \`docs/integrations/applications/multiplication-guide-collectif.md\`, \`docs/integrations/RECETTE_ET_PUBLICATION.md\`.

## 8. Texte à transmettre à la prochaine discussion

> Nous reprenons Math’as Connect, dépôt \`Mr-Tat/Mathas-Connect\` et projet Supabase Connect déjà associés. Je joins la passation **« Porter le guidé collectif de Multiplication aux trois autres calculs écrits »**. Commence par lire \`AGENTS.md\`, \`00_DEMARRER_ICI.md\`, le suivi et la fiche Multiplication, puis vérifie le statut réel de la PR #294 et des déploiements du pilote.
>
> Ta mission est **d’adapter à l’identique le guidé collectif final**, tel qu’il est décrit dans ce document, aux trois autres applications confirmées : Addition écrite simple, Addition écrite multiple, Soustraction écrite simple. Préserve chaque moteur natif et ses barèmes. Ne rajoute ni XP ni scores pour ce guidé ; aucune modification des données réelles. Traite **une application à la fois**, avec audit spécifique des colonnes, reports/emprunts et cas de correction, tests Chromium, PR, SQL/Edge si indispensables, Pages, puis recette Classe TEST avec Monsieur T et Élève A avant d’étendre. Note les problèmes, solutions, choix et preuves dans sa fiche et mets à jour le suivi.
>
> Ne réintroduis pas les options abandonnées (« Élève au tableau » / code PIN, lancement professeur dans le menu, progression bloquée par défaut, sélection directe de pages) : **seules les décisions finales de la passation font foi**. Si un point pédagogique propre aux autres moteurs n’est pas applicable, présente une courte alternative avant de modifier ce comportement.
