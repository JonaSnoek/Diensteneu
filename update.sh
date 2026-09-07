#!/usr/bin/env bash
set -euo pipefail

# Central Portal – automatisches Update-Skript (Ubuntu 22.04+, systemd)
#
# Aktualisiert eine bestehende Installation (/opt/portal) auf den neuesten
# Stand von GitHub:
#   1. Backup von config/ + SQLite-Datenbank
#   2. git pull (Branch master – lokale Änderungen werden verworfen)
#   3. Python-Abhängigkeiten aktualisieren (venv)
#   4. Frontend neu bauen (npm ci + npm run build)
#   5. Datenverzeichnisse + Berechtigungen prüfen
#   6. portal-backend.service neu starten
#      (DB-Migrationen laufen automatisch beim Start des Backends)
#   7. Health-Check
#
# Verwendung (auf dem Server):
#   cd /opt/portal && sudo ./update.sh
#
#   # anderer Pfad / anderer Backend-Port:
#   sudo PORTAL_DIR=/pfad/zum/projekt BACKEND_PORT=8000 ./update.sh

PORTAL_DIR="${PORTAL_DIR:-/opt/portal}"
BRANCH="master"
BACKEND_PORT="${BACKEND_PORT:-8000}"
SERVICE="portal-backend"
BACKUP_DIR="${PORTAL_DIR}/backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# --- Root-Check ------------------------------------------------------------
[[ $EUID -eq 0 ]] || error "Dieses Skript muss als root (sudo) ausgeführt werden."

# --- Projektverzeichnis prüfen ---------------------------------------------
[[ -d "$PORTAL_DIR" ]] || error "Portal-Verzeichnis nicht gefunden: $PORTAL_DIR"
cd "$PORTAL_DIR"
[[ -d .git ]] || error "Kein Git-Repository in $PORTAL_DIR"

# --- 1) Backup von Konfiguration + Datenbank -------------------------------
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/portal-$TIMESTAMP.tar.gz"
if [[ -f backend/data/portal.db || -d backend/data/config ]]; then
    info "Erstelle Backup: $BACKUP_FILE"
    tar -czf "$BACKUP_FILE" -C backend/data config portal.db 2>/dev/null || \
        warn "Backup unvollständig (Datei evtl. nicht vorhanden) – fahre fort."
else
    warn "Keine Daten gefunden – überspringe Backup."
fi

# --- 2) Neuesten Stand holen -----------------------------------------------
# Hinweis: config.json und portal.db sind gitignored und bleiben erhalten.
# Nur lokale Code-Änderungen werden durch reset --hard verworfen.
warn "Lokale Code-Änderungen an $PORTAL_DIR werden durch das Update verworfen."
info "Hole neuesten Stand von GitHub (Branch: $BRANCH)..."
git fetch origin "$BRANCH"
git checkout -f -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"

# --- 3) Backend-Abhängigkeiten aktualisieren --------------------------------
info "Aktualisiere Python-Abhängigkeiten..."
VENV="$PORTAL_DIR/venv"
if [[ ! -d "$VENV" ]]; then
    info "venv fehlt – wird neu erstellt."
    python3 -m venv "$VENV"
fi
"$VENV/bin/pip" install --upgrade pip -q
"$VENV/bin/pip" install -r backend/requirements.txt -q

# --- 4) Frontend neu bauen ---------------------------------------------------
info "Baue Frontend (npm ci + build)..."
cd frontend
npm ci --silent || npm install --silent
npm run build
cd "$PORTAL_DIR"

# --- 5) Datenverzeichnisse + Berechtigungen ----------------------------------
mkdir -p backend/data/config backend/data/modules backend/data/uploads
chown -R www-data:www-data "$PORTAL_DIR"
chmod 755 "$PORTAL_DIR"

# --- 6) Backend-Service neu starten -------------------------------------------
info "Starte $SERVICE neu..."
systemctl daemon-reload
systemctl restart "$SERVICE"

# --- 7) Health-Check -----------------------------------------------------------
info "Warte auf Backend (Port $BACKEND_PORT, max. 30 Sekunden)..."
ok=0
for i in $(seq 1 30); do
    if curl -sf "http://127.0.0.1:$BACKEND_PORT/" > /dev/null 2>&1; then
        ok=1
        break
    fi
    sleep 1
done

# --- Fertig -----------------------------------------------------------------------
if [[ $ok -eq 1 ]]; then
    info "Backend läuft – Update erfolgreich abgeschlossen."
else
    warn "Backend ist nach 30 Sekunden nicht erreichbar."
    warn "Logs ansehen:  sudo journalctl -fu $SERVICE"
    warn "Status:        sudo systemctl status $SERVICE"
    exit 1
fi

cat <<DONE

╔══════════════════════════════════════════════════════════════╗
║                 Update abgeschlossen!                        ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║   Stand:      Branch $BRANCH (origin/$BRANCH)                 ║
║   Backup:     $BACKUP_FILE          ║
║                                                              ║
║   Logs:       sudo journalctl -fu $SERVICE                   ║
║   Status:     sudo systemctl status $SERVICE                 ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

DONE