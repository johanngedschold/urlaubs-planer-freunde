const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const app = express();

// ===== MONGODB VERBINDUNG =====
const MONGODB_URL = process.env.MONGODB_URI || 'mongodb+srv://urlaubsplaner:jAJqjpAQKCvW24N3@cluster0.bkmwza7.mongodb.net/?appName=Cluster0';

mongoose.connect(MONGODB_URL)
    .then(() => console.log('✅ Mit MongoDB verbunden!'))
    .catch(err => console.log('❌ MongoDB Fehler:', err));

// ===== DATENBANK SCHEMA =====
const nutzerSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    passwort: { type: String, required: true },
    verfuegbarkeit: [String]
});

const Nutzer = mongoose.model('Nutzer', nutzerSchema);

// Statische Dateien
app.use(express.static('public'));
app.use(express.json());

// ===== REGISTRIERUNG =====
app.post('/api/register', async function(req, res) {
    try {
        const { name, passwort } = req.body;

        const existiert = await Nutzer.findOne({ name: { $regex: new RegExp('^' + name + '$', 'i') } });
        if (existiert) {
            return res.json({ erfolg: false, fehler: 'Dieser Name ist bereits vergeben!' });
        }

        const passwortHash = bcrypt.hashSync(passwort, 10);

        const neuerNutzer = new Nutzer({
            name: name,
            passwort: passwortHash,
            verfuegbarkeit: []
        });

        await neuerNutzer.save();
        console.log('Neuer Nutzer registriert:', name);

        res.json({ erfolg: true });
    } catch (error) {
        console.log('Fehler bei Registrierung:', error);
        res.json({ erfolg: false, fehler: 'Serverfehler!' });
    }
});

// ===== LOGIN =====
app.post('/api/login', async function(req, res) {
    try {
        const { name, passwort } = req.body;

        const nutzer = await Nutzer.findOne({ name: { $regex: new RegExp('^' + name + '$', 'i') } });
        if (!nutzer) {
            return res.json({ erfolg: false, fehler: 'Name nicht gefunden!' });
        }

        const passwortKorrekt = bcrypt.compareSync(passwort, nutzer.passwort);
        if (!passwortKorrekt) {
            return res.json({ erfolg: false, fehler: 'Falsches Passwort!' });
        }

        console.log('Login erfolgreich:', name);

        res.json({
            erfolg: true,
            nutzer: {
                id: nutzer._id,
                name: nutzer.name,
                verfuegbarkeit: nutzer.verfuegbarkeit
            }
        });
    } catch (error) {
        console.log('Fehler bei Login:', error);
        res.json({ erfolg: false, fehler: 'Serverfehler!' });
    }
});

// ===== VERFÜGBARKEIT SPEICHERN =====
app.post('/api/verfuegbarkeit', async function(req, res) {
    try {
        const { name, verfuegbarkeit } = req.body;

        const nutzer = await Nutzer.findOne({ name: { $regex: new RegExp('^' + name + '$', 'i') } });
        if (!nutzer) {
            return res.json({ erfolg: false, fehler: 'Nutzer nicht gefunden!' });
        }

        nutzer.verfuegbarkeit = verfuegbarkeit;
        await nutzer.save();
        
        console.log('Verfügbarkeit gespeichert für:', name, '-', verfuegbarkeit.length, 'Tage');

        res.json({ erfolg: true });
    } catch (error) {
        console.log('Fehler beim Speichern:', error);
        res.json({ erfolg: false, fehler: 'Serverfehler!' });
    }
});

// ===== ALLE NUTZER ABRUFEN =====
app.get('/nutzer', async function(req, res) {
    try {
        const nutzer = await Nutzer.find({}, 'name verfuegbarkeit');
        res.json(nutzer);
    } catch (error) {
        res.json([]);
    }
});

// ===== ADMIN: Alle Nutzer mit Details =====
app.get('/api/admin/nutzer', async function(req, res) {
    try {
        const nutzer = await Nutzer.find({}, 'name verfuegbarkeit');
        const adminDaten = nutzer.map(n => ({
            id: n._id,
            name: n.name,
            anzahlTage: n.verfuegbarkeit ? n.verfuegbarkeit.length : 0
        }));
        res.json(adminDaten);
    } catch (error) {
        res.json([]);
    }
});

