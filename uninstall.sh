#!/bin/bash
# Uninstallation script for Japanese Homework CLI (jphw)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Japanese Homework CLI (jphw) Uninstallation${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Function to print colored messages
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Remove executable wrapper
remove_executable() {
    local BIN_DIR="$HOME/.local/bin"
    local WRAPPER_PATH="$BIN_DIR/jphw"
    
    if [ -f "$WRAPPER_PATH" ]; then
        print_info "Removing jphw executable..."
        rm -f "$WRAPPER_PATH"
        print_success "Removed $WRAPPER_PATH"
    else
        print_info "jphw executable not found at $WRAPPER_PATH"
    fi
}

# Remove from PATH (optional, asks user)
remove_from_path() {
    local BIN_DIR="$HOME/.local/bin"
    local SHELL_NAME
    SHELL_NAME=$(basename "$SHELL")
    local RC_FILE=""
    
    # Determine which shell config file to check
    case "$SHELL_NAME" in
        bash)
            if [ -f "$HOME/.bashrc" ]; then
                RC_FILE="$HOME/.bashrc"
            elif [ -f "$HOME/.bash_profile" ]; then
                RC_FILE="$HOME/.bash_profile"
            fi
            ;;
        zsh)
            RC_FILE="$HOME/.zshrc"
            ;;
        fish)
            RC_FILE="$HOME/.config/fish/config.fish"
            ;;
        *)
            RC_FILE="$HOME/.profile"
            ;;
    esac
    
    if [ -n "$RC_FILE" ] && [ -f "$RC_FILE" ]; then
        if grep -q "# Added by jphw installer" "$RC_FILE" 2>/dev/null; then
            print_info "Found jphw PATH configuration in $RC_FILE"
            read -p "Do you want to remove it? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                # Remove the jphw PATH lines
                sed -i.bak '/# Added by jphw installer/,+1d' "$RC_FILE"
                print_success "Removed jphw PATH configuration from $RC_FILE"
                print_info "Backup saved as ${RC_FILE}.bak"
            else
                print_info "Keeping PATH configuration"
            fi
        fi
    fi
}

# Ask about removing Deno
remove_deno_prompt() {
    echo ""
    print_warning "Note: This script does not automatically remove Deno"
    print_info "Deno may be used by other applications"
    echo ""
    read -p "Do you want to remove Deno? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "To remove Deno, please use the appropriate method:"
        
        if command -v npm &> /dev/null && npm list -g deno &> /dev/null; then
            print_info "Deno was installed via npm:"
            echo "  npm uninstall -g deno"
        elif command -v brew &> /dev/null && brew list deno &> /dev/null 2>&1; then
            print_info "Deno was installed via Homebrew:"
            echo "  brew uninstall deno"
        elif command -v snap &> /dev/null && snap list deno &> /dev/null 2>&1; then
            print_info "Deno was installed via snap:"
            echo "  sudo snap remove deno"
        elif [ -d "$HOME/.deno" ]; then
            print_info "Deno was installed via official installer:"
            echo "  rm -rf $HOME/.deno"
            print_info "And remove Deno PATH configuration from your shell config file"
        else
            print_info "Could not detect Deno installation method"
            print_info "Please check your system's package manager or remove ~/.deno manually"
        fi
    else
        print_info "Keeping Deno installed"
    fi
}

# Main uninstallation process
main() {
    # Step 1: Remove executable
    remove_executable
    
    # Step 2: Remove from PATH
    remove_from_path
    
    # Step 3: Ask about Deno
    remove_deno_prompt
    
    # Success message
    echo ""
    echo -e "${GREEN}================================================${NC}"
    echo -e "${GREEN}Uninstallation completed!${NC}"
    echo -e "${GREEN}================================================${NC}"
    echo ""
    print_info "jphw has been removed from your system"
    print_info "You may need to restart your terminal for changes to take effect"
    echo ""
}

# Run main uninstallation
main
