# Audit de sécurité RESTORE — 24/10/2026

## Portée et vérité opérationnelle
- Source du passage de flambeau : ZIP complet 24/10, dossiers 00, 03, 04 et 08.
- Supabase project `awmhpfofacaglewammxt` : `connect-results` ACTIVE V8, `verify_jwt=true`. Source live relue : aucune action `teacher-restore-preview` ou `teacher-restore-apply`.
- GitHub `supabase/functions/connect-results/index.ts` blob `0a2022e14c19fced880f37ec4fe1234a3facc97f` : contient les deux actions de restauration ; NON DEPLOYE.
- Ce fichier est un **audit statique**, et non une recette d'intégration. Aucun compte d'élève, état de score ou export privé n'a été modifié/utilisé.

## Risques bloquants constatés dans le code préparé
1. `safetyBackupExported` est un booléen contrôlé par le navigateur. Il n'existe ni journal d'avant-restauration serveur ni transaction atomique capture+update. **Bloquant pour apply réel.**
2. Contrôle CAS par `revision` et `reset_epoch` au moment de l'UPDATE présent, mais pas de jeton de preview lié au hash du fichier, à l'identité, à la cible et aux révisions avec TTL. Une autre sauvegarde peut être substituée avant apply sans repasser par la même preview. **Bloquant.**
3. `backupState` fourni directement par le client n'est pas authentifié/signé ; vérifier une politique de confiance de l'export (signature serveur ou registre) et traçabilité. Les champs `backupRevision` et `backupProjectRef` ne constituent pas une preuve.
4. La logique `recoverPastReset` rend possible le retour de scores supprimés lorsque `backupResetEpoch` est plus ancien. L'interface doit présenter clairement cette conséquence et recueillir une autorisation distincte.
5. Validation perfectible : `validate()` filtre silencieusement des IDs/topThree invalides, `recent.at` ne valide qu'un préfixe ISO, et `mergeHistorical()` requiert `old.topThree` comme tableau ; couverture de compatibilité V1/V2 à tester sur données synthétiques. Le `todayBest` historique ne doit pas être attribué à aujourd'hui.
6. `appAllowed` et la branche RESTORE se limitent à l'Addition (acceptable pour pilote) : généralisation multi-jeux nécessite adaptateurs distincts, non une fusion uniforme.
7. Absence de tests de refus exécutés pour mauvaise classe, professeur non gestionnaire, élève non inscrit, token anonyme, conflit de révision et import identique.

## Contrôles non destructifs effectués
- Liste des Edge Functions : connect-api V7, connect-results V8, connect-ui V1.
- Schéma SQL lu en SELECT uniquement ; RLS activée sur les 18 tables `connect_*` relevées. Cela ne prouve pas encore la suffisance de toutes les policies ou des GRANTs.
- Registre `connect_apps` : Addition active vers CE-Addition-simple, connect-lab inactif.
- Blob `CE-Addition-simple/game-original.html` : `764335bdde1558de6caf362cbcc6239c12321d41`, conforme au repère original du ZIP.

## Barrières avant un déploiement
1. Écrire des tests unitaires autonomes utilisant uniquement le JSON entièrement fictif de `08_SAUVEGARDES/04_EXEMPLE_FORMAT_FICTIF.json` ou jeux construits de zéro.
2. Ajouter une primitive transactionnelle côté SQL avec snapshot d'avant-mutation en table privée, CAS et journal d'audit ; aucune permission navigateur directe.
3. Lier une preview TTL à l'empreinte de la sauvegarde, à la cible, à l'opérateur et à `revision/reset_epoch`. Refuser les changements et les replays.
4. Tester séparément refus de droits, epochs anciens, doublons, fusion non destructive, idempotence, validations malformées et rollback sur base/projet fictif.
5. Vérifier syntaxe/typecheck et sécurité. Déployer alors seulement une nouvelle version Edge ; contrôler version ACTIVE et source live après déploiement.
6. Essayer preview/apply/rechargement/rollback sur élève et classe **fictifs**, jamais sur la sauvegarde personnelle du professeur.

## Statuts
- Import V6.0.2, offline/rattrapage, reset et HARD mort subite N1 : **VALIDÉ selon les tests déjà consignés** (ne pas redemander).
- UI GitHub RESTORE : **PUBLIÉ MAIS NON TESTÉ**, backend correspondant **PRÉPARÉ NON DÉPLOYÉ**.
- Déploiement RESTORE, audit/rollback transactionnel et validation fictive : **FUTUR / BLOQUÉ**.
- HUB visuel final et tableau projeté : **FUTUR**. Tableau projeté envisagé : scores de la semaine au centre, classes à gauche, évolutions à droite, exploits en haut à droite ; pseudonymes et publication contrôlée.

## Invariants de migration
Original V6.0.2 immuable ; dépôt originel public tant que ressources et imports en dépendent. Modes Classique local/Connecté par compte, un dépôt par jeu, `app_key` stable, trophées et barèmes spécifiques. Aucun défi HARD 5 calculs mis en avant. Aucun test de dix calculs supplémentaire sans nécessité.
