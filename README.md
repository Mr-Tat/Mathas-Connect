# Math’as Connect

Fondation indépendante et gratuite de Math’as, en cours de construction.

## Répartition claire
- **GitHub Pages** : interface sobre professeur et élève (`index.html`, `style.css`, `app.js`).
- **Supabase Connect** : authentification et données (projet `awmhpfofacaglewammxt`).
- **Applications mathématiques** : leurs propres dépôts et moteurs de jeu, jamais copiés dans le HUB.

Site d’essai : https://mr-tat.github.io/Mathas-Connect/

### Pour publier
Dans **Settings → Pages** : **Deploy from a branch**, `main`, `/ (root)`. L’activation doit être vérifiée sur GitHub avant un essai réel.

### Essai prévu
Professeur : se connecter, classe de démonstration, copier le lien élève, actualiser, autoriser/refuser.
Élève (navigation privée distincte) : prénom + initiale, demander l’accès, montrer les quatre chiffres, puis vérifier l’autorisation.

Les quatre chiffres sont une **vérification visuelle, pas un mot de passe**. Seule l’approbation du professeur donne l’autorisation.

### Sécurité et état
- Aucun secret Supabase n'est publié dans ce dépôt. La clé publishable est publique par nature.
- Aucune table métier n'est ouverte aux rôles des navigateurs.
- L'essai de bout en bout reste à faire avec un vrai navigateur.
- Le service `connect-api` existe sur Supabase mais **son code déployé n'est pas encore versionné ici** : tâche prioritaire avant les prochains développements.
- L'ancienne fonction `connect-ui` sur Supabase n'est **pas** le site officiel et ne doit plus être utilisée.
- Réinitialiser le navigateur ne révoque pas l'appareil côté serveur.
- Ne jamais engager de frais, toucher au Math’as public ni aux jeux existants sans autorisation explicite.

### Règles
Simplicité, extensibilité générique 100+ jeux, permissions minimales, vrai test end-to-end à chaque bloc, aucune fonctionnalité annoncée fonctionnelle sans vérification réelle.