// ===== ADMIN: Passwort zurücksetzen =====
app.post('/api/admin/reset-passwort', async function(req, res) {
    try {
        const { name, neuesPasswort } = req.body;

        const nutzer = await Nutzer.findOne({ name: { $regex: new RegExp('^' + name + '$', 'i') } });
        if (!nutzer) {
            return res.json({ erfolg: false, fehler: 'Nutzer nicht gefunden!' });
        }

        nutzer.passwort = bcrypt.hashSync(neuesPasswort, 10);
        await nutzer.save();
        
        console.log('Passwort zurückgesetzt für:', name);

        res.json({ erfolg: true });
    } catch (error) {
        res.json({ erfolg: false, fehler: 'Serverfehler!' });
    }
});

// ===== ADMIN: Nutzer löschen =====
app.delete('/api/admin/nutzer/:name', async function(req, res) {
    try {
        const name = req.params.name;
        const result = await Nutzer.deleteOne({ name: { $regex: new RegExp('^' + name + '$', 'i') } });
        
        if (result.deletedCount > 0) {
            console.log('Nutzer gelöscht:', name);
            res.json({ erfolg: true });
        } else {
            res.json({ erfolg: false, fehler: 'Nutzer nicht gefunden!' });
        }
    } catch (error) {
        res.json({ erfolg: false, fehler: 'Serverfehler!' });
    }
});

// ===== ADMIN: Alle Daten löschen =====
app.delete('/api/admin/alle-loeschen', async function(req, res) {
    try {
        const result = await Nutzer.deleteMany({});
        console.log('Alle Daten gelöscht! (' + result.deletedCount + ' Nutzer)');
        res.json({ erfolg: true });
    } catch (error) {
        res.json({ erfolg: false, fehler: 'Serverfehler!' });
    }
});

// ===== ADMIN-ROUTE MIT PASSWORT-SCHUTZ =====
app.get('/admin', (req, res) => {
    const passwort = req.query.key;
    const korrektes_passwort = 'urlaub2025'; // DEIN ADMIN-PASSWORT
    
    if (passwort === korrektes_passwort) {
        // Passwort korrekt → Admin-Bereich zeigen
        res.sendFile(__dirname + '/public/admin.html');
    } else {
        // Passwort falsch oder nicht eingegeben → Login-Formular
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>🔒 Admin-Zugang</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        margin: 0; 
                        padding: 0;
                        height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .login-box {
                        background: white;
                        padding: 40px;
                        border-radius: 10px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                        text-align: center;
                        max-width: 350px;
                        width: 90%;
                    }
                    input[type="password"] {
                        width: 100%;
                        padding: 12px;
                        font-size: 16px;
                        border: 2px solid #ddd;
                        border-radius: 5px;
                        margin: 15px 0;
                        box-sizing: border-box;
                    }
                    input[type="password"]:focus {
                        border-color: #4CAF50;
                        outline: none;
                    }
                    button {
                        background: #4CAF50;
                        color: white;
                        padding: 12px 30px;
                        border: none;
                        border-radius: 5px;
                        font-size: 16px;
                        cursor: pointer;
                        transition: background 0.3s;
                    }
                    button:hover {
                        background: #45a049;
                    }
                    .back-link {
                        margin-top: 20px;
                    }
                    .back-link a {
                        color: #666;
                        text-decoration: none;
                        font-size: 14px;
                    }
                </style>
            </head>
            <body>
                <div class="login-box">
                    <h2>🔒 Admin-Bereich</h2>
                    <p style="color: #666;">Passwort erforderlich</p>
                    <form method="GET" action="/admin">
                        <input type="password" name="key" placeholder="Admin-Passwort" required>
                        <br>
                        <button type="submit">Einloggen</button>
                    </form>
                    <div class="back-link">
                        <a href="/">&larr; Zurück zur Hauptseite</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    }
});

// ===== HAUPTSEITE UND ÜBERSICHT =====
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/uebersicht', (req, res) => {
    res.sendFile(__dirname + '/public/uebersicht.html');
});

// Server starten (angepasst für Deployment)
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', function() {
    console.log('Server läuft auf Port:', PORT);
});