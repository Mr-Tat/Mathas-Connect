# Contrat fonctionnel commun des applications Math'as Connect — version 2026-11-09

> **DOCUMENT DE RÉFÉRENCE POUR IA / CHATGPT / CODEX — lire lors de chaque nouvelle intégration.**
>
> **[DÉCISION professeur, 09/11/2026]** Construire un socle d'expérience Connect cohérent d'une application à l'autre ; les capacités `XP`, `trophées`, `scores`, `Objectif record` et `projection` sont déclarées, pas simulées ni imposées quand elles n'ont pas de sens pédagogique. **Mort subite = coefficient de POINTS x2 par rapport à 3 vies**, à difficulté et nombre de bonnes réponses identiques, **et droit XP entier contre demi-droit XP en 3 vies** lorsque ces modes partagent les mêmes jalons. **Ne pas reproduire l'ancien « +20 % de points ».**
>
> **[LIVE vérifié, en lecture seule, 09/11/2026]** Les fonctions SQL et les barèmes réels du projet Supabase **Math'as Connect** (`awmhpfofacaglewammxt`) ont été consultés **sans lire ni modifier d'élèves**, conjointement à `main` GitHub. Les quatre calculs écrits confirmés respectent le x2 de points entre Mort subite et 3 vies et les paliers 20/10 XP. Mélange utilise un autre barème de points, mais un ratio 1.6/0.8 = x2 entre ces modes. Les chiffres de ce document sont des **constats datés**, à revérifier dans les fonctions déployées ; ils ne valent pas preuve de recette navigateur hébergée.
>
> **Précédence :** décision pédagogique récente du professeur > état SQL/Edge et code réellement déployés > ce contrat fonctionnel > guides historiques. Aucune modification SQL/Edge ou de données n'est autorisée par cette documentation seule.

## 0. Mode d'emploi pour une nouvelle conversation d'intégration

1. Lire `AGENTS.md`, `docs/integrations/README.md`, la doctrine `DOCTRINE_EFFICACITE_ET_RETEX_20261104.md`, puis **ce contrat** et `TEMPLATE_FICHE_APPLICATION.md`.
2. Identifier le moteur **original**, sa version et son empreinte ; ne pas réécrire sa pédagogie. Travailler sur **une seule** version scolaire finale, recette en classe TEST fictive au besoin.
3. Déclarer explicitement les capacités de la nouvelle application : `connect=true`, `xp=true|false`, `trophies=true|false`, `score=true|false`, `survival=true|false`, `projection=score|exploit|pourcentage|none`, `teacherSettings=true|false`. Les capacités absentes sont **SANS OBJET**.
4. Définir les événements de réussite, l'unité de score et les paliers XP spécifiques **avant** d'ajouter l'affichage.
5. Câbler un parcours réel complet : HUB → compte approuvé → activité → preuve serveur → reçu → sauvegarde → XP/trophées → HUB professeur → projection si admissible.
6. Tester avec des profils fictifs ; mettre à jour la fiche et le passage de flambeau, puis obtenir l'autorisation d'ouverture des classes. **Une PR fusionnée n'est pas une preuve de déploiement Pages ni Edge.**

## 0 bis. [DÉCISION PROFESSEUR, 09/11/2026] Brainstorm pédagogique obligatoire AVANT XP / trophées / scores

**Point d'arrêt obligatoire pour CHAQUE nouvelle intégration**, après l'audit réel des exercices et au plus tard **avant l'implémentation des règles de récompenses, des formules de points, des jalons, des trophées et de leurs écritures serveur**. L'IA **propose** ; le professeur **arbitre** les trois sujets. Le fait que ce document présente des règles observées sur les anciens jeux **ne vaut jamais autorisation de les recopier**.

**L'IA prépare une proposition structurée, idéalement courte et chiffrée :**

