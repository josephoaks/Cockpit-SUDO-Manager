#!/bin/bash
set -e

echo "🔨 Building React frontend..."
npm run build

echo "🔄 Restarting Cockpit..."
sudo systemctl restart cockpit.socket

echo "✅ Done! Reload http://$(hostname):9090/sudo-manager"
