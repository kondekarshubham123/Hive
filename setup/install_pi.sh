#!/bin/bash
# Hive — Raspberry Pi Setup Script
# Tested on Raspberry Pi OS Lite 64-bit (bookworm)
# Run as regular user (not root). Uses sudo where needed.
# Usage: bash setup/install_pi.sh

set -euo pipefail

PI_IP=$(hostname -I | awk '{print $1}')
echo "==> Hive Pi Setup starting on $PI_IP"

# --- System dependencies ---
echo "==> Updating system packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
    python3 python3-pip python3-venv \
    git curl ffmpeg \
    libopenblas-dev \
    pkg-config \
    libavformat-dev libavcodec-dev libavdevice-dev \
    libavutil-dev libavfilter-dev libswscale-dev libswresample-dev

# --- Ollama ---
if ! command -v ollama &> /dev/null; then
    echo "==> Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
else
    echo "==> Ollama already installed: $(ollama --version)"
fi

# Start Ollama service
sudo systemctl enable ollama
sudo systemctl start ollama
sleep 3

# Pull Gemma 2 2B — Google's open-weight model (~1.6 GB)
# Runs fully locally on Pi; no API key or cloud access required.
echo "==> Pulling gemma2:2b base model (~1.6 GB, please wait)..."
ollama pull gemma2:2b

# Build the optimized hive-fast model from the Modelfile
# (gemma2:2b + tuned num_ctx/temperature/threads for Pi CPU)
echo "==> Building hive-fast model..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ollama create hive-fast -f "$SCRIPT_DIR/Modelfile"

echo "==> Testing hive-fast model..."
ollama run hive-fast "Say hello in one word" --nowordwrap

# --- Python virtual environment ---
echo "==> Setting up Python environment..."
cd "$(dirname "$0")/.."
python3 -m venv server/venv
source server/venv/bin/activate

pip install --upgrade pip -q

# Install CPU-only torch first (openai-whisper depends on it).
# Separate step so the large download gets its own retry budget.
echo "==> Installing PyTorch (CPU-only, ~300MB)..."
pip install --retries 5 --timeout 120 \
    torch --index-url https://download.pytorch.org/whl/cpu

echo "==> Installing remaining dependencies..."
pip install --retries 5 --timeout 60 -r server/requirements.txt

# Pre-download openai-whisper base.en model weights (~140MB, cached by torch hub)
echo "==> Pre-downloading Whisper base.en model..."
python3 -c "import whisper; whisper.load_model('base.en')"

# --- Node.js (for building client) ---
if ! command -v node &> /dev/null; then
    echo "==> Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "==> Node.js already installed: $(node --version)"
fi

# Build client
echo "==> Building frontend..."
cd client
npm install -q
npm run build
cd ..

# --- Systemd service ---
echo "==> Creating systemd service..."
sudo tee /etc/systemd/system/hive.service > /dev/null <<EOF
[Unit]
Description=Hive AI Assistant
After=network.target ollama.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$(pwd)
Environment=PATH=$(pwd)/server/venv/bin:/usr/local/bin:/usr/bin:/bin
Environment=OLLAMA_MODEL=hive-fast
Environment=OLLAMA_BASE_URL=http://localhost:11434
ExecStart=$(pwd)/server/venv/bin/uvicorn server.main:app --host 0.0.0.0 --port 8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable hive
sudo systemctl start hive

echo ""
echo "======================================"
echo "  Hive is running!"
echo "  Open on this Pi:    http://localhost:8000"
echo "  Open on your phone: http://$PI_IP:8000"
echo "  (Both devices must be on the same WiFi)"
echo "======================================"
