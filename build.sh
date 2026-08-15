#!/usr/bin/env bash
# exit on error
set -o errexit

echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r backend/requirements.txt

echo "Installing Playwright Chromium browser and OS dependencies..."
playwright install chromium
playwright install-deps chromium
