# Rossignolia — Plateforme SaaS d'Intelligence Logistique

**Version :** 12.0 (FINAL MASTER - White Box, Multi-Module, Strict Rules)

## 🎯 Vision

Plateforme B2B unifiée d'audit logistique. L'objectif : passer de la **Donnée Brute** à l'**Action Financière**.

## 🏗️ Architecture

- **Multi-Tenant** : Isolation complète des données par tenant
- **Modulaire** : Architecture prête pour futurs modules (Demand Planning, Transport, Supplier Risk)
- **White Box** : Transparence totale - chaque analyse IA inclut le code Python généré

## 📋 Modules (Roadmap)

1. **Stock Health (MVP Actuel)** : Audit dormant, rotation, couverture
2. **Demand Planning (Futur)** : Prévisions de ventes, saisonnalité
3. **Transport Control (Futur)** : Analyse des coûts de fret, optimisation chargement
4. **Supplier Risk (Futur)** : Analyse fiabilité fournisseurs, délais

## 🛠️ Stack Technique

- **Frontend :** Next.js 14+ (App Router), TypeScript, TailwindCSS
- **UI :** Shadcn/UI, Lucide React, Recharts
- **Backend :** Server Actions + API Routes, Node.js
- **Database :** Supabase (PostgreSQL)
- **AI :** Google Gemini 1.5 Pro
- **Validation :** Zod
- **State Management :** Next.js searchParams natifs

## 🚀 Démarrage Rapide

### Prérequis

- Node.js 18+
- Compte Supabase
- Clé API Google Gemini

### Installation

```bash
# Cloner le repo
git clone https://github.com/votre-username/rossignolia.git
cd rossignolia

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env.local
# Éditer .env.local avec vos clés

# Lancer le serveur de développement
npm run dev
```

## 📚 Documentation

- [Plan d'Action](./PLAN_ACTION.md) : Roadmap détaillée d'implémentation
- [Analyse Stack Technique](./ANALYSE_STACK_TECHNIQUE.md) : Justification des choix techniques
- [Best Practices Git + OneDrive](./GIT_ONEDRIVE_BEST_PRACTICES.md) : Guide pour éviter les problèmes de synchronisation
- [Règles Cursor](./.cursorrules) : Constitution du projet pour l'IA

## 🔒 Sécurité

- **Isolation Tenant :** Toutes les requêtes DB incluent `where tenant_id = ...`
- **Validation :** Tous les inputs validés avec Zod
- **RLS :** Row Level Security activé sur toutes les tables Supabase

## 📝 Conventions

- **Commits :** Conventionnelle (feat, fix, chore, docs, refactor, test)
- **Branches :** `main` (production), `dev` (développement)
- **Code Style :** Prettier + ESLint

## 🤝 Contribution

Ce projet suit strictement les règles définies dans `.cursorrules`. Toute modification doit respecter :
- Isolation des modules
- Sécurité multi-tenant
- Transparence White Box
- Anti-régression (Zero-Side-Effect Policy)

---

**Statut :** 🚧 En développement (Phase 1 : Foundations & Admin)
