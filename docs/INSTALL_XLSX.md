# Installation du package xlsx

Pour parser les fichiers Excel (XLS/XLSX), vous devez installer le package `xlsx`.

## Installation

```bash
npm install xlsx
npm install --save-dev @types/xlsx
```

## Note

Si vous n'installez pas ce package, seuls les fichiers CSV seront supportés. Les fichiers Excel retourneront une erreur claire indiquant que le package est requis.

## Alternative temporaire

Si vous ne pouvez pas installer xlsx pour le moment, vous pouvez :
1. Convertir vos fichiers Excel en CSV
2. Utiliser uniquement des fichiers CSV pour les tests
