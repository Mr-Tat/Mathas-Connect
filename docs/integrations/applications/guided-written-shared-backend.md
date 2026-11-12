# Service commun — guidé collectif des 3 autres calculs écrits (candidat non publié)

**Source de vérité :** pilote Multiplication, PR #294 (brouillons F5) et #295 (réseau côté élève uniquement au clic), toutes deux fusionnées. Multiplication utilise sa propre Edge et sa propre table ; ne pas la changer ici.

## Architecture proposée
- Une Edge `connect-guided-written` et une table RLS privée `connect_guided_written_sessions` avec clé composée `(app_key,class_id)`, pour Addition simple, Addition multiple et Soustraction simple.
- Chaque jeu passe son vrai `app_key`. Les élèves authentifiés peuvent demander `status` pour **leur propre classe**, jamais envoyer chiffres ou résultats. Les écritures et commandes restent réservées au compte enseignant autorisé côté serveur.
- Isolation des classes : inscription, appareil approuvé, permissions professeur, catalogue et visibilité du HUB, classe TEST distincte.
- Générateurs séparés : additions simples de 3/5/7 chiffres ; additions multiples de 3/4/5 termes avec tailles adaptées aux niveaux 1/2/3 ; soustractions de 3/5/7 chiffres avec emprunts natifs.
- Historique immutable des pages, pages obligatoires rétroactives gérées côté client avec état privé et statut serveur au clic.
- Fermeture : pagehide + tolérance ~15 s, heartbeat enseignant ~25 s, repli ~10 min.
- **Aucune réponse d'élève dans Supabase** ; aucun nouveau score/XP/trophée.
- Migration SQL `20261112_guided_written_sessions.sql` **candidate seulement**, non exécutée.

## État et portes
- Générateurs, Edge, migration et tests Node de génération/sécurité ajoutés sur cette branche.
- CI à vérifier sur SHA exact ; vérification réelle des droits Auth, RLS, Edge local, tests avec profils fictifs et tests navigateur encore à réaliser.
- Aucune Edge déployée ; aucune SQL appliquée ; aucun changement de visibilité.
- Cette PR reste **brouillon**, non fusionnée avant tests et raccordements clients.
- Trois intégrations clientes séparées : Mathas-Connect PR #297 (multiple), #298 (soustraction), CE-Addition-simple PR #27.

## Risques/RETEX
- Le format du générateur Addition multiple est `addends` (pas `terms`) et utilise 3, 4, 5 termes ; correction du premier contrat PR #297.
- Les reports peuvent valoir 2–4, pas seulement 1.
- Les deux méthodes de soustraction `addBottom` / `takeTop` demandent des adaptateurs d'interface distincts. L'existence d'un résultat mathématique ne constitue pas une preuve de réussite native.

## Vérification d'intégration du 12/11/2026
- CI Deno type-check du nouvel Edge : OK.
- CI PostgreSQL 17 jetable : syntaxe migration, activation RLS et révocations anon/authenticated : OK.
- CI générateurs et règles sécurité : OK.
- **Différence découverte par Chromium** : Addition simple et Soustraction = niveaux de 3/5/7 chiffres ; Addition multiple = 5/6/7. Correctif des générateurs et nouveaux tests de largeur sur cette PR.
- Code strictement candidat, ni migration LIVE, ni Edge LIVE, ni test Auth connecté en classe.
