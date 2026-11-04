# Math'as Connect — paliers de personnalisation révisés le 4 novembre 2026

Le niveau Connect de l'élève est calculé par Supabase à partir des XP Connect cumulés. Un ancien document de conception peut mentionner des seuils différents ; le calendrier ci-dessous est celui appliqué par le HUB et contrôlé par `connect-api`.

| Niveau | Total XP requis | Déblocage |
| ---: | ---: | --- |
| 1 | 0 XP | Initiale scolaire et fond transparent |
| 5 | 200 XP | Avatars animaux |
| 10 | 600 XP | Couleurs de fond |
| 15 | 1 100 XP | Avatars smileys |
| 20 | 1 600 XP | Pseudo public personnalisé |
| 25 | 2 100 XP | Avatars objets |

Barème XP : les niveaux 2 à 7 s'espacent de 50 XP, les suivants de 100 XP (fonction SQL `connect_xp_read_v2`). Le changement des paliers **ne modifie pas le calcul XP**, les crédits, l'identité, les records, les trophées ou les sauvegardes des élèves.

## Validation

- Les cartes « Mes récompenses de profil » et l'animation de retour au HUB utilisent `PROFILE_REWARDS`, un seul calendrier.
- L'API vérifie sur le serveur le niveau effectif / maximal acquis ; le navigateur ne peut pas demander un palier verrouillé ni faire passer un niveau arbitraire.
- `connect_profile_reward_celebrations` autorise uniquement les accusés de réception des nouveaux niveaux (5/10/15/20/25). L'ancienne table contenait zéro accusé lors du précontrôle.
- Les anciennes valeurs d'avatar, de fond ou de pseudo ne sont **pas effacées**, même si l'élève est actuellement sous un nouveau seuil. En revanche une modification future attend le nouveau niveau requis.
- Le profil « Monsieur T » conserve l'accès enseignant déjà présent dans l'API, indépendant des déblocages des élèves.
- La célébration au retour au HUB n'est pas diffusée en pleine partie.

Si un futur recalibrage XP modifie le niveau courant, suivre les mêmes principes de validation serveur et de non-effacement des choix sauvegardés.
