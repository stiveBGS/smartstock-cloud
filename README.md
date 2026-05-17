# SmartStock Cloud — Guide de déploiement

## Connexion par défaut
- Super Admin : **superadmin** / **smartstock2025**

---

## DÉPLOIEMENT GRATUIT SUR RENDER.COM (Recommandé)

### Étape 1 — Créer un compte GitHub (gratuit)
1. Va sur https://github.com
2. Crée un compte gratuit
3. Clique sur "New repository"
4. Nom : `smartstock-cloud`
5. Clique "Create repository"

### Étape 2 — Uploader les fichiers
1. Dans ton repository GitHub, clique "uploading an existing file"
2. Glisse-dépose ces fichiers :
   - `server.js`
   - `package.json`
   - `render.yaml`
   - Le dossier `public/` avec `index.html` dedans
3. Clique "Commit changes"

### Étape 3 — Déployer sur Render.com
1. Va sur https://render.com
2. Crée un compte gratuit
3. Clique "New" → "Web Service"
4. Connecte ton compte GitHub
5. Sélectionne ton repository `smartstock-cloud`
6. Render détecte automatiquement la config
7. Clique "Create Web Service"
8. Attends 2-3 minutes → ton application est en ligne !

### Étape 4 — Ton lien permanent
Render te donne une URL du type :
**https://smartstock-cloud.onrender.com**

Ce lien fonctionne depuis :
- N'importe quel PC
- N'importe quel téléphone Android/iPhone
- Partout dans le monde avec internet

---

## COMMENT UTILISER

### Toi (Super Admin)
1. Va sur ton URL Render
2. Connecte-toi : superadmin / smartstock2025
3. Tu vois la liste de tous tes magasins clients
4. Clique "Créer un magasin" pour ajouter un client
5. Tu peux entrer dans chaque magasin et gérer à distance

### Ton client (Gérant)
1. Tu lui donnes l'URL de ton application
2. Il se connecte avec le login/mot de passe que tu as créé pour lui
3. Il accède à son logiciel depuis son PC, téléphone ou tablette
4. Toutes ses données sont sauvegardées automatiquement sur le serveur

---

## FACTURATION SUGGÉRÉE

| Service | Prix mensuel |
|---|---|
| Hébergement Render (basique) | Gratuit (ou ~5$/mois pour plus de performances) |
| Abonnement par magasin client | 10 000 F CFA/mois |
| 5 clients = | 50 000 F CFA/mois |
| 10 clients = | 100 000 F CFA/mois |

---

## CHANGEMENT DU MOT DE PASSE SUPER ADMIN
Dans `server.js`, ligne 30, modifie :
```
pass: bcrypt.hashSync('smartstock2025', 10)
```
Remplace `smartstock2025` par ton nouveau mot de passe.

---

## SUPPORT
Email : smartstock.congo2026@gmail.com
