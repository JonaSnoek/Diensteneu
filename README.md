# Central Portal System (Zentrales Portal-System)

Ein modernes, modulares und selbst hostbares Webanwendungs-Portal, um eigene Tools, HTML-Dateien (ZIP-Uploads), Module und Verknüpfungen zentral zu verwalten.

## Features
- **Setup-Assistent (Setup Wizard)**: Beim ersten Start zeigt die Anwendung einen Wizard zur Initialisierung an (Root-Passwort, Datenbankverbindung, Portal-Design, LDAP-Optionen). Nach der Durchführung wird der Setup-Zugang dauerhaft gesperrt.
- **Benutzerverwaltung**: Lokale Konten sowie Anbindung an LDAP/Active Directory.
- **LDAP Integration**: Multi-Source LDAP, Rollenmapping nach Gruppen, automatisches Anlegen von Benutzern und Deaktivierung gelöschter Benutzer.
- **Rollen- & Rechteverwaltung (RBAC)**: Feingranulare Rechte (Berechtigungen auf Kachelebene nach Rollen, LDAP-Gruppen, expliziten Userlisten oder komplett öffentlich).
- **Launcher System**: Kacheln für Verlinkungen (extern, iframe) und interne HTML-Module.
- **HTML-Engine**: Sichere Ausführung hochgeladener ZIP-Tools in einer sandboxed Iframe mit Berechtigungsprüfung an der API-Schnittstelle.
- **Adminpanel**: Dashboard zur Verwaltung von Usern, Launchers, LDAP-Sync, Systemeinstellungen (Farbthemen) und Audit-Logs.
- **Security**: Passwort-Hashing, dynamic JWT cookie sessions, Path-Traversal (Zip Slip) Schutz bei Uploads, Audit-Logging und Iframe-Sandboxing.

---

## Verzeichnisstruktur
- `/backend`: FastAPI (Python) REST-API Server, Datenbank-Models, LDAP-Client, Zip-Handler und Datenverzeichnis (`/data` für Konfigurationen und hochgeladene Module).
- `/frontend`: React + Vite + TypeScript Webanwendung. Design komplett in modernem **Vanilla CSS** (Dark Mode / Glassmorphismus).

---

## Installation & Start (Lokal für Entwicklung)

### 1. Backend starten
Voraussetzung: Python 3.10+ installiert.

```bash
cd backend
# Virtuelle Umgebung erstellen
python -m venv venv
# venv aktivieren (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# Abhängigkeiten installieren
pip install -r requirements.txt

# Starten
uvicorn app.main:app --reload
```
Der Server läuft standardmäßig auf `http://localhost:8000`. Die Datenbank wird automatisch als SQLite-Datei unter `backend/data/portal.db` angelegt.

### 2. Frontend starten
Voraussetzung: Node.js 18+ installiert.

```bash
cd frontend
# Abhängigkeiten installieren
npm install

# Starten
npm run dev
```
Das Frontend läuft standardmäßig unter `http://localhost:5173`. Öffnen Sie diese Adresse im Browser, um den Setup-Assistenten aufzurufen.

---

## Deployment mit Docker Compose
Voraussetzung: Docker & Docker Compose installiert.

```bash
# Startet Postgres, Backend und Frontend
docker-compose up --build -d
```
Das Portal ist danach unter `http://localhost` (Port 80) erreichbar, das Backend läuft unter `http://localhost:8000`. Das SQLite-Verzeichnis wird bei Docker-Nutzung automatisch durch die Postgres-Datenbank in Docker abgelöst.
