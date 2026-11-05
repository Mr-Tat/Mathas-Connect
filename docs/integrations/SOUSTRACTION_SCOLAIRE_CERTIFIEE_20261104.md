# Soustraction scolaire certifiée — contrat d'intégration (2026-11-04)

## But
Aligner la version élève **Soustraction écrite simple** sur le contrat de Multiplication certifiée sans changer l'identité et le moteur autonome Soustraction V6.0.2.

## Domaine
- Application : `soustraction-ecrite-simple` ; entrée HUB existante `./apps/soustraction-simple/`.
- Moteur et graphisme libres : `apps/soustraction-simple/game-original.html` **inchangés**.
- Deux méthodes : **Compensation** (`addBottom`) et **Emprunt direct** (`takeTop`), rattachées à chaque défi.
- 3 niveaux classiques, séries de 4, 10 et 20 calculs ; Mort subite, 3 vies, HARD Mort subite et HARD 3 vies, chacun avec 3 niveaux.
- Les modes 3 vies et Mort subite comptabilisent séparément leurs résultats, les paliers XP étant complémentaires (5 + 5), sans modifier le barème historique de 474 XP ni effacer de trophées ou d'acquis.
- Classe réelle : visibilité exclusivement contrôlée par `connect_hub_preset_entries`. Aucun affichage forcé et aucun jeu ouvert dans une classe masquée par simple URL.

## Contrat de confiance
1. Une session JWT approuvée et inscrite, ou un joueur professeur autorisé, appelle `connect-soustraction-school`.
2. L'Edge vérifie la classe, le profil actif, l'application et la visibilité de la carte, puis émet un ticket depuis les RPC SQL privés (les nombres proviennent du serveur).
3. Le navigateur n'envoie que la transcription des réponses, identifiée par les ID du ticket. Correction, vérification de fin de partie, déduplication et XP se produisent **atomiquement en SQL**.
4. Les anciennes actions `game-record` déclarées par le navigateur sont bloquées pour les classes scolaires Soustraction.
5. Les récompenses Connect et le meilleur score du jour proviennent des événements certifiés ; le panneau natif est préservé.
6. Projection : `connect-projection-v2` consulte le résumé vérifié et n'accepte qu'un score amélioré et issu d'une session consommée. Le choix **Oui** / **Non** de l'élève est requis ; aucune publication automatique.

## Fichiers concernés
- `apps/soustraction-simple/index.html`, `certified-school.mjs`, `school-ui.mjs`
- `apps/objective-record/school-score-view.mjs`
- `supabase/functions/connect-soustraction-school/index.ts`, `school-visibility.mjs`
- `supabase/functions/connect-results/index.ts`, `connect-projection-v2/index.ts`
- `supabase/migrations/20261104220000_school_subtraction_certified_projection.sql`
- `tests/soustraction-school-proof.test.mjs`, `tests/soustraction-certified.browser.mjs` ; CI PostgreSQL et Chromium dédiées

## Points de vigilance
- Conserver la copie du moteur V6.0.2, ses backgrounds, ses couleurs et ses trophées.
- Ne pas simuler de vrais résultats d'élèves pour tester la production.
- Ne pas activer d'un coup les cinq classes réelles masquées.
- Les tests automatisés ne constituent pas une preuve d'un véritable parcours « élève approuvé → professeur → projection » sur Pages.
- Le moteur scolaire certifié présente ses propres calculs posés et saisie de réponse, car le moteur autonome livre actuellement ses questions localement. Un contrôle ergonomique en situation élève doit vérifier l'adéquation avec la manipulation pédagogique habituelle des emprunts.

## Validation
- SQL privé installé sur Supabase, 8 nouvelles fonctions exclusivement accessibles au rôle service.
- Règles demi-XP 5 + 5 confirmées.
- Edge `connect-soustraction-school` ACTIVE v1, `connect-projection-v2` ACTIVE v9.
- Vérifier le résultat de tous les workflows PR n°213 et le déploiement de `connect-results` avant de déclarer l'ensemble livré.
- Dernière étape : essai réel depuis HUB et tableau de projection avec consentement explicite.
