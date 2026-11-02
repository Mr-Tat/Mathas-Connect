# Abaque — passage de flambeau — 02/11/2026

**[REPO vérifié] Démonstration isolée candidate. Aucune publication Pages ni connexion XP réelle vérifiée.**

Lire `AGENTS.md`, le guide permanent et [la fiche](ABAQUE_LONGUEURS_FICHE.md). Branche : `feat/abaque-longueurs-laboratoire`. Base `main` revérifiée : `4b28cc56ec05b8e06998c53fdccb32571f3b1066`. Source autonome : `7dc9dc00e87302d5aafa1c9d131e500a57419c1d`, inchangée. La copie originale et les 25 fichiers d’assets sont identiques à la source.

## Travail préparé et audit complémentaire

Trois activités et déblocages natifs, Objectif record 3 vies/Mort subite, scores par mode et record consécutif, trois trophées visuels en bas à droite, stockage démo distinct et carte expérimentale dans le registre partagé Laboratoire/HUB TEST. Aucun changement de SQL/Edge, du catalogue officiel ou des résultats réels.

L’audit a reproduit un défaut : quitter Master pendant une partie commencée en Master permettait de gagner le bronze. La partie reste désormais en entraînement jusqu’au prochain départ normal, même après entrée/sortie de Master. Autres corrections : cœur brisé conservé sans réanimation à chaque réussite ; record consécutif réaffiché ; reprise des trophées depuis les anciens résultats de cette même démo seulement. Un sans-faute après les deux réussites de déblocage compte bien pour bronze/argent. L’or exige les trois séries classiques parfaites, pas les modes record.

Le test de capture ne doit plus utiliser `/workspace`, absent d’un runner GitHub standard : il utilise le dossier temporaire système. La CI conserve sa vraie sortie et son code de retour dans le résumé public. Les cinq raccourcis du serveur Edge existant ont un contrat de test explicite distinct des six démos statiques : ajouter l’Abaque ne nécessite aucun déploiement du service partagé.

## Preuves du 02/11/2026

- **[CI locale]** 284 tests Node réussis, 1 PostgreSQL ignoré (`pg`/serveur indisponibles). Les deux fichiers HTTP de production sont exclus de cette commande locale, pas supprimés ni désactivés dans leurs workflows.
- **[CI locale]** 7 tests Chromium Abaque réussis + 6 tests isolation/Laboratoire réussis. Vrai clavier, premiers essais 10/12 et 7/8, perfection après deux réussites, or progressif, points 100/324/580, aides/corrections, Master, 3 vies, Mort subite, reprise des trophées et positionnement à 320/768/1024 px.
- **[CI locale avec catalogues simulés]** Carte Abaque présente dans le HUB TEST et absente des cinq classes scolaires. Aucun compte ni donnée réelle utilisés. Cela ne prouve pas une session hébergée authentifiée.
- **[CI locale]** 9 tests Chromium Projection/Soustraction réussis.
- **[LIVE vérifié, GitHub]** Git lecture/push et pages web GitHub accessibles. L’API GitHub reste refusée ; l’interface web consultée est déconnectée. Ne pas conclure à une absence totale d’accès GitHub.
- **[LIVE vérifié, ancien commit]** [CI du commit 78cfbc2 en échec](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/41365970841), étape navigateur, code 1 ; logs détaillés réservés à une session. Contrôler impérativement la nouvelle CI sur le SHA poussé, via la page `/commit/<sha>/checks` puis le résumé du run.
- **[REPO vérifié]** Backend Abaque, XP serveur 160, reçus, restauration Connect, tableau professeur et pilote authentifié : non implémentés/non validés. Les XP et trophées affichés dans cette démo ne sont pas des acquis Connect.

## Publication et accès

Le professeur a autorisé PR et publication de la démo isolée dans le Laboratoire. Utiliser les accès existants ; ne pas demander un jeton par réflexe. Créer la PR, contrôler la CI exacte, fusionner la seule démo puis vérifier Pages et sa carte du Laboratoire. Les pages GitHub publiques permettent déjà de lire la CI, même si l’API est refusée.

Les domaines `api.github.com` et `mr-tat.github.io` sont enregistrés dans le brouillon cloud ; lors du contrôle, le runtime reste à sa révision 1 et les connexions à ces deux hôtes renvoient un refus CONNECT 403. Une permission d’action et une règle réseau appliquée sont deux choses différentes. Ne pas contourner le refus. `install_script` et `start_skill` sont enregistrés et le script de setup a été relancé avec succès ; publication du cloud et publication du site Pages sont distinctes.

Après la première publication, compléter Connect sur cette même application : preuves de premier essai, identité approuvée, état élève/app/époque, file bornée avec ACK exact, XP complémentaires (160 max), trois trophées permanents indépendants du reset, résumé professeur et reset limité à l’Abaque. Ne pas importer le registre de trophées démo. PostgreSQL/Auth/Edge locaux puis accord précis avant SQL/Edge de production ; aucun élève réel ni ouverture scolaire sans validation.