| Sujet | Proposition à soumettre au professeur | Validation explicite attendue |
| --- | --- | --- |
| **XP** | Inventaire des exercices/sections/modes éligibles, niveau de difficulté, objectifs et seuils (80 %, 100 %, nombres de pages...), montants par palier, plafond par niveau et par app, cas de compléments, répétition et reset ; exemples de gains et comparaison aux autres apps. Prévoir aussi **sans XP** si approprié. | Modes concernés, barème, conditions et plafonds acceptés/ajustés, ou **SANS OBJET**. |
| **Trophées** | Tableau des coupes proposées avec `trophy_key`, nom/visuel, critères exacts, difficulté, éventuels ensembles à maîtriser, nombre réel de coupes visibles, état acquis/restant et conservation. Distinguer coupe **liée au score** (accessible aussi en 3 vies) et coupe **réservée à un mode**. | Chaque catégorie, les conditions et le total de coupes acceptés/ajustés, ou **SANS OBJET**. |
| **Scores** | Définir **s'il faut un classement** ; points distincts du taux de réussite et des XP, équivalence 4/10/20 vs défis éventuels, pondération niveau/difficulté/aides, arrondi, records du jour/historiques, top personnel, comparabilité pour projection. Montrer 2–3 exemples concrets. Prévoir **pas de score** pour un outil non compétitif. | Principe, unité, coefficients, comparaisons et projection acceptés/ajustés, ou **SANS OBJET**. |

