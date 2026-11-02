# Abaque des longueurs — fiche d’intégration

**[REPO vérifié, 02/11/2026] Démonstration isolée candidate, pas de pilote Connect.**

- Source : `Mr-Tat/abaque-m-1`, commit `7dc9dc00e87302d5aafa1c9d131e500a57419c1d`. Empreinte dans `apps/abaque-longueurs/source-manifest.json`, copie originale intacte `game-original.html`. Dépôt autonome inchangé.
- Base Connect : `4b28cc56ec05b8e06998c53fdccb32571f3b1066`, branche `feat/abaque-longueurs-laboratoire`.
- Chemin / future app_key : `apps/abaque-longueurs/` / `abaque-longueurs`.
- URL prévue (publication non vérifiée) : https://mr-tat.github.io/Mathas-Connect/apps/abaque-longueurs/
- Référencement : registre statique expérimental uniquement ; aucun changement des quatre HUB scolaires, du catalogue officiel, SQL ou Edge existants.

## Audit ciblé

Le moteur comporte construction (4 unités + 8 images, ≥10/12, deux réussites), déplacements (deux pages de quatre, ≥7/8, deux réussites), conversions (4, 12, 20, puis record). Les seuils se calculent au premier essai ; corrections classiques à 6 points. Déblocages conservés. Master ne compte ni progression ni points. Les callbacks de fin sont `recordStage`, `recordMode`, et `finishPage` pour les conversions. Attention : les deux cases natives de réussite ne conservent pas un nouveau sans-faute après deux réussites ; le futur registre Connect doit le conserver séparément.

**[DÉCISION professeur, prompt final 02/11/2026]** Maximum 160 XP : construction 8+6+6 ; déplacements 8+6+6 ; conversions 20, 18+10, 28+12 ; record 12+20 partagés avec les demi-droits 6+10 de 3 vies. Exactement trois trophées permanents (12/12 ; 8/8 ; 4/4+12/12+20/20). Aucun crédit en libre/Master/abandon/restauration. Aucun de ces XP/trophées Connect n’est activé dans la démo.

Points : classique 4×25=100 ; 4×(25+27+29)=324 ; 4×(25+27+29+31+33)=580. Mort subite conserve `30+5*floor(réussites/4)`, avec coefficients aides .8/.6 arrondis. En 3 vies, base normale `round((30+5*floor(réussites/4))/1.2)` avant les coefficients d’aide ; ni double bonus ni correction d’une erreur. Difficulté/aides suivent le nombre de conversions réussies. Records de points séparés par mode + global, record consécutif natif réservé à Mort subite. Médailles locales natives conservées, distinctes des trophées Connect.

La démo a ses propres clés `mathas_connect_abaque_demo_progress_v1` / `mathas_connect_abaque_demo_master_v1` ; aucun import automatique des anciennes données, aucune identité ni requête externe. Le paramètre de classe n’active pas Connect. Pas de compteur « Reste N XP » sans réponse serveur approuvée.

## Preuves et portes

- **[CI locale, 02/11/2026]** Node 22.22.0 ; régression hors HTTP de production : 283 tests réussis, 1 PostgreSQL ignoré faute de `pg`/serveur local ; aucune défaillance.
- **[CI locale]** Projection + Soustraction Chromium : 9 tests réussis avec données fictives.
- Chromium Abaque : vraies constructions, déplacements au clavier, scores 100/324/580, incomplet, doublon, erreurs 3 vies, Mort subite et écran 320 px ; 2 tests réussis (vrai clavier, données locales fictives), zéro appel externe ; styles Objectif record ajustés après inspection de la capture 320 px.
- PostgreSQL/Auth/Edge Abaque : NON EXÉCUTÉS ; pilote hébergé authentifié : NON EXÉCUTÉ.
- Git lecture + push dry-run : accessibles. API GitHub/Pages : refus de politique réseau, domaines ajoutés au brouillon de configuration. Aucun constat de production Supabase.

Retrait non destructif : supprimer uniquement l’entrée `abaque-longueurs` du registre expérimental ; conserver les fichiers et données locales. La carte statique n’est pas une activation serveur.

**[DÉCISION professeur + CI locale, 02/11/2026] Repères visuels :** bronze en bas à droite de la construction (12/12), argent dans les déplacements (8/8), or dans les conversions (trois séries parfaites). État « À gagner », puis « Obtenu · démo » après réussite locale. Registre local démo distinct, conservé lors d’un reset ; une performance parfaite après les deux réussites reste reconnue. Aucun trophée accordé par Master/3 vies. Les trophées Connect réels devront venir du serveur.

## Audit complémentaire — 02/11/2026

**[CI locale]** Les tests initiaux étaient trop permissifs : leur fixture de déblocage contenait déjà trois séries parfaites. Elle utilise désormais des réussites orange ; l’absence d’or après les deux premières séries est vérifiée explicitement. Master testé au départ et pendant les trois activités, même après sortie ; fuite de bronze reproduite avant correction. Les seuils 10/12 et 7/8, les perfections après deux réussites, les aides/corrections et les points progressifs 3 vies/Mort subite sont vérifiés par saisie réelle.

Résultat réaudité : 284 Node réussis + 1 PostgreSQL ignoré, 7 Chromium Abaque + 6 tests d’isolation/Laboratoire réussis, 9 Chromium existants réussis. Références des preuves et limites de publication dans le passage de flambeau mis à jour. Les deux tests HTTP de production restent non exécutés localement faute d’accès aux services hébergés ; aucun test de backend Abaque n’existe encore.

**[LIVE vérifié]** Contrairement au constat initial trop général, les pages web GitHub sont accessibles et montrent la CI. Le run de `78cfbc2` est en échec navigateur, code 1. Le test écrivait sa capture dans `/workspace` : chemin non portable corrigé, et résumé public ajouté pour vérifier le nouveau run sans confondre validations locales et CI distante.
