# Livraison — trophées permanents et compteurs par application

**Date de référence :** 31 octobre 2026. **PR :** [#48](https://github.com/Mr-Tat/Mathas-Connect/pull/48) ; **commit de main :** `2f89e5ebece8b71e8ca685ae8ec9545150be2844`.

## Déployé et revérifié

- **Supabase Connect :** migration `20261031140943_connect_permanent_trophies_hub_v1` appliquée par Supabase ; RLS sur `connect_trophy_achievements`, droits réservés au `service_role` ; trigger d'acquisition et fonctions de lecture. Backfill **non destructif** depuis les résultats actifs et les archives. Vérification agrégée : **6 trophées** retrouvés après la migration, **un trigger** installé ; aucun reset ni changement des crédits XP.
- **Edge :** `connect-api` **v26** et `connect-results` **v41**, ACTIVE, `verify_jwt=true`. Octets des sources vérifiés identiques aux sources de la PR. Le serveur récupère une vue V3 permanente au chargement d'un jeu ; le profil Auth reçoit un résumé compact, sans lecture des résultats d'autres élèves.
- **HUB :** le badge sous Niveau affiche `🏆 N trophées`. Les cartes connectées affichent `⭐ XP gagnés dans ce parcours / maximum` et `🏆 trophées uniques / total native V3`. Pas de nouvelle requête par carte ; actualisation au retour d'un onglet, sans polling permanent. Mode libre inchangé. GitHub Pages : run réussi pour le commit de fusion.
- **XP :** `connect_xp_credits` demeure historique/global et n'est pas débité. Les XP de **l'application et du parcours courant** sont calculés en retirant la valeur cumulative `archived_xp` de la dernière archive ; donc 0 immédiatement après reset. `repeatXp` suit ses permissions existantes, indépendant des trophées.
- **Trophées :** les clés dérivent exclusivement des **25 emplacements du schéma natif V3** : maîtrise 4/10/20, mort subite, distinctions HARD, score unitaire, Gold. Un moteur sans le même contrat devra déclarer son propre nombre et mapping, **pas reprendre 25 aveuglément**.

## Preuves et limites

- CI de la PR : **8 vérifications réussies** sur son dernier SHA, incluant un PostgreSQL 16 jetable vérifiant la récupération historique, la déduplication, les permissions SQL, le reset et la différence XP courant / XP historique.
- Recette locale réelle Auth / Edge / PostgreSQL + Chromium : succès de 4/4, 22 XP, trophée, redémarrage enseignant et réhydratation du trophée. La classe et les personnes sont **fictives**.
- GitHub Pages, tests de régression sur `main` et smoke public de Soustraction : succès.
- **Non exécuté :** recette d'une partie complète réellement authentifiée dans un navigateur relié aux services de production. Le succès des tests locaux ne la remplace pas.
- Le visuel 320 px a reçu des styles responsifs ; aucune validation manuelle sur ordinateur scolaire physique n'est attestée.

## Retrait sans perte

Si une régression est découverte, revenir au code des deux Edge antérieur à la PR (v25/v40, sources conservées dans GitHub) et au HUB antérieur via PR de retour, **sans supprimer la table de trophées ni les acquis historiques**. Ne jamais rejouer une migration de reset global. Vérifier d'abord les appareils et profils du laboratoire.

Toute prochaine intégration doit lire le [contrat commun](CONTRAT_COMMUN_SCORES_XP_TROPHEES.md) et fournir des tests de ses vrais trophées natifs ; ne pas convertir les jalons XP en distinctions.
