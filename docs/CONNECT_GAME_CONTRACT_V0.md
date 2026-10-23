# Math’as Connect — Contrat commun des jeux (préparation, non activé)
Version de conception : 0.1 — 23 octobre 2026

## État
Ce document définit les exigences du prochain bloc. **Aucun jeu n'est actuellement synchronisé avec Connect.** Les jeux référencés s'ouvrent en mode local et conservent leurs sauvegardes existantes. Ne jamais annoncer une sauvegarde cloud avant la mise en service, puis le test inter-appareils.

## Identités et modes
- Le HUB de classe transmet l'identifiant de classe vers la page de connexion, et non un droit d'accès.
- Mode libre = jamais d'identité Connect transmise au jeu. Sauvegarde de jeu locale inchangée, aucun envoi d'événement ni de progression à Supabase.
- Mode Connect = l'API authentifie un appareil approuvé, son élève et son inscription à la classe. Le jeu reçoit seulement un contexte vérifiable et à durée limitée, jamais un secret serveur.
- Passer en mode libre ne détruit pas la session anonyme ; oublier un profil le fait avec avertissement explicite. Sur PC collectif, tout ancien état personnel doit quitter l'interface lorsque le mode change.

## Contrat de synchronisation à implémenter et tester
- `whoAmI`: élève de la classe et appareil autorisé, sinon refus. Aucun pseudo modifiable en V1.
- `startLaunch(app_key)`: ticket à usage unique, durée courte, lié appareil+classe+jeu et non révocable via simple query string.
- `getState(app_key)`: {schemaVersion, revision, resetEpoch, state}.
- `saveState(app_key, baseRevision, schemaVersion, state)`: accepte uniquement un JSON borné et modifié ; compare la révision serveur, retourne une erreur de conflit si dépassée (ne pas écraser). Un seul état par élève + jeu.
- `recordAttempt(eventId, app_key, activity_key, mode, level, score, points,...)`: idempotence stricte sur `eventId`, score borné, version de la grille de scores conservée.
- Toutes les actions sont privées côté Edge Function, protégées par JWT ET autorisation en base. Interdire toute écriture directe avec le seul rôle `authenticated`, utilisé aussi pour des sessions élèves anonymes.
- Chaque opération cloud doit vérifier en temps réel que le dispositif n'est pas révoqué ; la révocation invalide les tickets/sessions applicatifs.
- Pas d'appel réseau par frappe/boule/clic. Une écriture aux jalons significatifs, groupée et dédupliquée ; éviter les écritures quand rien n'a changé.
- Sauvegardes locales et distantes toujours séparées ; ne pas importer les scores libres dans le compte automatiquement.
- Gestion des erreurs réseau : garder une file locale bornée des modifications Connect, résolue prudemment à la reconnexion ; pas d'écrasement silencieux.
- Mesurer coût réseau et volume par élève/jeu ; vérifier quotas avant chaque extension.
- La règle de reset scores/progression/médailles appartient au jeu : ne pas imposer « tout effacer ».

## Tests de réception avant activation du premier jeu
1. HUB libre sans session : aucun appel aux tables privées, scores locaux inchangés.
2. Élève connecté : récupération de l'état sur l'appareil approuvé A.
3. Même élève sur appareil B nouvellement autorisé : retrouver état, scores et déblocages.
4. Mode libre sur A après connexion : état local inchangé et jamais contaminé par B.
5. Conflit A/B : la dernière progression n'est pas écrasée silencieusement.
6. Révocation A : appels cloud refusés immédiatement, mode libre toujours possible.
7. Enregistrement répété du même événement : une seule tentative en base.
8. Volume : confirmer absence de sauvegarde à chaque interaction, constater le volume réel.
9. Après mise à jour du jeu : état et déblocages conservés.
10. Restauration en arrière : aucune régression du Math’as public.

## Périmètre hors V1
Pseudo modifiable, projection publique, classements, historique long illimité, transfert automatique de tous les anciens scores, migration de toutes les applications d'un coup.
