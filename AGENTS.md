# Instructions pour ChatGPT, Codex et autres agents — Math’as Connect

**Avant toute nouvelle intégration, lire [docs/integrations/README.md](docs/integrations/README.md) et la [doctrine d’efficacité du 04/11/2026](docs/integrations/DOCTRINE_EFFICACITE_ET_RETEX_20261104.md).** Cette entrée renvoie aux contrats techniques, à la recette, aux erreurs connues et aux modèles à remplir. Une conversation neuve n'a pas besoin des ZIP historiques.

- Travail dans **Mr-Tat/Mathas-Connect** ; vérifier HEAD de `main` et état Supabase Connect avant d'affirmer un statut actuel. Les anciens audits ne sont pas une source de vérité.
- **Objectif prioritaire décidé par le professeur : construire directement la version scolaire élève complète** (XP serveur et indications sur les boutons si applicables, trophées disponibles dans les cases d’exercice, score optionnel, projection selon capacité, HUB/professeur). Employer le LAB fictif comme courte recette du même candidat final, et non créer une succession de versions de test. Après accord et preuves, fusionner, déployer et vérifier la vraie mise en ligne : ne pas laisser la PR en brouillon.
- Protéger le moteur pédagogique natif, les modes, les anciens jeux, les scores et XP des élèves ; isoler chaque `app_key`. Les projets Mathas legacy sont hors périmètre.
- Ne jamais confondre tests simulés, Chromium avec Auth locale, HTTP public et véritable recette navigateur hébergée avec élève fictif approuvé.
- Aucun accès ou écriture aux données d'élèves réels pour tester ; aucune migration, activation, remise à zéro ou redéploiement non autorisés.
- Pour le jeu suivant : commencer par copier la [fiche d'application](docs/integrations/TEMPLATE_FICHE_APPLICATION.md) et terminer par le [passage de flambeau](docs/integrations/TEMPLATE_PASSAGE_FLAMBEAU.md).
- Employer une branche/PR à portée étroite, CI vérifiée sur le SHA exact et rollback non destructif. Les décisions pédagogiques doivent être explicites ; ne jamais copier arbitrairement le barème d'un autre jeu.
- Documenter chaque constat comme **[LIVE vérifié]**, **[REPO vérifié]**, **[CI locale]**, **[RECETTE hébergée authentifiée]**, **[DÉCISION professeur]**, **[PROPOSÉ]** ou **[HISTORIQUE]**. Datation + provenance obligatoires.
- Aucun secret JWT/service_role, export privé ni nom d'élève dans commit, issue, log partagé ou passage de relais.

Pour `GRAN-abaque-m-1`, la décision du professeur du 02/11/2026 impose le dépôt autonome comme source des évolutions du moteur et de l’accueil. Connect conserve une copie versionnée dans `apps/GRAN-abaque-m-1/` et ses adaptateurs. Voir [le nommage et la synchronisation](docs/integrations/NOMMAGE_GRAN_ABAQUE_M_1.md). Conserver l’`app_key` et les clés des résultats lors du renommage des dossiers.

La mission de documentation seule ne permet jamais d'appliquer SQL/Edge, de tester avec de vrais élèves ou d'ouvrir un jeu.
