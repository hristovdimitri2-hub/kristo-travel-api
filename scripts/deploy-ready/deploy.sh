#!/bin/bash
# ============================================
# KRISTO TRAVEL API - Deployment Script
# Изпълни: bash deploy.sh
# ============================================

set -e

echo ""
echo "============================================"
echo "  KRISTO TRAVEL API - DEPLOYMENT OPTIONS"
echo "============================================"
echo ""
echo "Избери опция:"
echo "  1) Локален тест (на този компютър)"
echo "  2) Подготовка за Railway.app"
echo "  3) Подготовка за Render.com"
echo "  4) Docker локално"
echo "  5) Проверка на състоянието"
echo ""
read -p "Твоят избор (1-5): " choice

case $choice in
  1)
    echo ""
    echo "[1] Стартирам локално..."
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -q -r requirements.txt
    echo ""
    echo "Сървърът стартира на http://localhost:8000"
    echo "Натисни Ctrl+C за спиране"
    echo ""
    python kristo_api.py
    ;;
  2)
    echo ""
    echo "[2] Подготовка за Railway.app"
    echo ""
    echo "Стъпки:"
    echo "  1. Създай GitHub хранилище с тези файлове"
    echo "  2. Отиди на https://railway.app"
    echo "  3. Натисни 'New Project' -> 'Deploy from GitHub repo'"
    echo "  4. Избери хранилището"
    echo "  5. Railway автоматично ще разпознае railway.json"
    echo "  6. Добави environment variable:"
    echo "     WALLET_ADDRESS=0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f"
    echo ""
    echo "Ако нямаш GitHub, можеш да използваш:"
    echo "  railway init"
    echo "  railway up"
    echo ""
    ;;
  3)
    echo ""
    echo "[3] Подготовка за Render.com"
    echo ""
    echo "Стъпки:"
    echo "  1. Създай GitHub хранилище с тези файлове"
    echo "  2. Отиди на https://dashboard.render.com"
    echo "  3. Натисни 'New' -> 'Web Service'"
    echo "  4. Свържи GitHub хранилището"
    echo "  5. Render автоматично ще разпознае render.yaml"
    echo "  6. В 'Environment' добави:"
    echo "     WALLET_ADDRESS=0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f"
    echo ""
    ;;
  4)
    echo ""
    echo "[4] Docker локален старт..."
    docker build -t kristo-api .
    docker run -p 8000:8000 -e WALLET_ADDRESS=0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f kristo-api
    ;;
  5)
    echo ""
    echo "[5] Проверка..."
    curl -s http://localhost:8000/health 2>/dev/null && echo "" || echo "Сървърът не работи локално"
    ;;
  *)
    echo "Невалиден избор"
    ;;
esac