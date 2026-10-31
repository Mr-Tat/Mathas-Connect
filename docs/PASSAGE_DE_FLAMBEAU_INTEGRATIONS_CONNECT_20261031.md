# Lire d'abord — prochaines intégrations Math’as Connect

Établi le **31 octobre 2026**, à partir du main applicatif `4aea80e3db824e74c2e13f529b14c871e8435269`, des essais de cette intégration et du compte rendu de publication fourni par le propriétaire. Relever le nouveau HEAD au démarrage de toute reprise.

## État à conserver

**Calculs écrits mélangés est publié et ouvert dans les quatre HUB.** Le moteur original reste dans `Mr-Tat/Melange-calculs-ecrits-1` ; la copie Connect est `apps/calculs-melanges/`, sous l'app_key `melange-calculs-ecrits`.

- Migration Mélange `20261031073637` installée ; `connect-results` v40 et `connect-catalog` v2 rapportés déployés.
- PR 34 : intégration ; PR 41 : correction du tableau HARD ; PR 42 : contrôles publics des quatre catalogues.
- Quatre espaces : Observation, Phase 1, Phase 2, 2 ECO. Mélange visible, activé, sans mise en vedette forcée.
- Barème de base **594 XP** : une opération sélectionnée au départ donne 25 %, deux 50 %, trois 100 %, avec compléments uniques. Ce choix est propre à Mélange.
- Le propriétaire a observé **7 → 14 → 28 XP** sur le jeu hébergé et la conservation après reconnexion. Les autres contrôles ont reçu un retour global positif ; tous n'ont pas une preuve navigateur individuelle détaillée.
- Ne pas réinstaller Mélange, rejouer ses migrations, réexécuter son ouverture ni réinitialiser les vrais élèves pour commencer une autre intégration.

Les autorisations de publication accordées pour Mélange ne constituent pas une autorisation implicite de publier n'importe quelle prochaine application. Suivre le périmètre et les autorisations de la nouvelle demande ; ne pas redemander les accords déjà donnés dans cette nouvelle session.

## Les quatre documents utiles

| Besoin | Document |
| --- | --- |
| Comprendre ce qui a été livré et les difficultés réelles | [Bilan Mélange](BILAN_CALCULS_MELANGES_20261031.md) |
| Intégrer n'importe quelle nouvelle application | [Guide général](GUIDE_INTEGRATION_APPLICATIONS_CONNECT.md) |
| Préparer Multiplication à plusieurs chiffres puis le futur Mélange | [Prochains calculs écrits](PROCHAINES_APPLICATIONS_CALCULS_ECRITS_20261031.md) |
| Démarrer une nouvelle discussion avec un mandat clair | [Messages prêts à copier](PROMPTS_PROCHAINES_INTEGRATIONS_CONNECT.md) |

Lire le guide général et la fiche correspondant à l'application ; le bilan complet peut ensuite servir de référence. Les documents datés de préparation restent utiles, mais leurs indications « non déployé », « désactivé », 500/750 XP ou HARD 5 calculs ne décrivent pas nécessairement le HEAD actuel.

## Laboratoire déjà disponible

Le laboratoire est sur <https://mr-tat.github.io/Mathas-Connect/laboratoire.html>, depuis **Espace professeur → Gestion → Laboratoire de test**.

Classe existante : **TEST 2026-2027 / Classe démo - TEST**, UUID `4bf3400d-a315-4ea4-a2f3-afaca24dc9b9`. Le propriétaire a confirmé que ses trois profils étaient fictifs pendant cette intégration. Réutiliser ces comptes, vérifier le compte effectivement sélectionné et ne pas supposer que cette confirmation couvrirait de futurs profils ajoutés.

Le catalogue du laboratoire est indépendant des quatre catalogues ordinaires. Les cases **Afficher** ne doivent pas ouvrir les cartes aux classes habituelles. Un badge **Connecté** ne connaît que la session de son navigateur, pas celle d'une fenêtre privée ou d'un autre appareil.

## Deux points à traiter tôt dans la prochaine discussion

1. **Accès disponibles.** Tester séparément Git lecture/push, API GitHub/PR, Supabase métadonnées/écriture et navigateur authentifié. Ne pas demander `SUPABASE_ACCESS_TOKEN` comme prérequis général. Dans cette session, Git fonctionnait, mais les écritures Supabase et la création de PR passaient par une autre conversation connectée.
2. **Piège CI restant au main de référence.** `tests/soustraction-live-readonly.mjs` exige encore un ancien libellé statique et Soustraction masquée partout. Un correctif limité aux tests a été préparé sur `fix/soustraction-live-smoke-20261031`, commit `2dc4ee3a5edef5f7bb265846bcdf9e93a7e4d59d`, avec contrôle réussi. Ce commit n'est pas ancêtre de `4aea80e`. Examiner son diff sur le nouveau main avant de le reprendre ; ne pas modifier Soustraction ou les réglages du professeur pour satisfaire ce vieux test.

Depuis les PR du laboratoire et des catalogues, certains fichiers `*.test.mjs` appellent réellement les endpoints publics. **Le glob `node --test tests/*.test.mjs` n'est plus une garantie de tests sans réseau.** Identifier les suites locales et les contrôles hébergés avant de lancer les commandes.
