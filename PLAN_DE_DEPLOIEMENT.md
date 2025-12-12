# 🔐 Solution : Erreur 403 (Permission)

L'erreur `403 Forbidden` ou `Write access to repository not granted` signifie que le **Token** que vous avez utilisé n'a pas les droits suffisants.

## 1. Regénérer le BON Token

1.  Retournez sur GitHub : [Settings > Developer Settings > Personal Access Tokens > Tokens (**Classic**)](https://github.com/settings/tokens).
2.  Cliquez sur **Generate new token (classic)** (choisissez bien **Classic** !).
3.  **Note** : Donnez un nom (ex: "VPS-Full").
4.  **Important** : Cochez la case principale **`repo`** (cela cochera automatiquement toutes les sous-cases : `repo:status`, `repo_deployment`, etc.).
    *   *Si vous ne cochez pas ça, le token ne sert à rien.*
5.  Générez et **Copiez** le token (`ghp_...`).

## 2. Remettre à zéro l'URL sur le VPS

Pour être sûr, on va retirer le token "cassé" de l'URL et remettre le nouveau.

Exécutez ceci sur le VPS :

```bash
# Remplacez "NOUVEAU_TOKEN" par celui que vous venez de copier
git remote set-url origin https://NOUVEAU_TOKEN@github.com/gyrese/NeuralQuiz.git
```

## 3. Retenter la mise à jour

```bash
git fetch --all
git reset --hard origin/main
```

---
*Si cela échoue encore, nous passerons à la méthode manuelle (ZIP).*
