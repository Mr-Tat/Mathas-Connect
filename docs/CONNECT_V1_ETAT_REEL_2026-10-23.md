# Math’as Connect — Contrat V1 opérationnel
Date : 23 octobre 2026

## Décision
- Un dépôt GitHub par jeu, préfixe pédagogique plutôt que technique : `CE-Addition-simple`, puis famille à décider à chaque migration.
- `Mathas-Connect` contient le HUB, les parcours professeurs, les Edge Functions et le suivi.
- L'ancien `Addition-ecrite-simple` V6.0.2 reste intact pour récupérer les sauvegardes historiques.
- Un projet Supabase partagé pour l'ensemble des applications Connect. `app_key` stable et indépendant du nom GitHub.
- Le HUB lit `hub-catalog.json` (statique, économique) ; `connect_apps` dans Supabase est le registre serveur des jeux autorisés. **Tenir les deux à jour**.

## Frontend actuellement en ligne
- `https://mr-tat.github.io/CE-Addition-simple/?class=<UUID>`
- Jeu intégral V6.0.2 conservé dans `game-original.html`.
- `index.html` enrobe le jeu sans réécriture ; mode Classique ou Connecté, bandeau d'identité, intégration réseau.
- `legacy-import.js` fusionne les anciens scores locaux ; clic explicite et aucune suppression des originaux.
- Espaces locaux séparés par clé, et par identité. Les dépôts `mr-tat.github.io` partagent l'origine navigateur ; séparer les repositories ne sépare pas `localStorage`.
- Un échec de validation du compte Connecté **bloque le lancement connecté** et propose une reconnexion ou le choix explicite du Mode Classique : pas de bascule silencieuse.
- File d'attente locale dédiée au compte connecté, événement UUID idempotent, reprise à la reconnexion ou à la réouverture du jeu, état Synchronisé/En attente/Hors ligne.
- Mode Master : en connecté les actions `restart` et `erase-results` sont envoyées au serveur et leur effet local n'est exécuté qu'après confirmation. En Classique, comportement natif de V6.0.2 inchangé.

## API Connect V7
Les Edge Functions déployées dans Supabase :
- `connect-api` V7, JWT vérifié : inscription, confirmation, révocation, appareils, classes, identité.
- `connect-results` V7, JWT vérifié : `student-load`, `game-record`, `legacy-import`, `game-reset`, `teacher-summary`, `teacher-detail`, `teacher-export`, plus laboratoire `lab-record`.
- `connect-ui` V1 : prototype d'interface de test, non intégré au chemin recommandé.

Contrat `connect-results` pour une application :
- Lire : `{action:'student-load',classId,appKey}` renvoie `revision`, `resetEpoch`, `state`.
- Partie achevée : `{action:'game-record',classId,appKey,eventId,expectedRevision,expectedResetEpoch,mode,level,score,total,points,rewards?}`.
- Modes effectivement jouables dans Addition V6.0.2 : `classic` (4/10/20), `sudden`, `hard` (Mort subite HARD). Le type API `hard-challenge` (cinq calculs) existe pour compatibilité historique mais **le menu du jeu ne propose plus ce défi** et `startHard` refuse explicitement `challenge`. Ne pas demander de test 5/5.
- Conflit de revision : relire, réessayer avec même `eventId`. **Une différence de `resetEpoch` interdit définitivement de renvoyer l'ancien événement.**
- Import historique manuel : `legacy-import`, avec `expectedRevision` et `expectedResetEpoch`, fusion par maxima et union des trophées/déblocages, aucune partie récente créée.
- Reset Master : `game-reset` avec `resetType:'restart'|'erase-results'` et garde revision+resetEpoch. `resetEpoch` est incrémenté et la file du navigateur est purgée après succès.
- L'enseignant disposant du droit de gestion de classe peut utiliser `teacher-export` pour télécharger un JSON **privé** avec noms et scores, via le bouton du tableau de bord. Jamais dans un repo public.

## Sécurité
- Tables `connect_*` privées sous RLS ; aucun GRANT direct aux rôles navigateur pour les tables d'élèves, appareils, scores et classes.
- Vérifier JWT à chaque requête côté Edge ; relier l'identité anonyme à un appareil approuvé + une inscription active.
- Les clés `service_role` restent UNIQUEMENT dans l'environnement Supabase Edge.
- La perte du navigateur n'efface pas le compte Supabase, mais peut perdre un résultat non synchronisé ; toujours afficher l'état de la file.
- `student-save` arbitraire est désactivé ; seule écriture avec contrat spécifique.
- Les valeurs de points restent fournies par le client du jeu, donc ce n'est pas un système anti-triche fort.

## Économie
- Pas de requête par frappe, clic ou boule déplacée : une lecture au chargement + une écriture par résultat achevé, plus retries nécessaires.
- `hub-catalog.json` est statique pour éviter des lectures répétées.
- Ne pas stocker tout l'historique illimité : 3 dernières parties, records et progression.
- Sur Supabase Free, utiliser l'export privé du professeur, et organiser la conservation chiffrée hors des dépôts publics. L'export n'est **pas** une restauration testée : documenter puis éprouver la restauration hors production.

## Observations du premier audit
- Parcours enseignants/élèves, appareils multiples, révocation, records Classique et Mort subite, progression, import V6.0.2 validés par essais réels du professeur.
- Le professeur a observé « En attente : 1 » lors d'une coupure puis l'arrivée du résultat dans l'espace professeur après reconnexion : reprise réseau **validée par retour utilisateur**. Les remises à zéro et l'export privé ont également été essayés ; le faux 10/10 après reset a été corrigé et vérifié. Le backend `connect-results` est désormais en V8.
- Le dossier `README.md` du jeu et l'ancien `CONNECT_GAME_CONTRACT_V0.md` décrivent des états historiques antérieurs. Ce V1 fait foi pour la prochaine discussion.
- Pour 50 jeux, prévoir un petit composant commun/versionné pour auth, file, identités, resets, métriques. **Ne pas recopier les règles propres à Addition** pour des jeux différents.
- L'ancienne app reste nécessaire tant que les élèves migrent et tant que ses images ne sont pas rapatriées.

## Recette ciblée, une seule campagne
1. Classique vs Connecté, identité affichée, aucune contamination de données.
2. Couper Internet pendant une partie déjà ouverte, la terminer, revoir le statut *En attente*, reconnecter et constater une seule partie côté professeur.
3. Sur un compte de **test**, vérifier les deux resets Master, sur deux Chrome et après reconnexion, sans rejouer les campagnes antérieures.
4. HARD Mort subite : record déjà observé au niveau 1 ; ne pas tester le défi 5 calculs devenu inaccessible. À vérifier éventuellement sur un deuxième appareil lors d'une future recette globale.
5. Professeur : cliquer Exporter une sauvegarde, vérifier que le JSON privé contient les résultats attendus et le conserver en lieu sûr.
6. Contrôler que le vieux jeu V6.0.2 et ses anciennes données sont toujours intacts.

## Liens
- HUB : https://mr-tat.github.io/Mathas-Connect/
- Jeu Connect : https://mr-tat.github.io/CE-Addition-simple/
- Original : https://mr-tat.github.io/Addition-ecrite-simple/
- Repo central : https://github.com/Mr-Tat/Mathas-Connect
- Repo jeu : https://github.com/Mr-Tat/CE-Addition-simple
