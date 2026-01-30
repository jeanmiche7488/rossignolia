# Dépannage : le push Git ne fonctionne pas

## État actuel

- **Le commit local est bien créé** : ta branche est « 1 commit ahead of origin/main » (commit `d661510`).
- **Ce qui bloque** : le **push** vers GitHub (envoi du commit au serveur).

## À faire en premier : voir l’erreur réelle

Ouvre un **terminal classique** (PowerShell ou CMD) **en dehors de Cursor**, va dans le projet puis lance :

```powershell
cd "c:\Users\pierr\Documents\Cursor\Logi"
git push origin main
```

Note **exactement** le message d’erreur affiché. Les causes fréquentes sont ci‑dessous.

---

## Crash « git-remote-https.exe » (mémoire 0x00000000)

Si une **fenêtre d’erreur Windows** s’affiche : *« L’instruction à 0x... emploie l’adresse mémoire 0x00000000. L’état de la mémoire ne peut pas être read »* sur **git-remote-https.exe**, ce n’est **pas** un problème de token. C’est un **plantage** du programme Git qui gère le HTTPS.

**Solution recommandée : passer en SSH** (on n’utilise plus git-remote-https.exe) :

1. **Vérifier si tu as déjà une clé SSH** (PowerShell) :
   ```powershell
   Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub
   # ou
   Get-Content $env:USERPROFILE\.ssh\id_rsa.pub
   ```
   Si un fichier s’affiche (ligne commençant par `ssh-ed25519` ou `ssh-rsa`), tu as une clé.

2. **Si tu n’as pas de clé**, en créer une :
   ```powershell
   ssh-keygen -t ed25519 -C "ton-email@exemple.com" -f "$env:USERPROFILE\.ssh\id_ed25519"
   ```
   (Entrée pour pas de passphrase, ou une passphrase si tu préfères.)

3. **Ajouter la clé publique à GitHub** : copie le contenu de `id_ed25519.pub` (étape 1), puis GitHub → Settings → SSH and GPG keys → New SSH key → coller et enregistrer.

4. **Passer le remote en SSH** (dans le dossier du projet) :
   ```powershell
   cd "c:\Users\pierr\Documents\Cursor\Logi"
   git remote set-url origin git@github.com:jeanmiche7488/rossignolia.git
   git push origin main
   ```
   Là c’est **ssh.exe** qui est utilisé, plus **git-remote-https.exe**, donc le crash ne devrait plus se produire.

**Autres pistes si tu veux rester en HTTPS** :
- **Antivirus** : ajouter en exclusion le dossier d’installation de Git (souvent `C:\Program Files\Git`) et `git-remote-https.exe`.
- **Réparer / réinstaller Git** : désinstaller « Git for Windows » puis réinstaller la dernière version depuis https://git-scm.com/download/win .
- **OneDrive** : tester un push depuis une copie du projet **hors** dossier OneDrive (ex. `C:\Temp\Logi`) pour voir si le crash disparaît.

---

## Causes fréquentes

### 1. Token GitHub expiré ou révoqué

Si l’URL du remote contient un token (`ghp_...`) et que le push échoue avec une erreur d’**authentification** (401, "Authentication failed", "invalid credentials") :

- Les tokens GitHub personnels ont une date d’expiration.
- Il faut créer un **nouveau token** sur GitHub :  
  GitHub → Settings → Developer settings → Personal access tokens → Generate new token.  
  Cocher au minimum `repo`.
- Puis mettre à jour l’URL du remote (sans laisser le token dans un fichier versionné) :

```powershell
git remote set-url origin https://jeanmiche7488:<NOUVEAU_TOKEN>@github.com/jeanmiche7488/rossignolia.git
git push origin main
```

### 2. Réseau / pare-feu / proxy

- **Timeout** : le push prend trop de temps (réseau lent, pare-feu, VPN).
- **Pas d’accès à GitHub** : pare-feu ou proxy bloque `github.com` ou le port HTTPS.

À tester : depuis le même PC, ouvrir https://github.com dans un navigateur. Si ça ne charge pas, corriger le réseau avant de repousser.

### 3. OneDrive ou autre synchro

Si le projet est dans un dossier synchronisé (OneDrive, etc.) :

- La synchro peut **verrouiller** des fichiers (dont dans `.git`) pendant le push.
- Essaye de lancer `git push origin main` quand la synchro est terminée (icône OneDrive verte).
- Voir aussi `GIT_ONEDRIVE_BEST_PRACTICES.md`.

### 4. Push depuis Cursor / sandbox

Dans Cursor, les commandes peuvent être exécutées dans un environnement limité (réseau, timeout). Si le push **timeout** ou échoue sans message clair :

- **Toujours tester le push dans un terminal normal** (PowerShell/CMD) pour voir l’erreur réelle et éviter les limites du sandbox.

---

## Vérifications utiles

```powershell
# Dernier commit (doit afficher ton commit)
git log -1 --oneline

# Nombre de commits en avance sur origin
git status

# URL du remote (le token ne doit pas être partagé)
git remote get-url origin
```

---

## Résumé

1. Le **commit** est bon en local.
2. Le **push** doit être fait (idéalement dans un terminal hors Cursor) : `git push origin main`.
3. En cas d’échec, noter le **message d’erreur** et vérifier : token, réseau, OneDrive/synchro.
