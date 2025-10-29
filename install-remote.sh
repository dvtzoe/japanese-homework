#!/bin/bash
# One-line installer for Japanese Homework CLI (jphw)
# Usage: curl -fsSL https://raw.githubusercontent.com/dvtzoe/japanese-homework/main/install-remote.sh | bash

set -e

REPO_URL="https://github.com/dvtzoe/japanese-homework.git"
INSTALL_DIR="$HOME/.jphw-install"
BRANCH="${JPHW_BRANCH:-main}"

echo "================================================"
echo "Japanese Homework CLI (jphw) Remote Installation"
echo "================================================"
echo ""

# Check if git is available
if ! command -v git &> /dev/null; then
    echo "[ERROR] git is required but not installed."
    echo "[INFO] Please install git and try again."
    exit 1
fi

# Clone or update the repository
if [ -d "$INSTALL_DIR" ]; then
    echo "[INFO] Updating existing installation..."
    cd "$INSTALL_DIR"
    git fetch origin
    git reset --hard "origin/$BRANCH"
else
    echo "[INFO] Cloning repository..."
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Run the installation script
export JPHW_INSTALL_DIR="$INSTALL_DIR"
bash "$INSTALL_DIR/install.sh"

echo ""
echo "[INFO] Installation complete!"
echo "[INFO] The repository is installed at: $INSTALL_DIR"
echo "[INFO] To update in the future, run: jphw update"
