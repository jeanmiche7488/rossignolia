# Roadmap Frontend - Rossignolia

## 🎯 Vision de la Page d'Accueil / Dashboard

### Page d'Accueil (`/`)
**Objectif :** Vue d'ensemble pour guider l'utilisateur

**Contenu proposé :**
- Hero section avec description de la plateforme
- Liste des modules disponibles (Stock Health, Demand Planning, etc.)
- Call-to-action : "Commencer une analyse"
- Exemples de use cases

### Dashboard Principal (`/dashboard` ou `/stock`)
**Objectif :** Vue opérationnelle pour les utilisateurs connectés

**Sections :**
1. **Métriques en haut** (Cards)
   - Nombre d'analyses en cours
   - Recommandations en attente
   - Valeur totale du stock analysé
   - Économies potentielles identifiées

2. **Analyses récentes** (Table/Liste)
   - Dernières analyses avec statut
   - Actions rapides (voir, télécharger, supprimer)

3. **Recommandations prioritaires** (Cards)
   - Top 5 recommandations par priorité
   - Filtres par type (dormant, slow-moving, etc.)

4. **Actions rapides**
   - Bouton "Nouvelle analyse" (upload fichier)
   - Lien vers historique complet

## 📋 Structure des Pages

```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   └── signup/
│       └── page.tsx
├── (dashboard)/
│   ├── layout.tsx          # Layout avec sidebar/nav
│   ├── page.tsx            # Dashboard principal
│   ├── stock/
│   │   ├── page.tsx        # Liste des analyses
│   │   ├── new/
│   │   │   └── page.tsx    # Upload nouveau fichier
│   │   └── [id]/
│   │       ├── page.tsx    # Détails analyse
│   │       └── recommendations/
│   │           └── page.tsx # Recommandations
│   └── admin/              # Si SUPER_ADMIN
│       └── page.tsx
└── api/
    ├── upload/
    └── process/
```

## 🎨 Design System

**Style :** Linear/Vercel (déjà configuré)
- Clean, dense, gray-scale
- Cards pour les métriques
- Tables pour les listes
- Modals/Dialogs pour les actions

## 🔐 Authentification

**Solution :** Supabase Auth
- Email/Password
- Sessions gérées automatiquement
- RLS pour isolation tenant
- Middleware pour protection des routes

## 📝 Prochaines Étapes

1. ✅ Configurer Supabase Auth
2. ✅ Créer pages login/signup
3. ✅ Créer middleware d'auth
4. ✅ Créer hook useAuth
5. ✅ Créer layout dashboard
6. ✅ Créer page dashboard principal
7. ✅ Créer module Stock (upload, liste, détails)
