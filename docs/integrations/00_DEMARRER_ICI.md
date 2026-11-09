# Math'as Connect — synthèse commune à lire en premier

> **Document normatif court**, pas un état de production. Après `AGENTS.md`, lire le [suivi actif](SUIVI_COURANT.md) (**résumé + jeu pertinent**). Pour une formule, un incident ou du SQL, ouvrir **la section utile seulement** des références ci-dessous.

## Méthode efficace

- **Préserver le moteur pédagogique original**, ses méthodes, modes, déblocages et source/empreinte. Ajouter un adaptateur Connect minimal. **Une version scolaire finale**, avec laboratoire fictif pour vérifier CE candidat seulement, pas de prototypes en série.
- Avant de coder : auditer activités, modes et vraies fins ; déclarer **XP / trophées / scores / Objectif record / projection / réglages professeur** comme applicables ou **SANS OBJET**. Ne pas inventer de récompenses.
- **Brainstorm OBLIGATOIRE avec le professeur pour toute nouvelle app, après audit et AVANT le code des récompenses** : proposer (1) XP — critères, seuils, montants, plafonds, compléments ; (2) trophées — conditions, coupes et total visible ; (3) scores — pertinence, formule, coefficients et records. Fournir exemples chiffrés/alternatives. **Le professeur tranche chaque point** ; sans validation explicite, statut **EN ATTENTE**, pas de barème codé. Consigner les décisions dans la [fiche d'app](TEMPLATE_FICHE_APPLICATION.md). Audit et travaux indépendants autorisés.
- **Chemin critique** : HUB → identité autorisée → vraie activité → preuve serveur → reçu/ACK → reprise → XP/coupes si approuvés → professeur → projection éventuelle. Tests ciblés, corriger la cause plutôt qu'empiler des rustines ; documenter les raccourcis vérifiés.

## Socle Connect, selon les capacités réelles

- **HUB/identité** : `app_key` stable, carte/miniature, autorisation serveur et par classe, pastille + avatar + nom ; Monsieur T distinct de l'élève ; mode libre isolé de Connect.
- **Interface** : nom/version, niveau global + jauge XP, accès XP restants, retour et plein écran, sans doublon ni hauteur gaspillée. « Reste N XP » sur le bouton concerné **uniquement si droit confirmé serveur** ; inconnu ≠ 0.
- **Progression** : méthodes/niveaux natifs respectés, trophées **visuels et uniques**, encore à gagner assombris, acquis permanents après reset de scores ; XP serveur non recrédités par répétition.
- **Scores facultatifs** : points distincts des XP, score du jour, record personnel/historique si pertinents. Projection **uniquement** par classe + app, score certifié et consentement explicite Oui ; mode « Score du jour » / « Meilleur score » si adapté.
- **Fiabilité** : enregistrer la preuve et l'ACK **avant animations ou changement de menu** ; idempotence, abandon sans blocage, reprise, sauvegarde, réglages/résultats professeur, clavier, petits écrans.
- **Publication** : vérifier indépendamment `main`+CI, Pages, Edge/SQL, catalogues/classes et recette navigateur avec profil fictif approuvé. PR fusionnée ≠ publiée. Aucun test sur élève réel, reset global ni déploiement implicite.

## Règles historiques applicables seulement aux jeux concernés

Pour les **quatre calculs écrits confirmés** : Mort subite arrête à la première erreur complète, 3 vies à la troisième (une vie au plus par calcul fautif). **À même difficulté et bonnes réponses : Mort subite = ×2 points de 3 vies avant arrondi**, jamais +20 %. Aux jalons partagés, 3 vies donne **demi-droit XP**, Mort subite **droit plein**, sans double crédit. **Un trophée lié au score peut être gagné en 3 vies** ; seuls les trophées propres à Mort subite l'excluent. **Ne pas recopier ces chiffres sans brainstorming pour un autre jeu** ; Mélange dispose de formules différentes.

## Documentation ciblée et apprentissage continu

- [Contrat fonctionnel complet #272](CONTRAT_FONCTIONNEL_COMMUN_APPLICATIONS_20261109.md) : cas détaillés, formules JS/SQL et tests.
- [RETEX opérationnel + tendances émergentes](RETEX_OPERATIONNEL.md) : symptômes, causes, solutions, raccourcis prouvés. **Lire uniquement si incident ou enseignement à capitaliser**.
- [Procédure d'intégration](README.md) · [tests et publication](RECETTE_ET_PUBLICATION.md) · [fiches par jeu](applications/README.md).
- **À chaque passation :** fiche de l'app mise à jour ; dans [le suivi](SUIVI_COURANT.md), une ligne d'état et un lien. Les incidents détaillés et preuves ne sont pas recopiés dans ce résumé. Une tendance reproductible est promue au RETEX.
