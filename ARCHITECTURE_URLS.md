# Architecture des URLs - Rossignolia

## 🎯 Principe : URL Unique avec Redirection Automatique

**Une seule URL de base** : `https://votre-domaine.com`

Le système redirige automatiquement selon le rôle de l'utilisateur connecté.

## 📋 Flux d'Authentification

### 1. Page de Login Unique
**URL :** `/login`

- Tous les utilisateurs (SUPER_ADMIN et USER) se connectent sur la même page
- Un seul formulaire de login
- Le système détecte automatiquement le rôle après connexion

### 2. Redirection Automatique selon le Rôle

Après connexion, le middleware redirige automatiquement :

- **SUPER_ADMIN** → `/admin` (interface d'administration)
- **USER** → `/stock` (interface utilisateur)

### 3. URLs par Rôle

#### Environnement Admin (SUPER_ADMIN)
- `/admin` - Dashboard admin (liste des tenants)
- `/admin/tenants` - Gestion des tenants
- `/admin/tenants/new` - Créer un nouveau tenant
- `/admin/tenants/[id]` - Détails d'un tenant
- `/admin/tenants/[id]/users` - Gérer les utilisateurs d'un tenant

#### Environnement Utilisateur (USER)
- `/stock` - Dashboard utilisateur (liste des analyses)
- `/stock/new` - Créer une nouvelle analyse
- `/stock/[id]` - Détails d'une analyse
- `/stock/[id]/recommendations` - Recommandations d'une analyse

## 🔐 Isolation par Tenant

### Comment ça fonctionne ?

1. **Un utilisateur USER appartient à un tenant spécifique**
   - Son `tenant_id` est défini dans la table `profiles`
   - Il ne voit que les données de son tenant

2. **Même URL, données différentes**
   - Tous les utilisateurs USER accèdent à `/stock`
   - Mais chacun voit uniquement les analyses de son tenant
   - L'isolation est gérée par RLS (Row Level Security) dans Supabase

3. **Exemple concret :**
   - User A (tenant_id: `abc123`) → `/stock` → Voit analyses du tenant `abc123`
   - User B (tenant_id: `xyz789`) → `/stock` → Voit analyses du tenant `xyz789`
   - Même URL, données isolées automatiquement

## 🚫 Pas d'URL par Tenant

**Nous n'utilisons PAS :**
- ❌ `/tenant-abc123/stock`
- ❌ `/tenant-xyz789/stock`
- ❌ `/client-a/stock`

**Pourquoi ?**
- Plus simple pour les utilisateurs (une seule URL à retenir)
- L'isolation est gérée automatiquement par le backend
- Plus sécurisé (pas de risque d'accès par URL)

## 📝 Résumé

| Type d'utilisateur | URL de connexion | Redirection après login | URLs accessibles |
|-------------------|------------------|------------------------|------------------|
| **SUPER_ADMIN** | `/login` | `/admin` | `/admin/*` |
| **USER** | `/login` | `/stock` | `/stock/*` |

**Isolation :** Automatique via `tenant_id` dans la base de données et RLS.

## 🔄 Workflow Complet

1. Utilisateur va sur `https://votre-domaine.com`
2. Redirection automatique vers `/login` (si non connecté)
3. Saisit email/mot de passe
4. Système détecte le rôle (SUPER_ADMIN ou USER)
5. Redirection automatique :
   - SUPER_ADMIN → `/admin`
   - USER → `/stock`
6. L'utilisateur voit uniquement les données de son tenant (isolation automatique)
