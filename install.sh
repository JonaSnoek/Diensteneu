#!/usr/bin/env bash
set -euo pipefail

# Central Portal – automatisches Installationsskript (Ubuntu 22.04+)
#
# Verwendung:
#   curl -fsSL https://.../install.sh | sudo bash
#   # oder lokal:
#   chmod +x install.sh && sudo ./install.sh
#
# Das Skript legt das Projekt in /opt/portal an, installiert alle
# Abhängigkeiten, baut das Frontend und richtet systemd-Dienste ein.

PORJECT_DIR="/opt/portal"
REPO_URL="https://github.com/yourorg/portal.git"   # <-- HIER ANPASSEN
BRANCH="main"
BACKEND_PORT=8000
FRONTEND_PORT=80
NGINX_SITE="portal"

# --- Farben ---
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# --- Root-Check ---
[[ $EUID -eq 0 ]] || error "Dieses Skript muss als root (sudo) ausgeführt werden."

# --- Systemaktualisierung & Basis-Pakete ---
info "Aktualisiere Paketquellen und installiere Abhängigkeiten..."
apt-get update -qq
apt-get install -y -qq \
    curl git python3 python3-venv python3-pip \
    nodejs npm nginx

info "Python: $(python3 --version), Node: $(node --version), npm: $(npm --version)"

# --- Projekt anlegen / clonen ---
if [[ -d "$PORJECT_DIR" ]]; then
    warn "$PORJECT_DIR existiert bereits – führe git pull aus..."
    cd "$PORJECT_DIR"
    git pull
else
    git clone --branch "$BRANCH" "$REPO_URL" "$PORJECT_DIR"
    cd "$PORJECT_DIR"
fi

# --- Backend-Setup ---
info "Richte Python-Umgebung ein..."
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip -q
pip install -r backend/requirements.txt -q
deactivate

# Datenverzeichnisse anlegen
mkdir -p backend/data/config backend/data/modules backend/data/uploads

# --- Frontend-Build ---
info "Installiere Frontend-Abhängigkeiten und erstelle Production-Build..."
cd frontend
npm ci --silent
npm run build
cd "$PORJECT_DIR"

# --- systemd: Backend-Service ---
info "Erstelle systemd-Service für das Backend..."
cat > /etc/systemd/system/portal-backend.service <<UNIT
[Unit]
Description=Central Portal Backend (FastAPI / Uvicorn)
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$PORJECT_DIR/backend
Environment="PATH=$PORJECT_DIR/venv/bin"
ExecStart=$PORJECT_DIR/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port $BACKEND_PORT
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

# --- systemd: Frontend (nginx) ---
info "Konfiguriere nginx als Reverse-Proxy für Frontend + API..."
cat > /etc/nginx/sites-available/$NGINX_SITE <<NGINX
server {
    listen $FRONTEND_PORT default_server;
    server_name _;

    root $PORJECT_DIR/frontend/dist;
    index index.html;

    gzip on;
    gzip_types text/css application/javascript image/svg+xml;

    # Statische Frontend-Dateien
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API-Proxy zum Backend
    location /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;

        # SSE / Streaming-Unterstützung
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding on;
    }

    # Uploads (Logos etc.) direkt ausliefern
    location /api/uploads/ {
        alias $PORJECT_DIR/backend/data/uploads/;
    }
}
NGINX

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/$NGINX_SITE /etc/nginx/sites-enabled/

# --- Berechtigungen ---
info "Setze Berechtigungen..."
chown -R www-data:www-data "$PORJECT_DIR"
chmod 755 "$PORJECT_DIR"

# --- Dienste aktivieren & starten ---
info "Starte Dienste..."
systemctl daemon-reload
systemctl enable portal-backend
systemctl enable nginx
systemctl restart portal-backend
systemctl restart nginx

# --- Warte auf Backend ---
info "Warte auf Backend (max. 30 Sekunden)..."
for i in $(seq 1 30); do
    if curl -sf http://127.0.0.1:$BACKEND_PORT/ > /dev/null 2>&1; then
        info "Backend läuft auf Port $BACKEND_PORT."
        break
    fi
    sleep 1
done

# --- Fertig ---
PUBLIC_IP=$(curl -4 -sf ifconfig.me 2>/dev/null || echo "localhost")
cat <<DONE

╔══════════════════════════════════════════════════════════╗
║           Installation abgeschlossen!                    ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║   Frontend:  http://$PUBLIC_IP:$FRONTEND_PORT            ║
║   Backend:   http://127.0.0.1:$BACKEND_PORT              ║
║   API-Docs:  http://127.0.0.1:$BACKEND_PORT/docs         ║
║                                                          ║
║   systemd-Services:                                      ║
║     portal-backend.service                               ║
║     nginx.service                                        ║
║                                                          ║
║   Logs anzeigen:                                         ║
║     journalctl -fu portal-backend                        ║
║     journalctl -fu nginx                                 ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝

DONE
