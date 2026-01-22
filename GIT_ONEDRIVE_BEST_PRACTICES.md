# Best Practices Git + OneDrive

## ⚠️ Problèmes Courants OneDrive + Git

1. **Conflits de synchronisation** : OneDrive peut corrompre les fichiers `.git/index` et `.git/config`
2. **Fichiers temporaires** : OneDrive crée des fichiers `~$*` et `.tmp` qui polluent le repo
3. **Lock files** : Les fichiers de verrouillage peuvent causer des erreurs
4. **Performance** : OneDrive indexe tous les fichiers, ralentissant Git

---

## ✅ Solutions Recommandées

### 1. **.gitignore Robuste**

Le `.gitignore` doit exclure :
- Tous les fichiers temporaires OneDrive (`~$*`, `.tmp`)
- Les fichiers de lock OneDrive
- Les fichiers de conflit OneDrive
- Les dossiers de synchronisation OneDrive

### 2. **Configuration Git pour OneDrive**

```bash
# Désactiver le filemode (OneDrive peut changer les permissions)
git config core.fileMode false

# Utiliser LF au lieu de CRLF (évite les problèmes Windows/OneDrive)
git config core.autocrlf input

# Ignorer les changements de casse (OneDrive peut modifier)
git config core.ignorecase true
```

### 3. **Structure du Projet**

**✅ BON :** Projet dans un sous-dossier OneDrive
```
OneDrive/Documents/Cursor/Logi/rossignolia/
```

**❌ ÉVITER :** Projet à la racine OneDrive
```
OneDrive/rossignolia/  # Peut causer des problèmes
```

### 4. **Exclure le Dossier .git de OneDrive (Optionnel mais Recommandé)**

Si possible, exclure le dossier `.git` de la synchronisation OneDrive :
- Clic droit sur `.git` → Propriétés → Avancé → Décocher "Archiver ce dossier"

**Note :** Le code source sera synchronisé, mais pas l'historique Git (ce qui est acceptable).

---

## 📋 Checklist Avant Premier Commit

- [ ] `.gitignore` créé avec règles OneDrive
- [ ] Configuration Git appliquée (`core.fileMode`, `core.autocrlf`)
- [ ] Repo GitHub créé (vide ou avec README)
- [ ] Remote configuré
- [ ] Premier commit prêt

---

## 🔄 Workflow Recommandé

### Commits Réguliers (Comme demandé)

```bash
# Après chaque fonctionnalité complète
git add .
git commit -m "feat: description claire de la feature"
git push origin main

# Après chaque étape du plan
git add .
git commit -m "chore: étape X.Y complétée - description"
git push origin main
```

### Messages de Commit (Convention)

- `feat:` Nouvelle fonctionnalité
- `fix:` Correction de bug
- `chore:` Tâche de maintenance (setup, config)
- `docs:` Documentation
- `refactor:` Refactoring sans changement fonctionnel
- `test:` Ajout/modification de tests

---

## 🚨 En Cas de Problème

### Si OneDrive corrompt `.git/index` :

```bash
# Réparer l'index
rm .git/index
git reset
```

### Si conflits de synchronisation :

```bash
# Vérifier l'état
git status

# Nettoyer les fichiers temporaires
git clean -fd

# Forcer la synchronisation
git fetch origin
git reset --hard origin/main
```

---

## 📝 Notes Importantes

1. **Toujours commit + push régulièrement** : Évite de perdre du travail si problème OneDrive
2. **Ne jamais modifier `.git/config` manuellement** : Laisser Git le gérer
3. **Vérifier `git status` avant chaque commit** : Détecter les fichiers indésirables
4. **Utiliser des branches** : `main` pour production, `dev` pour développement
