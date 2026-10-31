# Messages prêts à copier pour les prochaines discussions Codex

Ces messages servent de mandat de départ. Compléter les éléments entre crochets et préciser séparément l'autorisation de production souhaitée. Ne pas présenter une ancienne autorisation pour Mélange comme celle d'une nouvelle application.

## Message général : toute nouvelle application

```text
MISSION : intégrer [NOM DE L'APPLICATION] à Math’as Connect, dans le dépôt Mr-Tat/Mathas-Connect, à partir du main ACTUEL. Ne pas utiliser l'ancien dépôt Mr-Tat/Mathas.

MOTEUR : [URL DU DÉPÔT OU SOURCE À RECHERCHER]. Copier le moteur dans un nouveau répertoire Connect sans modifier son dépôt d'origine. Relever les HEAD et les adaptations.

CONTEXTE : Calculs écrits mélangés est déjà ouvert dans les quatre HUB. Ne pas réinstaller sa migration, rejouer son ouverture, modifier ses XP ou réinitialiser ses résultats pour intégrer la nouvelle application.

Lire d'abord les nouveaux documents :
- docs/PASSAGE_DE_FLAMBEAU_INTEGRATIONS_CONNECT_20261031.md
- docs/GUIDE_INTEGRATION_APPLICATIONS_CONNECT.md
- la fiche spécifique si c'est un calcul écrit.
Ces documents ont été préparés sur la branche docs/bilan-et-guides-integrations-20261031. S'ils ne sont pas encore sur main, les lire depuis cette branche ou le dossier joint, puis travailler sur une branche de code issue du main actuel. Ne pas intégrer d'anciens commits applicatifs pour récupérer seulement de la documentation.

Établir les accès réellement disponibles : Git, API GitHub, Supabase, navigateur. Ne pas demander de PAT ni de SUPABASE_ACCESS_TOKEN comme prérequis général. Si une écriture distante doit passer par une autre conversation, préparer d'abord le code, les tests et un message précis unique.

Définir un nouvel app_key, un contrat adapté à cette application et les acquis qui justifient des XP. Ne pas copier automatiquement les plafonds 474/594 ou les modes des calculs écrits. Un outil sans score peut rester sans XP. Réutiliser l'authentification, les sessions et inscriptions Connect existantes ; Monsieur T reste séparé.

Prévoir états isolés, identité résolue côté serveur, sauvegarde versionnée et atomique, idempotence, file hors ligne bornée, protection du reset et animations après ACK lorsque ces fonctions s'appliquent. Préserver les applications et acquis existants. Éviter les dépendances lourdes et tout nouveau polling Supabase.

Utiliser le laboratoire existant, ses profils connus comme fictifs et son catalogue indépendant. Un UUID ou un appareil approuvé ne remplace pas une vraie session. Ne pas créer de profils supplémentaires si les existants suffisent.

Avancer par lots cohérents, réaliser les vérifications disponibles, corriger et préparer une PR. Ne pas se limiter à un plan ni demander « go » à chaque fichier. Les décisions pédagogiques manquantes ne bloquent pas la copie isolée et les tests locaux.

PÉRIMÈTRE DE PRODUCTION POUR CETTE NOUVELLE APPLICATION : [préparation et PR seulement / pilote précisément autorisé / publication après conditions indiquées]. Respecter ce périmètre et les accords donnés ensuite ; ne pas inventer un nouveau circuit d'approbation.

Ne lire/modifier aucun résultat d'élève réel pour les essais. Distinguer tests locaux, tests hébergés, retour du propriétaire et scénarios non exécutés. Livrer URL de PR, référence exacte, tests et skips, limites, opérations de publication et retour arrière non destructif.
```

## Complément : Multiplication à plusieurs chiffres

```text
APPLICATION SUIVANTE : Multiplication à plusieurs chiffres.

Source déjà repérée : https://github.com/Mr-Tat/Multiplication-multi
HEAD étudié le 31 octobre 2026 : 1b64a0b70632be8e831914437bd95b1d7d319dce. Re-vérifier le HEAD avant la copie.

Lire docs/PROCHAINES_APPLICATIONS_CALCULS_ECRITS_20261031.md. Le repérage confirme :
- appId moteur multiplication-plusieurs-chiffres, V6.0.2 ;
- un seul record classique par niveau : conserver les preuves Connect 4/10/20 séparément ;
- fonction LOCALE setLastWork, sans window.__setLastWork : auditer et instrumenter la vraie fin ;
- challenge HARD 5 calculs neutralisé dans startHard : ne pas inventer ses XP ;
- produits partiels, somme finale, reports haut/latéral et tensFirst à tester au clavier ;
- générateur avec sélection 2..9 mais 0/1 admis selon la position : ne pas supprimer cette règle par erreur.

Une multiplication complète compte comme un exercice, pas chaque ligne partielle. Préserver BigInt et la pédagogie native. Réglages classe/élève, app_key, stockage et XP distincts de Multiplication simple et de Mélange. Proposer le barème pour validation ; ne pas imposer automatiquement 474 ou 594 XP.
```

## Complément : futur Mélange avec addition de plusieurs nombres

```text
FUTURE APPLICATION : nouveau Mélange comprenant soustraction, multiplication à un chiffre et addition de plusieurs nombres.

Ce sera un nouveau jeu indépendant, pas un changement du Mélange déjà ouvert. Le dépôt moteur et l'app_key restent à établir. Ne pas réutiliser melange-calculs-ecrits pour des résultats dont la signification change.

Lire la fiche des prochains calculs écrits. Vérifier que la famille addition utilise réellement plusieurs termes. Définir par famille la difficulté, les méthodes, aides et première tentative. Une addition de plusieurs termes reste un exercice complet.

Si je souhaite reprendre 25/50/100 et les compléments, me faire valider leur sens pour ce nouveau jeu et son plafond. La règle actuelle « trois familles sélectionnées = taux complet même avec un tirage chanceux » est une référence, pas une permission de copier sans audit le contrat serveur.

Réutiliser les mécanismes Connect et les moteurs existants comme références, sans collision de variables, paramètres, clés ou méthodes, et sans modifier les autres applications. Tester chaque famille, les combinaisons disponibles et les transitions entre exercices.
```
