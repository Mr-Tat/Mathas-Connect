# Bilan de l'intégration « Calculs écrits mélangés »

Date du bilan : **31 octobre 2026**. Main applicatif de référence : `4aea80e3db824e74c2e13f529b14c871e8435269`. Ce bilan décrit une intégration terminée et ouverte ; ce n'est pas un script à réexécuter.

## Résultat livré

Le jeu autonome V6.0.2 de `Mr-Tat/Melange-calculs-ecrits-1` a été copié dans `Mr-Tat/Mathas-Connect/apps/calculs-melanges/`. Le dépôt d'origine n'a pas été modifié ; son HEAD vérifié pendant le travail est `e11c88b4e449e8cdb17b0fee78c7daa6ea5bf279`.

L'application possède son app_key `melange-calculs-ecrits`, son état et ses droits XP. Elle réutilise l'identité et les inscriptions Connect existantes, ainsi que la session professeur séparée pour Monsieur T. Elle comprend sauvegarde locale isolée, état distant versionné, file hors ligne, crédit serveur, animation après confirmation, résultats professeur, minimums de tables propres au jeu et remise à zéro par application.

La publication a été progressive : application installée désactivée, intégration publiée avec cartes masquées, activation pour les essais, puis ouverture des quatre cartes. L'ouverture concerne les quatre catalogues communs ; aucune intégration classe par classe n'est nécessaire. Les XP sont liés à l'élève et à l'application, pas un nouveau budget offert à chaque changement de classe.

Le script d'ouverture de Mélange a été rapporté exécuté une seule fois. Son SHA-256 était `f3f21c78918ff1ead36c8d7b07062ac2984d5280c40734cde4b3e35e552f7456`. Conserver cette trace ; **ne pas le rejouer pour une future application**.

## Barème réellement retenu

Le propriétaire a validé une majoration spécifique à Mélange : **594 XP de base**, soit 198 par niveau, environ 25,32 % au-dessus de 474. Aucun multiplicateur global n'a été ajouté aux autres applications.

| Réussite, par niveau | XP à 100 % |
| --- | ---: |
| Classique 4/4 | 28 |
| Classique 8/10 | 38 |
| Bonus 10/10 | +8, soit 46 au total sur /10 |
| Classique 16/20 | 63 |
| Bonus 20/20 | +13, soit 76 au total sur /20 |
| Mort subite normale, 5 puis 10 | +12 puis +12 |
| Mort subite HARD, 3 puis 7 | +12 puis +12 |

Neuf jalons existent à chacun des trois niveaux. Les références à un défi HARD de cinq calculs ne créent pas une récompense supplémentaire : ce mode n'est pas lançable dans la copie étudiée. Master et entraînement ne donnent pas d'XP Mélange.

La décision finale remplace la proposition initiale exigeant deux types effectivement tirés :

- une opération sélectionnée au départ : 25 % ;
- deux : 50 % ;
- les trois : 100 %, même avec un tirage chanceux ne contenant qu'un type ;
- une nouvelle réussite ne verse que les tranches manquantes, une fois ;
- changer une sélection sans terminer une nouvelle partie ne verse rien.

Les arrondis portent sur les droits cumulés : par exemple, le sans-faute /10 vaut 12 XP au quart de taux, et /20 vaut 19. Arrondir chaque complément isolément peut créer une erreur. Le calcul faisant foi reste côté serveur, version 3. Voir [la décision XP détaillée](CALCULS_MELANGES_XP_SELECTION_20261030.md).

Le plafond de base et les compléments ne doivent pas être confondus avec un éventuel droit de rejeu explicitement accordé par le professeur. Sans ce droit, réinitialiser le parcours conserve les crédits déjà acquis et ne permet pas de les recollecter.

## Difficultés rencontrées et corrections

