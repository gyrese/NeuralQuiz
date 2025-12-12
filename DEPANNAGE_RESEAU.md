# � Dépannage : Ouvrir le port 3001 sans UFW

Puisque `sudo: ufw: command not found`, cela signifie que votre VPS utilise une autre méthode (souvent **iptables** pur) pour le pare-feu.

## Méthode Rapide avec iptables

Lancez cette commande (copiez-collez tout) :

```bash
sudo iptables -I INPUT -p tcp --dport 3001 -j ACCEPT
```

Si cela marche, le site devrait être accessible **immédiatement**.

---

## Si le problème persiste

Il faut vérifier que le port est bien ouvert en écoutant les connexions :

1.  **Vérifier l'écoute** :
    ```bash
    netstat -tulpn | grep node
    ```
    Vous devriez voir `:::3001` ou `0.0.0.0:3001`.

2.  **Tester depuis le VPS lui-même** :
    ```bash
    curl http://localhost:3001
    ```
    Si cela vous répond du code HTML, cela prouve que le serveur tourne, et que c'est bien le *réseau* qui bloque.

3.  **Vérifier le Panneau de Gestion OVH (ou hébergeur)** :
    Parfois, il y a un "Pare-feu externe" dans l'interface de votre hébergeur VPS qu'il faut configurer pour autoriser le port 3001 TCP.
