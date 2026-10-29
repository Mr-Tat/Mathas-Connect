# Math’as Connect — état de référence (29 octobre 2026)

Plateforme Math’as Connect : HUB élèves, espace professeur, résultats autonomes par application, XP globaux et tableau de projection. Site statique léger sur GitHub Pages ; Supabase **Connect** (`awmhpfofacaglewammxt`) conserve les identités, les états Connect et les XP.

## Accès utiles

- [Espace professeur](https://mr-tat.github.io/Mathas-Connect/index.html?portail=prof)
- [HUB élèves](https://mr-tat.github.io/Mathas-Connect/hub.html)
- [Projection collective](https://mr-tat.github.io/Mathas-Connect/projection.html)
- [Addition connectée](https://mr-tat.github.io/CE-Addition-simple/)
- [Multiplication connectée](https://mr-tat.github.io/Mathas-Connect/apps/multiplication-simple/)
- [Soustraction connectée — recette professeur uniquement](https://mr-tat.github.io/Mathas-Connect/apps/soustraction-simple/)

## Ce qui est réellement installé

| Application | Hébergement du jeu connecté | Résultats et XP Connect | Exposition élèves |
| --- | --- | --- | --- |
| Addition écrite simple | `Mr-Tat/CE-Addition-simple` | Opérationnels | Publique selon les règles du HUB |
| Multiplication écrite simple | `Mathas-Connect/apps/multiplication-simple` | Opérationnels, séparés de l'addition | Publique selon les règles du HUB |
| Soustraction écrite simple | `Mathas-Connect/apps/soustraction-simple` | Intégrés et vérifiés ; deux techniques distinctes pour les records Mort subite | **Volontairement masquée** dans les quatre HUB et désactivée dans le catalogue serveur jusqu'à la validation professeur |

La Soustraction est **déjà intégrée et déployée** : **ne pas la réintégrer**, ni réappliquer sa migration ou redéployer `connect-results` pour « terminer » le travail. Les liens directs de recette ne constituent pas une activation auprès des élèves.

Les gains d'XP affichent un popup puis son vol vers la jauge. Le professeur a demandé le maintien de **toutes les animations même quand `prefers-reduced-motion: reduce`**. Cette décision est appliquée dans les trois applications, mais reste un compromis d'accessibilité explicite : éviter d'ajouter d'autres effets incontrôlés.

## Règles actives et données à préserver

- **474 XP théoriques maximum par application** pour les trois calculs écrits : Classique 4/10/20, Mort subite classique et Mort subite HARD par niveau. Déblocages Master Mode et répétition d'un même palier ne donnent pas de nouveaux XP.
- Niveau global Connect : de 0 à 300 XP, seuil de 50 XP par niveau ; ensuite 100 XP par niveau. Les XP sont cumulés entre applications, les résultats et reprises restent **indépendants par `app_key` et par parcours**.
- Une seule récompense par jalon validé et par parcours admissible ; ne pas additionner les points locaux du jeu aux XP Connect.
- Les résultats déjà obtenus, les XP crédités, les jalons et archives de reprise des élèves doivent rester **intacts**. Aucune remise à zéro, import historique, migration destructive ou recalcul de masse sans demande explicite.
- Mode **Classique** local distinct du mode **Connecté** côté serveur ; ne pas fusionner leurs sauvegardes.
- Stockage `connect_states` par (élève, application), avec `revision` et `reset_epoch` ; file locale bornée et idempotence côté serveur.
- Les réglages professeur `GLOBAL` pilotent les quatre espaces (Observation, Phase 1, Phase 2, 2 ECO), séparément de la progression et de l'identité des élèves.
- Le projet Supabase legacy `jftzuslpelgzbdrftszw` et l'ancien dépôt `Mr-Tat/Mathas` ne doivent **pas** être modifiés pour les fonctionnalités Connect.

## Projection — première version publiée

Les quatre boutons « Projection » de la page professeur mènent au tableau collectif ; la classe correspondant au lien est présélectionnée. La session professeur existante est requise, et le serveur vérifie les droits de gestion de la classe. Par défaut, **aucun élève ni résultat n'est chargé avant un clic** sur « Afficher / Actualiser ».

La projection montre uniquement des nombres collectifs : inscrits, participants dans l'historique récent, participants aujourd'hui et participation par application. Aucun prénom, record personnel ou classement. La Soustraction reste exclue du tableau tant qu'elle est masquée. Les données sont rafraîchies **manuellement**, jamais en polling. Masquer, changer de classe, quitter la page ou se déconnecter efface l'affichage. Les appels ont un délai limite pour les petits PC et réseaux faibles.

**Limite des données :** les indicateurs de participation se basent sur les **trois dernières parties disponibles par application**, pas sur l'intégralité historique des tentatives. Ne pas décrire ce chiffre comme « tous ceux qui ont déjà joué ». Le tableau est une base fonctionnelle, pas encore le tableau pédagogique complet demandé pour le long terme.

## Vérifications automatisées et limites

- Régression GitHub Actions : `.github/workflows/mathas-connect-tests.yml` (Node, sans modification des données).
- Navigation réelle isolée : `.github/workflows/soustraction-browser.yml` et `.github/workflows/projection-browser.yml`, avec comptes et serveur **fictifs**.
- Smoke de production Soustraction : `soustraction-live-readonly.yml` ; **lecture seule**, pas d'écriture des comptes ni des XP.
- Les tests prouvent le contrat et l'absence de régression identifiée ; ils ne remplacent **pas** des essais avec le vrai PC de classe, la connectivité réelle ni l'affichage projeté.
- Les sauvegardes chiffrées vers `Mr-Tat/Mathas-Connect-Sauvegardes` sont privées ; une sauvegarde déposée n'est **pas** un test complet de restauration.

## Prochaines étapes, dans l'ordre

1. **Recette réelle, par le professeur quand disponible** : Soustraction dans le profil de test, ses deux méthodes Mort subite, le HARD, ses XP et son animation ; surtout **sans supprimer ou recréditer artificiellement les jalons**.
2. Contrôle de lisibilité sur les petits PC et le projecteur, puis choix par le professeur des prochains indicateurs pédagogiques à montrer à la classe.
3. Seulement après validation explicite, autoriser progressivement Soustraction avec la matrice `GLOBAL`, **sans rendre automatiquement ses quatre HUB visibles**.
4. Préparer une application suivante à partir de son moteur autonome réel ; examiner ses modes et ses niveaux avant de choisir les XP. Éviter une intégration groupée de plusieurs jeux tant que l'un d'eux n'a pas passé sa recette.
5. Préserver les quotas GitHub/Supabase et la fluidité : lectures ciblées, écriture une fois par partie, pas de suivi par frappe ni de rafraîchissement permanent.

## Notes anciennes / historique

Les fichiers datés sous `docs/*` documentent le raisonnement et les étapes précédentes. **Ils ne sont pas tous à jour** : plusieurs disent encore « XP non implémentés », « Soustraction à intégrer » ou « moteur original inchangé ». Ce sont des assertions historiques **supplantées par l'état de production et les tests du dépôt actuel**. Les décisions métier stables restent décrites dans `docs/PASSAGE_DE_FLAMBEAU_XP_CALCULS_ECRITS_2026-10-25.txt`, mais ne pas confondre ses notes de déploiement historiques avec la situation actuelle.
