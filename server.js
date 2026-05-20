const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'smartstock_secret_key_2025';
const DATA_DIR = path.join(__dirname, 'data');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Créer le dossier data si inexistant
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ============================================================
// UTILITAIRES FICHIERS
// ============================================================
function readDB(magasinId) {
  const file = path.join(DATA_DIR, `${magasinId}.json`);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch(e) { return null; }
}

function writeDB(magasinId, data) {
  const file = path.join(DATA_DIR, `${magasinId}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function readMagasins() {
  const file = path.join(DATA_DIR, 'magasins.json');
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch(e) { return []; }
}

function writeMagasins(data) {
  fs.writeFileSync(path.join(DATA_DIR, 'magasins.json'), JSON.stringify(data, null, 2));
}

function readAdmins() {
  const file = path.join(DATA_DIR, 'admins.json');
  if (!fs.existsSync(file)) {
    const defaultAdmin = [{
      id: 'admin_master',
      nom: 'Super Admin',
      login: 'superadmin',
      pass: bcrypt.hashSync('smartstock2025', 10),
      role: 'superadmin'
    }];
    fs.writeFileSync(file, JSON.stringify(defaultAdmin, null, 2));
    return defaultAdmin;
  }
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch(e) { return []; }
}

function writeAdmins(data) {
  fs.writeFileSync(path.join(DATA_DIR, 'admins.json'), JSON.stringify(data, null, 2));
}

// ============================================================
// MIDDLEWARE AUTH
// ============================================================
function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch(e) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

function superAdminMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Accès réservé au super admin' });
    next();
  });
}

// ============================================================
// AUTH ROUTES
// ============================================================

// Connexion universelle (superadmin + gérant de magasin)
app.post('/api/auth/login', (req, res) => {
  const { login, pass } = req.body;
  if (!login || !pass) return res.status(400).json({ error: 'Login et mot de passe requis' });

  // Vérifier super admins
  const admins = readAdmins();
  const admin = admins.find(a => a.login === login);
  if (admin && bcrypt.compareSync(pass, admin.pass)) {
    const token = jwt.sign({ id: admin.id, login: admin.login, role: admin.role, nom: admin.nom }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: { id: admin.id, nom: admin.nom, login: admin.login, role: admin.role } });
  }

  // Vérifier utilisateurs de magasins
  const magasins = readMagasins();
  for (const mag of magasins) {
    const db = readDB(mag.id);
    if (!db) continue;
    const user = (db.utilisateurs || []).find(u => u.login === login);
    if (user && (user.pass === pass || bcrypt.compareSync(pass, user.pass))) {
      const token = jwt.sign({ id: user.id, login: user.login, role: user.role, nom: user.nom, magasinId: mag.id, magasinNom: mag.nom }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, user: { id: user.id, nom: user.nom, login: user.login, role: user.role, magasinId: mag.id, magasinNom: mag.nom } });
    }
  }

  return res.status(401).json({ error: 'Identifiants incorrects' });
});

// ============================================================
// ROUTES SUPER ADMIN — GESTION DES MAGASINS
// ============================================================

// Lister tous les magasins
app.get('/api/admin/magasins', superAdminMiddleware, (req, res) => {
  const magasins = readMagasins();
  const result = magasins.map(m => {
    const db = readDB(m.id);
    return {
      ...m,
      nbProduits: db ? (db.produits || []).length : 0,
      nbVentes: db ? (db.ventes || []).length : 0,
      nbClients: db ? (db.clients || []).length : 0,
      totalVentes: db ? (db.ventes || []).reduce((s, v) => s + (v.total || 0), 0) : 0
    };
  });
  res.json(result);
});

// Créer un nouveau magasin
app.post('/api/admin/magasins', superAdminMiddleware, (req, res) => {
  const { nom, proprietaire, telephone, email, adresse, loginGerant, passGerant } = req.body;
  if (!nom || !loginGerant || !passGerant) return res.status(400).json({ error: 'Nom, login et mot de passe gérant requis' });

  const magasins = readMagasins();
  if (magasins.find(m => m.nom.toLowerCase() === nom.toLowerCase())) {
    return res.status(400).json({ error: 'Un magasin avec ce nom existe déjà' });
  }

  const magasinId = uuidv4().slice(0, 8);
  const newMagasin = { id: magasinId, nom, proprietaire: proprietaire || '', telephone: telephone || '', email: email || '', adresse: adresse || '', dateCreation: new Date().toISOString(), actif: true };

  const dbInitiale = {
    produits: [], clients: [], fournisseurs: [], ventes: [],
    credits: [], paiements_credits: [], commandes: [],
    utilisateurs: [{
      id: uuidv4().slice(0, 8),
      nom: proprietaire || nom,
      login: loginGerant,
      pass: passGerant,
      role: 'admin'
    }],
    params: { nom, tel: telephone || '', email: email || '', adresse: adresse || '', devise: 'F CFA', seuil: 5 }
  };

  magasins.push(newMagasin);
  writeMagasins(magasins);
  writeDB(magasinId, dbInitiale);

  res.json({ success: true, magasin: newMagasin, loginGerant, message: `Magasin créé ! ID: ${magasinId}` });
});

// Modifier un magasin
app.put('/api/admin/magasins/:id', superAdminMiddleware, (req, res) => {
  const magasins = readMagasins();
  const idx = magasins.findIndex(m => m.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Magasin non trouvé' });
  magasins[idx] = { ...magasins[idx], ...req.body, id: req.params.id };
  writeMagasins(magasins);
  res.json({ success: true, magasin: magasins[idx] });
});

// Supprimer un magasin
app.delete('/api/admin/magasins/:id', superAdminMiddleware, (req, res) => {
  let magasins = readMagasins();
  magasins = magasins.filter(m => m.id !== req.params.id);
  writeMagasins(magasins);
  const file = path.join(DATA_DIR, `${req.params.id}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ success: true });
});

