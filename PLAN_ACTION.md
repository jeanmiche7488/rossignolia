# Plan d'Action - Mise en Place Environnement Rossignolia

## 🎯 Objectif
Mettre en place l'environnement de développement complet pour la Phase 1 (Foundations & Admin).

---

## Phase 0 : Préparation (Avant de Coder)

### Étape 0.1 : Vérifications Préalables
- [ ] Node.js 18+ installé
- [ ] Git configuré
- [ ] Compte GitHub créé
- [ ] Compte Supabase créé
- [ ] Clé API Google Gemini obtenue

### Étape 0.2 : Décisions Techniques Finales
- [ ] Valider la stack technique (voir `ANALYSE_STACK_TECHNIQUE.md`)
- [x] Confirmer l'utilisation de searchParams natifs (nuqs reporté en Phase 3)
- [ ] Décider du nom du repo GitHub

---

## Phase 1 : Configuration Git & GitHub (PRIORITÉ - Avant tout)

### Étape 1.1 : Créer le Repo GitHub
- [ ] Aller sur GitHub.com
- [ ] Créer un nouveau repository (nom suggéré : `rossignolia` ou `rossignolia-platform`)
- [ ] **IMPORTANT :** Ne pas initialiser avec README, .gitignore ou license (on le fera manuellement)
- [ ] Noter l'URL du repo (ex: `https://github.com/votre-username/rossignolia.git`)

### Étape 1.2 : Configurer Git pour OneDrive
```bash
# Dans le dossier du projet (OneDrive/Documents/Cursor/Logi/)
git config core.fileMode false
git config core.autocrlf input
git config core.ignorecase true
```

### Étape 1.3 : Initialiser Git et Connecter au Remote
```bash
# Initialiser Git
git init

# Ajouter le remote GitHub
git remote add origin https://github.com/votre-username/rossignolia.git

# Vérifier la connexion
git remote -v
```

### Étape 1.4 : Premier Commit (Fichiers de Base)
```bash
# Ajouter les fichiers de configuration déjà créés
git add .cursorrules
git add .gitignore
git add ANALYSE_STACK_TECHNIQUE.md
git add PLAN_ACTION.md
git add GIT_ONEDRIVE_BEST_PRACTICES.md

# Premier commit
git commit -m "chore: initial project setup - configuration files and documentation"

# Push vers GitHub
git branch -M main
git push -u origin main
```

**✅ Validation :** Vérifier que les fichiers apparaissent sur GitHub

---

## Phase 2 : Initialisation du Projet Next.js (Jour 1 - Matin)

### Étape 2.1 : Créer le Projet Next.js
```bash
# Dans le dossier actuel (OneDrive/Documents/Cursor/Logi/)
npx create-next-app@latest rossignolia --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd rossignolia
```

### Étape 2.2 : Vérifier le .gitignore
- [ ] Vérifier que `.gitignore` contient bien les règles OneDrive (déjà créé à la racine)
- [ ] Si Next.js a créé son propre `.gitignore`, fusionner avec le nôtre

### Étape 2.3 : Premier Commit Next.js
```bash
# Ajouter tous les fichiers Next.js
git add .

# Commit
git commit -m "chore: initialize Next.js project with TypeScript and Tailwind"

# Push
git push origin main
```

### Étape 2.4 : Configurer les Variables d'Environnement
- Créer `.env.local` avec les variables Supabase et Gemini (NE PAS COMMIT)
- Créer `.env.example` (template sans valeurs sensibles)
- Commit `.env.example` uniquement
```bash
git add .env.example
git commit -m "chore: add environment variables template"
git push origin main
```

---

## Phase 3 : Configuration Supabase (Jour 1 - Après-midi)

### Étape 3.1 : Créer le Projet Supabase
- [ ] Créer un nouveau projet sur supabase.com
- [ ] Noter l'URL et les clés API

### Étape 3.2 : Installer les Dépendances Supabase
```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
```

### Étape 3.3 : Créer le Schéma SQL Initial
- [ ] Créer `supabase/migrations/001_initial_schema.sql`
- [ ] Implémenter toutes les tables du PRD :
  - System Layer : `tenants`, `modules`, `tenant_modules`, `profiles`, `system_prompts`
  - Stock Health Module : `analyses`, `stock_entries`, `recommendations`
- [ ] Appliquer les migrations via Supabase Dashboard ou CLI

### Étape 3.4 : Configurer RLS (Row Level Security)
- [ ] Activer RLS sur toutes les tables
- [ ] Créer les policies pour isolation tenant

---

## Phase 4 : Configuration UI & Design System (Jour 2 - Matin)

### Étape 4.1 : Installer Shadcn/UI
```bash
npx shadcn-ui@latest init
# Configurer : TypeScript, Tailwind, App Router, CSS Variables
```

### Étape 4.2 : Installer les Composants de Base
```bash
npx shadcn-ui@latest add button card input label select table dialog sheet
```

### Étape 4.3 : Installer les Dépendances UI
```bash
npm install lucide-react recharts
```