**Séquence :** (1) auditer le moteur natif et les contraintes Connect, (2) préparer ces propositions **et les présenter réellement au professeur dans la conversation**, (3) échanger/ajuster jusqu'à décision explicite, (4) documenter le tableau retenu sous **[DÉCISION PROFESSEUR]** avec date dans `TEMPLATE_FICHE_APPLICATION.md` et `SUIVI_COURANT.md`, (5) implémenter et tester **seulement** les éléments validés. En l'absence d'accord, annoter **EN ATTENTE D'ARBITRAGE** et **ne pas coder/déployer de nouveaux barèmes XP/trophées/scores** ; les travaux indépendants (audit, sécurisation de l'identité, adaptations non récompensantes) peuvent avancer.

**Cette validation est systématique et non facultative, y compris lorsque les calculs paraissent identiques à une app précédente.** Elle concerne aussi les déblocages pédagogiques, modes 3 vies/Mort subite et effets de projection dès lors qu'ils influencent les trois barèmes. Ne pas multiplier les consultations pendant la phase d'audit si les éléments ne sont pas encore identifiés ; organiser **un véritable brainstorm préalable unique et complet**, puis solliciter seulement les arbitrages restés ouverts.

## 1. Socle attendu dans chaque nouvelle application Connect

| Domaine | Contrat fonctionnel commun | Exception/nuance |
| --- | --- | --- |
| Identité Connect | Session approuvée et classe résolues par serveur, pastille connectée, **avatar entre pastille et nom**, nom du joueur. Monsieur T possède une session joueur distincte de son rôle professeur. | Mode libre séparé, **aucun XP ni écriture Connect**. Ne jamais lire un autre profil. |
| Présence HUB | `app_key` stable, carte et miniature officielle, catégorie, accès classe/réglages, URL finale, retour HUB. | Visibilité HUB ≠ permission du serveur ; la page statique reste accessible par URL. |
| Bandeau proche du titre | Nom de l'application/version, identifiant joueur, **niveau global Connect + barre XP**, bouton **« XP à récupérer »** ouvrant les jalons restants ; retour HUB et plein écran, sans voler la hauteur de jeu. | Distinguer niveau global Connect et difficulté N1/N2/N3 du moteur ; adapter mobile 320 px. |
| Boutons des exercices | Nom/durée/technique, **« Reste N XP »** discret en bas à droite si serveur connaît le droit, trophées à gagner et acquis près de l'exercice/mode, conditions de déblocage intelligibles. | `N=0` seulement si zéro confirmé ; sinon **cacher le chiffre**. Pas de double badge LAB. |
| XP | Jalons pédagogiques propres au jeu, crédités côté serveur, animation **seulement après ACK**. Récapitulatif des droits restants par niveau, technique, sélection. | Une app peut être **sans XP** si elle est avant tout un outil d'enseignement. |
| Trophées | Coupes pour sans-faute, maîtrise de section/ensemble, défis particuliers. Acquis visuellement distingués des non acquis (non acquis nettement plus sombres). | Trophées permanents et **uniques**, pas un compteur de jalons XP. Une app peut n'en proposer aucun. |
| Scores (si pertinents) | Carte **score du jour**, trophées acquis à proximité, **meilleur score historique** et idéalement top 3 historique ; records par difficulté/mode si utile. | Ne pas inventer de score pour une app sans score ; ne pas mélanger des barèmes incomparables. |
| Fin de partie | **Sauvegarder et valider d'abord** l'événement unique, puis seulement déclencher célébrations, changement de menu et invitation projection. Afficher confirmation et détails XP/coupes. | Après interruption : choisir reprise explicite ou abandon propre ; une ancienne partie ne bloque jamais un autre mode. |
| Professeur | Voir résultats par classe, élève, application, mode et niveau, détail des activités ; réglages/autorisation classe/élève si nécessaire ; reset **de cette app uniquement**. | `reset_epoch` / reçus empêchent une ancienne activité de repasser ; trophées/XP non effacés par reset de scores. |
| Projection | Modes **Score du jour** / **Meilleur score** si le jeu a un score, proposition volontaire de résultat, gestion de remise à zéro de la période projetée. | La diffusion est isolée par **classe + app_key + partie consentie** ; mode sans score : exploits ou progression **mesurée**, sinon sans objet. |
| UX + qualité | Design cohérent, retour facile, interface PC/tablette/téléphone, clavier, focus visible, contrastes, animations réduites, pas de chevauchements. | Ne pas casser les mécanismes, méthodes, aides ou contrôles natifs du moteur. |

### Souhait à conserver pour l'interface des scores

Dans une zone proche du tableau des résultats : `Score du jour` (score certifié aujourd'hui, fuseau **Europe/Brussels**), trophées réellement acquis visibles à proximité et `Meilleur score historique` ou podium personnel. Le score projeté peut avoir sa **propre période de classement** remise à zéro par professeur, sans réinitialiser le record personnel, les parties, les XP ni les trophées.

### Trophées de section

Une application peut offrir une **coupe globale** après maîtrise de toutes les activités d'une section (ex. toutes les conversions/variantes requises au seuil convenu). Définir par écrit : `trophy_key`, les prérequis vérifiés, le niveau concerné et ce qu'est une « maîtrise ». Ce n'est **pas** nécessairement le simple fait d'avoir lancé chaque activité. Les trophées appartiennent à `(student_id, app_key, trophy_key)` et ne sont pas regagnés après reset.

## 2. Objectif record — principes fonctionnels pour les jeux adaptés

| | ❤️ 3 vies | 💀 Mort subite |
| --- | --- | --- |
| Fin de partie | **Troisième erreur** complète et validée | **Première erreur** complète et validée |
| Calcul incomplet | Aucun cœur retiré | Ne constitue pas une erreur validée |
| Calcul faux | Une vie au plus par calcul ; pas de correction ni point ; passer au suivant | Arrêt immédiat, pas de point pour le calcul fautif |
| Calcul correct | Ajoute une réussite et des points propres au moteur | Ajoute une réussite et des points propres au moteur |
| Coefficient de **POINTS** à difficulté/bonnes réponses identiques | Référence `x1` | **`x2` par rapport aux 3 vies** |
| Droit **XP** sur jalon commun | **Moitié du droit plein**, via une preuve serveur | **Droit plein**, éventuellement uniquement le complément restant |
| Coupes propres au mode | Aucune coupe **propre aux 3 vies** | Coupes de Mort subite possibles selon les exploits validés |
| Coupes liées au score global | **Oui**, dès que les points certifiés atteignent le seuil | **Oui**, avec les mêmes règles de score global |

**Règles essentielles :** la première erreur en Mort subite termine la partie. En 3 vies, une réponse complète fausse enlève exactement **un** cœur, même si plusieurs chiffres sont faux ; une double validation ne retire pas deux cœurs. Les cœurs apparaissent **uniquement** pendant 3 vies, idéalement entre « Menu » et niveau/progression dans le bandeau de partie. Une erreur arrête la progression de ce calcul : ne pas permettre une correction rétroactive pour transformer un échec en réussite.

**[DÉCISION professeur, 09/11/2026] Trophées et 3 vies :** **c'est la condition d'obtention du trophée qui fait foi, et non le nom du mode**. Une partie 3 vies peut donc débloquer une coupe liée aux **points certifiés** si elle atteint le seuil requis (dans les quatre calculs écrits : 200, 400 ou 600 points), exactement comme toute autre activité admissible. En revanche, les coupes nécessitant **une véritable Mort subite** (ex. 25 réussites sans erreur) ne peuvent pas être obtenues en 3 vies. La mention historique « Sans trophée » sous le bouton 3 vies est ambiguë : elle doit se lire « Aucun trophée propre au mode » et, lors d'une adaptation d'interface, être clarifiée sans supprimer les trophées de score.

**Ne pas confondre `x2 points` et `x2 XP`** : les POINTS sont recalculés à chaque partie et alimentent records/classements ; les XP sont des récompenses de jalons uniques (sauf politique de rejeu professeur). Un joueur peut marquer beaucoup de points en rejouant sans regagner les mêmes XP.

**Garde préalable actuelle des quatre calculs écrits :** avoir obtenu **au moins 80 % sur une série de 10 ou de 20 calculs au même niveau**, avant d'accéder à Objectif record normal. HARD est soumis à ses déblocages propres. Les nouvelles apps doivent définir leurs propres prérequis pédagogiques, pas supposer que 80 % convient toujours.

## 3. [LIVE] Formule des POINTS des quatre calculs écrits

Applications scolaires confirmées : `addition-ecrite-simple`, `addition-ecrite-multiple`, `soustraction-ecrite-simple`, `multiplication-ecrite-simple`.

Le score **brut** = nombre de bonnes réponses validées ; les **points** = score de classement calculé côté serveur.

### Classique (N1/N2/N3, séries 4/10/20)

Formule SQL observée, selon le jeu et la fonction de résultat certifié :

```js
// Référence de lecture, PAS une autorisation de calculer/créditer dans le navigateur.
function classicPoints({ correct, count, level }) {
  if (![4, 10, 20].includes(count) || ![1, 2, 3].includes(level)) throw Error('invalid');
  const lengthWeight = { 4: 4, 10: 3, 20: 2 }[count];
  return Math.round(correct * Math.pow(1.5, level - 1) * lengthWeight);
}
// Au niveau 1 : 4/4 = 16 pts, 10/10 = 30 pts, 20/20 = 40 pts.
```

Les séries courtes donnent **plus de points par réponse**, compensant leur faible nombre de questions. Ce n'est pas une erreur de comparaison : c'est une règle pédagogique actuelle du groupe des quatre calculs écrits.

### 3 vies, Mort subite et variantes HARD

```js
// Miroir explicatif de la fonction SQL LIVE *record_extended_v1.
function survivalPoints({ correct, level, mode }) {
  if (!Number.isInteger(correct) || correct < 0 || ![1,2,3].includes(level)) throw Error('invalid');
  const hard = ['hard-three-lives', 'hard-sudden'].includes(mode);
  const sudden = ['sudden', 'hard-sudden'].includes(mode);
  if (!hard && !['three-lives','sudden'].includes(mode)) throw Error('invalid mode');
  const levelFactor = hard
    ? 3.375 * Math.pow(1.2, level - 1)
    : Math.pow(1.5, level - 1);
  return Math.round(correct * levelFactor * (sudden ? 2 : 1));
}
```

Même niveau et même nombre de bonnes réponses : **le montant avant arrondi est doublé** en Mort subite ; après arrondi, un écart d'un point est possible sur certaines valeurs décimales. HARD emploie une échelle de difficulté différente ; ne pas comparer 3 vies normal avec Mort subite HARD pour déduire le ratio.

Exemples **niveau 1 normal** :

| Activité | Réussites | Points |
| --- | ---: | ---: |
| Série 4 | 4/4 | 16 |
| Série 10 | 10/10 | 30 |
| Série 20 | 20/20 | 40 |
| 3 vies | 10 | 10 |
| Mort subite | 10 | 20 |
| Mort subite | 20 | 40 |

Il y a un **classement unique par application** quand les activités partagent la même unité points. Les records restent individualisés par mode si nécessaire, mais le meilleur personnel/jour utilise les points du même jeu, **jamais une somme de plusieurs applications**.

**Sources [REPO] :**
- `supabase/migrations/20261103120010_school_addition_simple_atomic_record.sql` (classique : `p_score * 1.5^(level-1) * [4|3|2]`)
- `supabase/migrations/20261103130020_school_extended_record.sql` (3 vies/Mort subite/HARD : `* [1|2]`)
- `supabase/migrations/20261104110000_school_multiplication_classic_certified_v1.sql`
- `supabase/migrations/20261104191000_mul_survival_half_xp_verified_projection.sql`
- `apps/objective-record/school-score-view.mjs` (Top du jour, podium, consentement)

**Sources [LIVE] :** fonctions SQL `connect_objective_record_school_record_extended_v1` et `connect_objective_record_school_mul_record_extended_v1`, inspectées en lecture seule le 09/11.

## 4. [LIVE] XP des quatre calculs écrits et relation aux séries classiques

### Activités classiques, **pour chacun des niveaux N1/N2/N3**

| Série | Condition pour jalon | XP |
| --- | --- | ---: |
| 4 calculs | `4/4` | **22** |
| 10 calculs | `>= 8/10` | **30** |
| 10 calculs | bonus `10/10` | **+6** (max **36**) |
| 20 calculs | `>= 16/20` | **50** |
| 20 calculs | bonus `20/20` | **+10** (max **60**) |
| **Total classique par niveau** | tous les jalons | **118 XP** |

### Objectif record normal, **pour le même niveau**

| Palier en bonnes réponses | 3 vies (demi-droit) | Mort subite (droit plein) |
| --- | ---: | ---: |
| `>= 5` | **10 XP** | **20 XP** |
| `>= 10` | **10 XP** | **20 XP** |
| **Total maximum du groupe partagé** | **20 XP** | **40 XP** |

`3 vies` puis `Mort subite` sur un **même palier** : 10 XP puis **10 XP de complément**, pas 10+20. `Mort subite` puis `3 vies` : 20 XP puis **0 XP**. Faire 100 parties de 3 vies ne multiplie pas le même droit.

**HARD Objectif record** : même montant (demi / plein), mais paliers **3 et 7 réussites** ; droits distincts du groupe normal. Le total théorique pour les quatre jeux est **118 classique + 40 normal + 40 HARD = 198 XP par niveau**, soit **594 XP sur trois niveaux** avant exceptions historiques/rejeu. Ce plafond reflète les règles déployées au 09/11, **pas un quota universel de toute future application**.

Exemple de logique serveur **normative**, exprimée en pseudo-code (les fonctions SQL réellement déployées et les registres de jalons font foi) :

```ts
type SurvivalMode = 'three-lives' | 'sudden';
type Right = { appKey: string; level: number; track: 'normal'|'hard'; threshold: number };
// Un droit est scindé en moitié et complément ; le serveur mémorise chaque crédit.
function remainingXp(fullXp: number, alreadyCreditedOnThisRight: number, mode: SurvivalMode) {
  if (fullXp < 0 || alreadyCreditedOnThisRight < 0) throw Error('invalid');
  const ceiling = mode === 'sudden' ? fullXp : Math.floor(fullXp / 2);
  return Math.max(0, ceiling - alreadyCreditedOnThisRight);
}
// right = 20 XP, 3 vies reçu -> 10, puis Mort subite -> complément 10.
// NOTE : adapter les identifiants de jalons et les règles de rejeu du vrai serveur.
```

Pour afficher `Reste N XP`, ne **jamais** calculer les droits à partir du seul score local, de `localStorage`, de l'historique graphique ou de la formule ci-dessus : lire **la projection autorisée du serveur**, au niveau et pour les options sélectionnées. `0` signifie *aucun droit restant confirmé*, pas *aucune partie possible*. Un refus réseau ou une lecture inconnue n'est **pas** `0`.

**Sources [LIVE] :** `connect_xp_award_rules` consultée le 09/11 : `classic:4:perfect=22`, `classic:10:pass=30`, `classic:10:bonus=6`, `classic:20:pass=50`, `classic:20:bonus=10`; `sudden:5/10=20`, `hard:3/7=20`, `half=10`, `complement=10` pour les quatre `app_key`.
**Sources [REPO] :** `supabase/migrations/20261106013000_written_survival_double_xp.sql`, `supabase/migrations/20261104143000_school_three_lives_half_xp.sql`, `supabase/migrations/20261106012000_written_record_80_percent_all_classes_v1.sql`.

## 5. [LIVE] Le jeu Mélange : même philosophie, **formules différentes**

`melange-calculs-ecrits` a une logique de points propre, déjà certifiée en SQL dans `supabase/migrations/20261106083400_mixed_certified_projection_game_points.sql`. Il n'emploie **pas** la formule `1.5^(niveau-1)` des quatre calculs.

```js
// Référence documentaire du calcul des points Mélange, SQL source d'autorité.
function mixedPoints({correct, level, mode, count}) {
  const isHard = mode === 'hard' || mode === 'hard-three-lives';
  const isSurvival = ['hard','hard-three-lives','sudden','three-lives'].includes(mode);
  const weighted = isSurvival
    ? Array.from({length:correct},(_,i)=>Math.min(4,Math.pow(1.035,i)))
       .reduce((a,b)=>a+b,0)
    : correct;
  const levelFactor = isHard ? [1.6,1.8,2][level-1] : [1,1.2,1.4][level-1];
  const modeFactor = mode === 'sudden' || mode === 'hard' ? 1.6
    : mode === 'three-lives' || mode === 'hard-three-lives' ? 0.8
    : count === 20 ? 1.6 : count === 10 ? 1.3 : 1;
  return Math.round(5 * weighted * levelFactor * modeFactor);
}
// 1.6 / 0.8 = x2 avant arrondi, pour les modes de survie à même niveau.
```

La longueur `4/10/20`, le niveau, **la sélection exacte des opérations** `add/sub/mul`, les exercices effectivement parcourus et les aides peuvent changer l'éligibilité XP. Les valeurs de droits se calculent dans les fonctions Mélange (`connect_mixed_xp_*`) : ne **jamais** y copier `22/36/60` du Classique des quatre jeux ; son barème `classic:4:perfect=28`, `classic:10:pass=38`, `classic:10:bonus=8`, `classic:20:pass=63`, `classic:20:bonus=13` est différent et peut être fractionné selon les opérations. Le droit plein des jalons normaux `sudden:5/10` et HARD `hard:3/7` est de **20 XP** au 09/11, mais les compléments pour opérations/modes exigent la lecture de **son SQL**, pas une règle de multiplication universelle.

**Statut de publication distinct :** Mélange peut être en **TEST** et non dans toutes les classes scolaires ; n'en déduire aucune ouverture des HUB normaux. Vérifier catalogue et autorisation LIVE avant usage.

## 6. Contrats serveur, sécurité et persistance

La représentation exacte varie par moteur ; ceci est un **exemple pédagogique**, pas un endpoint à installer tel quel :

```ts
type CompletionEvent = {
  schemaVersion: number;
  appKey: string;          // identifiant unique stable, non celui d'un autre jeu
  eventId: string;         // UUID stable pour réessai/réception idempotente
  expectedStudentId: string; // revalidé côté serveur, ne fait pas foi seul
  classId: string;
  expectedRevision: number;
  expectedResetEpoch: number;
  mode: string;            // classic | three-lives | sudden | hard-...
  level: number;
  score: number;           // bonnes réponses ; pas points ni XP fournis par le client
  total?: number | null;
  proof: unknown;         // questions, réponses/évaluations, options prises au début
};
```

Invariants **obligatoires** :
- **Identité résolue par serveur** : JWT + appareil approuvé + fiche élève active + classe + permission de cette application ; la simple URL du HUB ou le `studentId` du navigateur ne donne aucun droit.
- **Fin prouvée, unique, atomique** : vérifier la réussite et les bornes avant attribution ; mise à jour état + événement certifié + reçus + jalons XP + trophées dans **une transaction**. Réessai du même `eventId` = pas de double crédit.
- **Ordre UI** : terminer le calcul → validation/stockage fiable → recevoir ACK ou garder une file fiable → seulement alors considérer le score acquis, actualiser XP et afficher célébration/menus/consentement. Ne jamais laisser une animation bloquer le déclenchement de la sauvegarde.
- **Hors ligne/réseau** : queue bornée par identité et époque, réémission du **même événement**, gestion conflits de révision / reset ; ne pas certifier avec la seule sauvegarde locale. Prévoir reprise **ou abandon explicite** d'une activité inachevée, sans immobiliser les autres modes.
- **Séparation** : `app_key`, classe, élève, période, état libre/Connect, essais de démonstration, résultats prof. Pas de fuite entre appareils/profils.
- **XP** : journal de crédits et récompenses serveur ; reset de parcours et `repeatXp` sur autorisation séparée ; crédit acquis non effacé par un reset habituel.
- **Trophées** : registre permanent `connect_trophy_achievements` (`student_id + app_key + trophy_key`) ; pas de double animation « première obtention » après restauration.
- **Projection** : événement validé dans `connect_projection_score_events` + consentement `connect_projection_score_consents` propre au score et à sa classe. Un clic « Non merci » ne modifie ni partie ni XP. La projection lit les **points de jeu** et non les XP ni le simple nombre brut de bonnes réponses.
- **Cas inconnus** : API indisponible ≠ `0 XP` ni `0 trophée`. Utiliser `—` ou masquer l'indicateur.

Sources : `docs/integrations/REFERENCE_TECHNIQUE.md`, `docs/integrations/CONTRAT_COMMUN_SCORES_XP_TROPHEES.md`, `supabase/functions/connect-results/index.ts`, `supabase/functions/connect-projection-v2/daily-scores.mjs`, `apps/objective-record/student-host-contract.mjs`.

## 7. Points de vigilance réels et dette documentaire détectée le 09/11

1. **Ancien « +20 % » encore présent dans certains documents et dans une référence de code :** `docs/integrations/PATRON_REUTILISABLE_OBJECTIF_RECORD_3_VIES_XP_20261101.md` et `apps/objective-record/contract.mjs` (`referenceRankingPoints` contient `score*1.2`). Cette référence générique est **obsolète comme description du classement certifié des quatre jeux**. La source LIVE est le SQL `*2`, et Mélange utilise `1.6` vs `0.8`. **Ne pas corriger aveuglément un moteur/client sans vérifier les usages**, mais ne plus transmettre `+20%` comme règle commune.
2. **[DÉCISION professeur, 09/11/2026] Une partie 3 vies peut débloquer des coupes liées au score, mais pas les coupes réservées à Mort subite.** C'est le **critère propre au trophée** qui détermine l'obtention, pas l'exclusion globale du mode. Le SQL LIVE des quatre jeux reflète déjà cette règle : `scoreOne` aux seuils de `v_points >= 200/400/600`, **sans filtrer `three-lives`** ; les coupes `sudden` (et les distinctions HARD Mort subite) exigent réellement le mode Mort subite correspondant. **Ne pas supprimer l'attribution de `scoreOne` en 3 vies.** Le texte historique « Sans trophée » est trompeur : il signifie seulement **« Pas de trophée propre aux 3 vies »**. Une éventuelle correction du libellé d'interface doit rester un chantier séparé, sans changement des règles de récompenses.
3. **Mélange** : ne pas copier les coefficients classique des quatre calculs ; logique exacte `add/sub/mul` et `connect_mixed_xp_*`.
4. **Trophées visibles vs flags internes** : les deux additions exposent **20 vraies coupes visuelles**, pas 25 indicateurs techniques ; relire le moteur pour chaque app.
5. **Recette et travaux ouverts** : `docs/integrations/SUIVI_DECISIONS_OUVERTES_20261107.md` distingue les corrections fusionnées des vraies sessions encore à tester ; relire son état réel à chaque reprise. Un test CI avec Auth simulée ne prouve pas une session élève authentifiée sur Pages.
6. **Projection** : ne pas confondre records personnels, classement « du jour » (date Bruxelles), période « meilleur score » réinitialisable du tableau, et « envoyer ce score » soumis à accord. Les souhaits d'interface doivent être vérifiés sur la version LIVE avant d'être déclarés livrés.
7. **Entraînement/techniques** : ne publier dans le même classement que les modes dont les **points sont comparables**, et conserver le niveau/méthode/aide dans la preuve. Certains entraînements peuvent générer un résultat pédagogique mais **pas** de score de compétition.

## 8. Checklist de recette à recopier dans toute nouvelle PR

- [ ] Profil fictif approuvé, bascule enseignant/Monsieur T/élève, avatar + nom + niveau + barre, mode libre réellement isolé.
- [ ] Carte HUB, vignette approuvée, permission d'accès par classe et retour HUB ; édition de réglages professeur si pertinents.
- [ ] Exercice admissible : indication `Reste N XP` réellement issue serveur ; changement de niveau/options ; `0` fiable et indisponibilité non transformée en `0`.
- [ ] Trophées accessibles/en cours/acquis, trophées de maîtrise de section, compteurs corrects, restauration après reset de scores. **Tester qu'un score certifié en 3 vies peut attribuer une coupe `scoreOne`, mais ne débloque jamais une coupe réservée à Mort subite.**
- [ ] Séries classiques réussies/ratées aux seuils ; 3 vies : 0/1/2/3 erreurs, réponse incomplète, double-clic, deux calculs simultanés ; Mort subite : première erreur.
- [ ] Scores : **même nombre de bonnes réponses au même niveau → Mort subite x2 en valeur avant arrondi vs 3 vies**, normal et HARD ; points classiques cohérents avec leurs coefficients.
- [ ] XP : palier moitié puis complément, Mort subite puis 3 vies = aucun nouveau crédit ; niveaux et groupes séparés ; rejouabilité `repeatXp` respectée.
- [ ] Enregistrement **avant** animations, même `eventId` en réessai, arrêt / reprise / abandon non bloquants ; reconnexion, autre appareil, réseau indisponible et reset d'une seule app.
- [ ] Score du jour, record historique, top 3 et trophées proches ; aucun score local non validé substitué au score Connect.
- [ ] Projection : refus ne publie rien, accord publie un événement certifié seulement, classement isolé par app/classe, reinitialisation projection non destructive.
- [ ] PC scolaire, clavier, écran 320 px, animations réduites, absence de doublon d'UI, tests automatiques **et** recette navigateur hébergée avec profil fictif.
- [ ] Un seul candidat / une PR ciblée ; documenter SHA `main`, Pages, version Edge/SQL s'ils changent et feu vert d'ouverture. Pas de données élèves réels dans les essais.

## 9. Lecture croisée / références

- [Guide permanent](README.md) ; [fiche par application](TEMPLATE_FICHE_APPLICATION.md) ; [doctrine générale](DOCTRINE_EFFICACITE_ET_RETEX_20261104.md).
- [Contrat scores, XP, trophées permanents](CONTRAT_COMMUN_SCORES_XP_TROPHEES.md) ; [référence serveur](REFERENCE_TECHNIQUE.md).
- [RETEX UI additions](RETEX_ADDITIONS_UI_20261103.md) ; [décisions ouvertes](SUIVI_DECISIONS_OUVERTES_20261107.md).
- [Ancien patron Objectif record — **historique pour le bonus +20 %**, NE PAS copier ce coefficient](PATRON_REUTILISABLE_OBJECTIF_RECORD_3_VIES_XP_20261101.md).

**Pour les prochaines IA :** Réutiliser le **système** (identité, preuve, XP, trophées, score, projection, rendu) et les **principes** (entraîner avec des points comparables, survie x2 points, XP demi/plein par jalon), **pas les chiffres** d'une application sans validation de la difficulté et du SQL du nouveau jeu. En cas de doute, exposer clairement l'incertitude et faire valider les nouveaux seuils pédagogiques au professeur.