// Stats globales pour le super admin
app.get('/api/admin/stats', superAdminMiddleware, (req, res) => {
  const magasins = readMagasins();
  let totalVentes = 0, totalProduits = 0, totalClients = 0;
  magasins.forEach(m => {
    const db = readDB(m.id);
    if (db) {
      totalVentes += (db.ventes || []).reduce((s, v) => s + (v.total || 0), 0);
      totalProduits += (db.produits || []).length;
      totalClients += (db.clients || []).length;
    }
  });
  res.json({ nbMagasins: magasins.length, totalVentes, totalProduits, totalClients });
});

// ============================================================
// ROUTES MAGASIN — DONNÉES
// ============================================================

// Récupérer toutes les données du magasin
app.get('/api/magasin/data', authMiddleware, (req, res) => {
  const magasinId = req.user.magasinId;
  if (!magasinId) return res.status(403).json({ error: 'Accès non autorisé' });
  const db = readDB(magasinId);
  if (!db) return res.status(404).json({ error: 'Magasin non trouvé' });
  res.json(db);
});

// Sauvegarder toutes les données du magasin
app.post('/api/magasin/data', authMiddleware, (req, res) => {
  const magasinId = req.user.magasinId;
  if (!magasinId) return res.status(403).json({ error: 'Accès non autorisé' });
  if (req.user.role === 'caissier') return res.status(403).json({ error: 'Accès refusé' });
  writeDB(magasinId, req.body);
  res.json({ success: true });
});

// Sync partielle — sauvegarder une section spécifique
app.patch('/api/magasin/data', authMiddleware, (req, res) => {
  const magasinId = req.user.magasinId;
  if (!magasinId) return res.status(403).json({ error: 'Accès non autorisé' });
  const db = readDB(magasinId);
  if (!db) return res.status(404).json({ error: 'Magasin non trouvé' });
  const updated = { ...db, ...req.body };
  writeDB(magasinId, updated);
  res.json({ success: true });
});

// Super admin peut voir les données de n'importe quel magasin
app.get('/api/admin/magasins/:id/data', superAdminMiddleware, (req, res) => {
  const db = readDB(req.params.id);
  if (!db) return res.status(404).json({ error: 'Magasin non trouvé' });
  res.json(db);
});

app.post('/api/admin/magasins/:id/data', superAdminMiddleware, (req, res) => {
  writeDB(req.params.id, req.body);
  res.json({ success: true });
});

// ============================================================
// PAGE D'ACCUEIL API
// ============================================================
app.get('/api', (req, res) => {
  res.json({
    name: 'SmartStock Cloud API',
    version: '2.0.0',
    status: 'running',
    endpoints: [
      'POST /api/auth/login',
      'GET  /api/admin/magasins',
      'POST /api/admin/magasins',
      'GET  /api/admin/stats',
      'GET  /api/magasin/data',
      'POST /api/magasin/data',
      'PATCH /api/magasin/data'
    ]
  });
});

// Toutes les autres routes → app frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SmartStock Cloud démarré sur le port ${PORT}`);
  console.log(`Super Admin : login=superadmin / pass=smartstock2025`);
});
