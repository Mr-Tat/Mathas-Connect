# Abaque : accueil et trophées Mort subite

**[DÉCISION professeur — 2 novembre 2026, montage et demande dans cette conversation]** Cette décision remplace les anciennes descriptions d’une collection limitée à trois trophées et de médailles pour les scores.

Les trois activités occupent la première rangée sur grand écran. « Objectif record » dispose d’une carte séparée en dessous. Les formats classiques 1, 3 et 5 pages affichent leur meilleur résultat au premier essai, par exemple `4/4`, `10/12`, `16/20`, sans le préfixe « Réussite ». Les deux premières activités conservent leurs deux résultats et leur progression.

Les deux modes record deviennent accessibles après au moins 80 % dans **chacun** des formats classiques : 4/4, au moins 10/12 et au moins 16/20. Master permet toujours l’entraînement sans progression ni récompense. Les boutons restent visibles lorsqu’ils sont verrouillés.

| Trophée | Règle du moteur, sans texte de condition sur les icônes |
| --- | --- |
| Construction · bronze | Une construction parfaite, 12/12 |
| Déplacements · argent | Une série parfaite, 8/8 |
| Conversions · or | Les trois formats classiques parfaits : 4/4, 12/12, 20/20 |
| Mort subite · bronze | 3 pages justes consécutives dans une même partie |
| Mort subite · argent | 5 pages justes consécutives dans une même partie |
| Mort subite · or | 8 pages justes consécutives dans une même partie |

Une page Mort subite contient une conversion. Une erreur termine la partie : les réussites de plusieurs parties ne se cumulent pas. Le mode 3 vies ne donne aucun trophée. L’or classique est indépendant des deux modes record. Les coupes déjà gagnées sont permanentes ; la collection comporte six emplacements. Les seuils de points ne donnent plus de médailles.

Les trois coupes Mort subite sont en bas à droite du bouton, en dehors du cadre « +20 % de points ». Seuls les pictogrammes sont affichés. Le compteur discret « Reste N XP » est séparé des coupes. Hors simulation explicite, il exige toujours une session Connect approuvée et des droits confirmés par le serveur. La simulation du Laboratoire conserve ses trois choix et n’écrit aucun faux résultat dans les acquis locaux.

Les points et le barème XP candidat (160 XP) restent ceux décidés précédemment. Les nouveaux trophées Mort subite sont distincts des jalons XP record. Cette demande autorise leur préparation et les tests ; elle ne déploie aucune migration ou Edge de production.

**[CI locale — 02/11/2026]** Les dix scénarios Chromium ont été validés sur le moteur réel au clavier, dont les seuils exacts 3/5/8, une partie précédente à deux réussites, huit réussites en 3 vies sans coupe, une partie commencée en Master puis terminée hors Master, le verrouillage indépendant pour chacun des trois formats et la conservation après rechargement/reset. Simulation et géométrie des coupes/XP vérifiées à 320/768/1440 px ; inspection des captures PC et mobile. Régression Node hors services : 284/284. Les deux tests HTTP hébergés et l’ancien runtime PostgreSQL Soustraction sont exclus de ce lot local ; la CI GitHub exécute sa suite commune complète avant Chromium. Aucune recette Supabase hébergée authentifiée n’est revendiquée.
