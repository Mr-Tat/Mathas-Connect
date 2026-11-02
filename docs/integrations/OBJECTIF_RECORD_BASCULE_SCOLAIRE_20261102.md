# Objectif record — bascule scolaire

La bascule définitive remplacera les cinq anciens lanceurs après vérification des XP Connect, trophées, parcours, projections et recette authentifiée dans la classe TEST. Les anciennes versions restent disponibles pour rollback ; aucune donnée n'est effacée.

Le routeur `apps/objective-record/release-routing.mjs` est branché dans `hub.js`, avec 3 conditions `false` par défaut. La future page `apps/objective-record/eleve.html` n'est pas encore livrée : surtout ne pas activer le routeur.

La bascule exige d'abord un ACK scolaire prouvé, des XP dans `connect_xp_credits`, l'état `connect_states`, les trophées permanents et un test Auth hébergé dans TEST. Les anciens liens `launch_url` sont toujours la solution de secours. Aucune migration SQL ni Edge n'est apportée par ce lot.
