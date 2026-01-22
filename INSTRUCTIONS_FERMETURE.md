# Instructions de Fermeture - Rossignolia

## 🔒 Fermeture Correcte du Projet

### 1. Arrêter le Serveur de Développement
Si le serveur Next.js est en cours d'exécution :
- Dans le terminal, appuyez sur `Ctrl + C` pour arrêter le serveur
- Attendez que le processus se termine complètement

### 2. Vérifier l'État Git
```bash
git status
```
- Vérifiez qu'il n'y a pas de modifications non commitées
- Si des modifications sont présentes, décidez si vous voulez les committer ou les ignorer

### 3. Sauvegarder le Travail (si nécessaire)
Si vous avez des modifications non commitées que vous voulez garder :
```bash
git add .
git commit -m "WIP: travail en cours"
git push origin main
```

### 4. Fermer les Fichiers
- Fermez tous les fichiers ouverts dans votre éditeur
- Fermez les onglets du navigateur liés au projet (localhost:3000)

### 5. Fermer les Terminaux
- Fermez tous les terminaux PowerShell/CMD ouverts pour ce projet

## 🚀 Reprendre le Travail Demain

### 1. Ouvrir le Projet
- Ouvrez Cursor/VS Code dans le dossier `C:\Users\pierr\Documents\Cursor\Logi`

### 2. Vérifier l'État
```bash
git status
git pull origin main  # Au cas où il y aurait des mises à jour
```

### 3. Configurer les Variables d'Environnement
Vérifiez que `.env.local` contient bien :
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **À AJOUTER**
- `GOOGLE_GEMINI_API_KEY` (quand disponible)

### 4. Installer les Dépendances (si nécessaire)
```bash
npm install
```

### 5. Démarrer le Serveur
```bash
npm run dev
```

### 6. Consulter l'État du Projet
Lisez le fichier `ETAT_PROJET.md` pour savoir où vous en étiez et quelles sont les prochaines étapes.

## 📋 Checklist de Reprise

- [ ] Projet ouvert dans l'éditeur
- [ ] `git pull` effectué
- [ ] `.env.local` vérifié et complété
- [ ] `npm install` exécuté (si nécessaire)
- [ ] Serveur de développement démarré (`npm run dev`)
- [ ] `ETAT_PROJET.md` consulté
- [ ] Prêt à continuer avec la Phase 5

## 🔗 Liens Utiles

- **GitHub Repo :** https://github.com/jeanmiche7488/rossignolia
- **Supabase Dashboard :** https://supabase.com/dashboard/project/fgtmekgftjqszfozsmgx
- **Plan d'Action :** `PLAN_ACTION.md`
- **État du Projet :** `ETAT_PROJET.md`
