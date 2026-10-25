# XP Connect: correctif et validation

La migration Supabase `connect_xp_v2_fix_award_key_mapping` corrige l'association des jalons de réussite et du barème `connect_xp_award_rules` dans `connect_xp_sync_v2`.

L'ancienne expression régulière transformait mal les clés. Le correctif assemble désormais les composantes de chaque clé. Vérification des correspondances: `classic:1:4:perfect` = 22 XP, `classic:2:10:pass` = 30 XP, `classic:3:20:bonus` = 10 XP, `sudden:1:5` = 10 XP et `hard:3:7` = 10 XP.

Test fictif transactionnel avec suppression automatique : 398 XP et niveau 7 ; seconde exécution du calcul inchangée. Aucune donnée élève réelle modifiée.

`game-record` et `legacy-import` appellent le recalcul XP après sauvegarde. Les anciens records de `localStorage` sont fusionnés selon le meilleur acquis sans supprimer les clés historiques. Tests navigateur réels encore nécessaires.