| Difficulté | Ce qui a été fait | Leçon réutilisable |
| --- | --- | --- |
| Un seul meilleur score natif par niveau mélangeait les séries 4/10/20 | Preuves Connect séparées par niveau, longueur et taux, sans changer le cache d'affichage natif | Définir la granularité des preuves avant le barème ; tester les deux ordres de séries |
| Le moteur utilisait `setLast(...)` et `mixcalc_last_v1`, pas le callback global d'autres jeux | Pont minimal dans la copie locale, début/fin instrumentés et fin terminale gardée | Auditer le vrai cycle de vie ; ne pas copier un hook sur la seule ressemblance des écrans |
| Plusieurs chemins de fin et des animations/trophées différées | Un seul événement final après finalisation ; synchronisation ponctuelle des trophées natifs | Une sauvegarde « dernier travail » ou un clic ne constitue pas forcément une fin de partie |
| Évolution pédagogique pendant le travail | Passage à 25/50/100 avec compléments, preuves distinctes et concurrence testée | Consigner la règle finale, sa version, les exemples chiffrés et les propositions remplacées |
| Une file hors ligne pouvait rejouer un résultat ou suivre la mauvaise fiche | Reçus durables, révisions, époque de reset et liaison à l'identité résolue par le serveur | L'idempotence doit exister côté serveur ; ni l'URL ni un ancien JWT seul ne suffisent à identifier la fiche actuelle |
| Des bugs natifs n'apparaissaient pas avec une simple écriture dans les champs | Correction du focus des reports latéraux et de la saisie à deux chiffres d'un emprunt direct | Tester avec le clavier, les reports et les vrais contrôles ; `fill()` peut masquer un défaut de saisie |
| HARD apparaissait dans le tableau alors qu'il était verrouillé | Retrait de l'inférence « présence de compteurs = déblocage » ; même condition que le menu : `perfect1 && perfect2 && perfect3` | Zéro, champ présent, ancien record, mode accessible et récompense admissible sont des faits différents |
| PostgreSQL Docker semblait prêt puis le socket disparaissait | Attente du serveur final par TCP avec `pg_isready -h 127.0.0.1` | Le serveur temporaire d'initialisation accepte le socket Unix avant l'arrêt et le démarrage définitif |
| Un contrôle Soustraction cherchait un libellé déjà absent avant Mélange | Diagnostic comparant le main antérieur ; correctif de test ciblé préparé | Distinguer régression du produit, incident d'infrastructure et assertion de test périmée |
| Les audits reçus ne contenaient pas toujours les métadonnées brutes nécessaires | Comparaison hors ligne du JSON complet, puis tests avec historique et watchers réels reproduits localement | Définir dès le départ l'export minimal requis, son stade et les critères de réussite |
| L'outil de migration et le SQL pouvaient gérer chacun transaction/historique | Installation atomique dédiée et test d'échec tardif sans résultat partiel | Un seul mécanisme doit posséder la transaction et l'enregistrement de migration |
| Une conversation avait Git et une autre les connexions Supabase/GitHub | Changements préparés et testés ici, exécution distante par la conversation connectée | Établir une matrice de capacités au début et ne pas exiger un PAT par défaut |
| Les comptes de test et les sessions n'étaient pas immédiatement utilisables | Réutilisation de la classe existante, confirmation des profils fictifs, puis laboratoire permanent | Un appareil approuvé en base ne fournit pas sa session au navigateur courant |

## Publication et preuves

| Élément | État et provenance |
| --- | --- |
| PR 34 | Intégration fusionnée, selon compte rendu de publication |
| Migration Mélange `20261031073637` | Installée, selon vérifications Supabase transmises ; pas réappliquée ici |
| `connect-results` v40, JWT obligatoire | État déployé rapporté ; source de référence versionnée |
| PR 41 | Correctif HARD fusionné ; confirmé dans l'historique Git |
| PR 42 | Contrôles publics fusionnés ; confirmé dans l'historique Git |
| Main final `4aea80e…` | Relevé directement par Git dans cette session |
| Pages | [Run 41198052501 réussi](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/41198052501), statut vérifié directement |
| Quatre catalogues publics | [Run 41197904676 réussi](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/41197904676), statut et assertions du test vérifiés directement |
| 7 → 14 → 28 XP et conservation après reconnexion | Essais hébergés personnellement rapportés par le propriétaire |
| Hors ligne/ACK, reset, Monsieur T, autres contrôles | Retour global positif du propriétaire ; pas de preuve navigateur individuelle détaillée pour chaque scénario |

Les tests locaux ont couvert les contrats Node, PostgreSQL jetable, concurrence, rollback, GoTrue/JWT local, Edge Runtime local, Chromium et les vraies saisies arithmétiques. Les deux ordres 4 → 10 → 20 et 20 → 10 → 4 ont été exercés. Pour le correctif HARD : 230 tests Node réussis, un historique ignoré, défaut reproduit avant correction puis recette Chromium ciblée réussie. Ce nombre décrit ce passage de test, pas le nombre immuable de tests du dépôt actuel.

Le workflow public vérifie quatre réponses HTTP 200, exactement une carte Mélange activée, sa bonne URL et l'absence de mise en vedette forcée après expiration du cache. Il ne prouve pas une session élève authentifiée dans chacune des classes.

Une éventuelle surcharge hébergée `CONNECT_MIXED_ACCESS` n'a pas été lue ; le code publié utilise `open` par défaut. Le rapport final recommande d'investiguer cette configuration si une classe habituelle rencontre un refus. Ne pas transformer ce point non observé en obligation de redéploiement.

## Ce qui a inutilement allongé le travail

Les échanges ont été trop nombreux autour des accès, des exports partiels et des comptes de test. On aurait gagné du temps avec une seule fiche initiale indiquant qui peut lire/pousser Git, créer/fusionner une PR, lire/appliquer du SQL, déployer une Edge et utiliser un navigateur déjà authentifié.

La recette hébergée aurait aussi dû être préparée plus tôt : un compte fictif identifié, sa session utilisable, un profil sans acquis pour tester les paliers, une page réunissant résultats et commandes, puis un retour court par scénario. Le laboratoire répond désormais à ce besoin ; il ne faut pas le recréer pour chaque jeu.

Enfin, il faut figer un candidat et ses empreintes avant le dernier audit, puis ne redemander des métadonnées qu'en cas de changement pertinent. Répéter une vérification déjà établie ou redemander un « go » pour une opération déjà autorisée ne renforce pas la validation.

## Suite normale

Mélange reste en production. Les éventuels contrôles complémentaires se font dans le laboratoire ou par observation d'un lancement autorisé, sans réinitialiser les élèves réels. La prochaine intégration doit réutiliser les mécanismes éprouvés, avec son propre contrat et son propre app_key.

Le [guide général](GUIDE_INTEGRATION_APPLICATIONS_CONNECT.md) et la [fiche des prochains calculs écrits](PROCHAINES_APPLICATIONS_CALCULS_ECRITS_20261031.md) décrivent cette méthode.
