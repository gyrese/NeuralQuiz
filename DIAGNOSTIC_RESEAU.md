# 🛠️ Alternative à netstat

Si `netstat` n'est pas installé, utilisez **`ss`** (qui est plus moderne et installé par défaut).

## 1. Vérifier les ports écoutés avec `ss`

```bash
ss -tulpn | grep 3001
```

*   Vous devriez voir une ligne commençant par `tcp LISTEN ... :3001`.
*   Si vous voyez `*:3001` ou `0.0.0.0:3001` => C'est bon.
*   Si vous voyez `127.0.0.1:3001` => C'est restreint au local.

## 2. Installer netstat (Optionnel)

Si vous voulez vraiment utiliser `netstat` :
```bash
sudo apt-get update && sudo apt-get install net-tools -y
```