### Étape 4.4 : Configurer le Design System
- [ ] Créer `app/globals.css` avec les couleurs du PRD
- [ ] Configurer Tailwind avec la palette sémantique
- [ ] Ajouter la font Inter (via `next/font`)

---

## Phase 5 : Configuration IA & Validation (Jour 2 - Après-midi)

### Étape 5.1 : Installer les Dépendances IA
```bash
npm install @google/generative-ai zod
# OU
npm install ai @ai-sdk/google (Vercel AI SDK)
```

### Étape 5.2 : Créer les Utilitaires de Validation
- [ ] Créer `lib/validations/` avec les schémas Zod
- [ ] Créer les schémas pour : `analyses`, `stock_entries`, `recommendations`

### Étape 5.3 : Créer le Service Gemini
- [ ] Créer `lib/ai/gemini.ts` avec la configuration déterministe
- [ ] Implémenter les helpers pour les 3 prompts (Mapping, Cleaning, Advisor)

### Étape 5.4 : Initialiser les Prompts dans la DB
- [ ] Créer un script de seed pour `system_prompts`
- [ ] Insérer les 3 prompts du PRD avec leurs configs

---

## Phase 6 : Structure du Code & Architecture (Jour 2 - Fin)

### Étape 6.1 : Créer la Structure de Dossiers
```
app/
  (auth)/
    login/
    signup/
  (dashboard)/
    admin/
    stock/
  api/
    upload/
    process/
lib/
  db/
    supabase.ts
  ai/
    gemini.ts
  validations/
  utils/
modules/
  stock/
    components/
    actions/
    types/
  admin/
    components/
    actions/
```

### Étape 6.2 : Créer les Helpers de Base
- [ ] `lib/db/supabase.ts` : Client Supabase avec tenant isolation
- [ ] `lib/utils/cn.ts` : Utility pour className (Shadcn)
- [ ] `lib/utils/tenant.ts` : Helpers pour gestion tenant

### Étape 6.3 : Configurer les Outils de Dev
```bash
npm install -D prettier eslint-config-next
# Créer .prettierrc et .eslintrc.json
```

---

## Phase 7 : Back-Office Admin (Jour 2 - Suite)

### Étape 7.1 : Créer la Page Admin de Base
- [ ] `app/(dashboard)/admin/page.tsx` : Liste des tenants
- [ ] Protéger avec middleware (vérifier role SUPER_ADMIN)

### Étape 7.2 : Créer le Formulaire de Création Tenant
- [ ] Composant `CreateTenantForm` avec validation Zod
- [ ] Server Action pour créer tenant + générer invite link

### Étape 7.3 : Implémenter le Système d'Invitation
- [ ] Générer un token d'invitation unique
- [ ] Créer la route `/invite/[token]` pour signup

---

## Phase 8 : Authentification (Jour 2 - Fin)

### Étape 8.1 : Configurer Supabase Auth
- [ ] Configurer les providers (Email/Password)
- [ ] Créer les pages login/signup

### Étape 8.2 : Créer le Middleware d'Auth
- [ ] `middleware.ts` : Protection des routes
- [ ] Redirection selon le rôle (SUPER_ADMIN → /admin, USER → /stock)

### Étape 8.3 : Créer le Hook d'Auth
- [ ] `hooks/useAuth.ts` : Hook React pour accès user/tenant

---

## ✅ Checklist de Validation Phase 1

Avant de passer à la Phase 2, vérifier :

- [ ] Projet Next.js fonctionne (`npm run dev`)
- [ ] Supabase connecté (test de connexion)
- [ ] Toutes les tables créées et migrées
- [ ] RLS configuré et testé
- [ ] Shadcn/UI installé et fonctionnel
- [ ] Design system appliqué (couleurs, typo)
- [ ] Gemini configuré (test d'appel API)
- [ ] Prompts insérés en DB
- [ ] Structure de dossiers respectée
- [ ] Admin peut créer un tenant
- [ ] Invitation fonctionne
- [ ] Auth fonctionne (login/signup)
- [ ] Middleware protège les routes

---

## 🚀 Prochaines Étapes (Phase 2)

Une fois la Phase 1 validée, on passera à :
- Upload de fichiers (Drag & Drop)
- Mapping automatique avec Gemini
- Gap Analysis (Feasibility Check)

---

## 📝 Notes Importantes

1. **Git d'abord** : Toujours commencer par créer le repo GitHub et configurer Git correctement
2. **Commits réguliers** : Commit + push après chaque étape fonctionnelle (comme demandé)
3. **Ne pas avancer trop vite** : Valider chaque étape avant de passer à la suivante
4. **Tester l'isolation tenant** : Créer 2 tenants et vérifier qu'ils ne voient pas les données de l'autre
5. **Documenter les décisions** : Noter dans un fichier `DECISIONS.md` les choix techniques
6. **OneDrive** : Vérifier régulièrement `git status` pour détecter les fichiers temporaires
