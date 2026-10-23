# Service `connect-api`

Source déployée côté Supabase. Les secrets restent dans les variables d'environnement du service.

- `student-me` : renvoie l'identité de l'élève à partir du jeton utilisateur contrôlé par Supabase Auth et de l'appareil approuvé.
- `teacher-devices` : liste les appareils liés à la classe autorisée.
- `teacher-device-decision` : révoque immédiatement un appareil, y compris ses lancements.
- `teacher-review-join` : accepte une demande en créant un élève ou en reliant un appareil à un élève existant.

Règle : les 4 chiffres ne donnent jamais accès par eux-mêmes. Les actions de gestion requièrent un enseignant avec permission `can_manage`. Aucun secret ne doit figurer dans le dépôt public.
