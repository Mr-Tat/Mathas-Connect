# Abaque — ouverture des cinq espaces scolaires (15/11/2026)

## Décision et portée
Le professeur souhaite pouvoir utiliser demain l'Abaque des longueurs avec de vrais élèves connectés. La publication porte sur les cinq espaces officiels : Observation, Phase 1, Phase 2 A, Phase 2 B et 2 ECO (sans élève actuellement dans 2 ECO). Ne pas modifier les autres applications, le HUB Toutes → Tests, la démo TEST, ni les données existantes.

## Déjà en place
- Moteur + copie Connect actuelle, 204 XP maximum, 6 coupes permanentes, parcours à 80 %, Mort subite/3 vies en pages de 5 avec paliers 15/30/50 conversions.
- Edge `connect-abaque` à JWT obligatoire, preuve arithmétique côté Edge, droits et idempotence du reçu dans PostgreSQL ; file hors connexion. Professeur/élèves passent par appareil approuvé et inscription vérifiée en DB.
- SQL de droits `connect_abaque_*` sans privilèges d'exécution `anon`/`authenticated` : `service_role` seulement (audit live 15/11).

## Diff minimal
1. Politique Edge : `closed` ferme ; `pilot` limite à TEST ; `open` **ou secret absent** permet seulement aux classes explicitement `connect_abaque_classes.enabled`, exclusivement quand `SUPABASE_URL` est le projet Connect officiel. Les valeurs inconnues et projets tiers ferment. Un secret explicitement `pilot` ou `closed` ne sera jamais ignoré.
2. Après publication Edge **et vérification** du fonctionnement du mode scolaire, appliquer `supabase/release-candidates/20261115_abaque_school_all_presets.sql` sur **Math'as Connect uniquement** : les cinq classes sont activées en `pilot_only=false` et une carte visible est ajoutée dans `outils` de chacun des cinq presets. Ce SQL est idempotent et conserve la classe TEST comme pilote.
3. Ne pas réinitialiser XP, trophées, résultats ni codes/identités. Les appareils doivent demeurer approuvés.

## Contrôles et limites
- Valider CI ciblée et Pages au SHA fusionné, puis version active de l'Edge et contrôle SQL des 5 lignes + classe TEST. Le dernier workflow global du 13/11 avait **8 échecs préexistants non Abaque** : les vérifier sans les masquer.
- Une vraie recette hébergée avec **profil fictif approuvé** (jeu → preuve → reçu → XP/trophée → rechargement → professeur) est requise avant de déclarer « fonctionnel garanti pour toute la classe ». Les tests Node et la seule présence des tables ne suffisent pas.
- Si un secret Supabase `CONNECT_ABAQUE_ACCESS=pilot` ou `closed` est défini, **ne pas contourner cette sécurité** : faire confirmer au professeur la mise à `open` dans Supabase, puis recontrôler. Ne jamais envoyer le secret dans le chat.
- En cas d'incident : masquer les cinq cartes et mettre `connect_abaque_classes.enabled=false` pour les classes scolaires seulement, avec les instructions de retour arrière du fichier SQL ; ne supprimer aucun acquis. Le pilote TEST et les applications existantes restent inchangés.
