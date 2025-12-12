# 🚨 Le Serveur ne tourne pas !

Le diagnostic est clair : `Connection refused` même en local.
Cela signifie que **le serveur Node.js a planté ou ne s'est pas lancé**.

## 1. Vérifier les Logs d'Erreur

Pour savoir pourquoi il refuse de démarrer, on va regarder les logs PM2 :

```bash
pm2 logs neural-quiz --lines 50
```

Regardez s'il y a des lignes rouges `ERROR`.
*   Souvent c'est un problème de module manquant (`Cannot find module...`).
*   Ou un port déjà pris (`EADDRINUSE`).

## 2. Relancer "avec les yeux ouverts"

Si PM2 cache trop l'erreur, lancez-le manuellement pour voir le crash en direct :

1.  Arrêtez PM2 :
    ```bash
    pm2 stop neural-quiz
    ```

2.  Lancez manuellement :
    ```bash
    # Assurez-vous d'être dans ~/LTNhout/server
    node index.js
    ```
    
    Il va sûrement crasher tout de suite et vous afficher l'erreur exacte. Copiez-moi cette erreur !
