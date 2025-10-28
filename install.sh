#!/bin/bash
# Installation script for Japanese Homework CLI (jphw)
# Automatically detects and installs Deno, then sets up the CLI executable

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Determine project directory
if [ -n "$JPHW_INSTALL_DIR" ]; then
    # If JPHW_INSTALL_DIR is set, use it (for remote installation)
    PROJECT_DIR="$JPHW_INSTALL_DIR"
else
    # Otherwise use the script's directory (for local installation)
    PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Japanese Homework CLI (jphw) Installation${NC}"
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

# Check if Deno is already installed
check_deno() {
    if command -v deno &> /dev/null; then
        DENO_VERSION=$(deno --version | head -n 1 | awk '{print $2}')
        print_success "Deno is already installed (version $DENO_VERSION)"
        return 0
    else
        print_info "Deno is not installed"
        return 1
    fi
}

# Install Deno using npm
install_deno_npm() {
    print_info "Attempting to install Deno using npm..."
    if command -v npm &> /dev/null; then
        if npm install -g deno; then
            print_success "Deno installed successfully via npm"
            return 0
        else
            print_warning "Failed to install Deno via npm"
            return 1
        fi
    else
        print_info "npm is not available"
        return 1
    fi
}

# Install Deno using Homebrew
install_deno_brew() {
    print_info "Attempting to install Deno using Homebrew..."
    if command -v brew &> /dev/null; then
        if brew install deno; then
            print_success "Deno installed successfully via Homebrew"
            return 0
        else
            print_warning "Failed to install Deno via Homebrew"
            return 1
        fi
    else
        print_info "Homebrew is not available"
        return 1
    fi
}

# Install Deno using apt
install_deno_apt() {
    print_info "Attempting to install Deno using apt..."
    if command -v apt &> /dev/null || command -v apt-get &> /dev/null; then
        # Deno is not typically available in apt, so we skip this
        print_info "Deno is not available via apt, trying other methods..."
        return 1
    else
        print_info "apt is not available"
        return 1
    fi
}

# Install Deno using pacman
install_deno_pacman() {
    print_info "Attempting to install Deno using pacman..."
    if command -v pacman &> /dev/null; then
        if sudo pacman -S --noconfirm deno 2>/dev/null; then
            print_success "Deno installed successfully via pacman"
            return 0
        else
            print_warning "Failed to install Deno via pacman"
            return 1
        fi
    else
        print_info "pacman is not available"
        return 1
    fi
}

# Install Deno using dnf
install_deno_dnf() {
    print_info "Attempting to install Deno using dnf..."
    if command -v dnf &> /dev/null; then
        if sudo dnf install -y deno 2>/dev/null; then
            print_success "Deno installed successfully via dnf"
            return 0
        else
            print_warning "Failed to install Deno via dnf"
            return 1
        fi
    else
        print_info "dnf is not available"
        return 1
    fi
}

# Install Deno using snap
install_deno_snap() {
    print_info "Attempting to install Deno using snap..."
    if command -v snap &> /dev/null; then
        if sudo snap install deno; then
            print_success "Deno installed successfully via snap"
            return 0
        else
            print_warning "Failed to install Deno via snap"
            return 1
        fi
    else
        print_info "snap is not available"
        return 1
    fi
}

# Install unzip/7z if needed
install_unzip_tools() {
    # Check if unzip or 7z is already available
    if command -v unzip &> /dev/null || command -v 7z &> /dev/null; then
        return 0
    fi
    
    print_info "Installing unzip (required for Deno installation)..."
    
    # Try to install unzip using available package managers
    if command -v apt &> /dev/null || command -v apt-get &> /dev/null; then
        if sudo apt-get update && sudo apt-get install -y unzip; then
            print_success "unzip installed successfully via apt"
            return 0
        fi
    elif command -v dnf &> /dev/null; then
        if sudo dnf install -y unzip; then
            print_success "unzip installed successfully via dnf"
            return 0
        fi
    elif command -v pacman &> /dev/null; then
        if sudo pacman -S --noconfirm unzip; then
            print_success "unzip installed successfully via pacman"
            return 0
        fi
    elif command -v yum &> /dev/null; then
        if sudo yum install -y unzip; then
            print_success "unzip installed successfully via yum"
            return 0
        fi
    elif command -v brew &> /dev/null; then
        if brew install unzip; then
            print_success "unzip installed successfully via Homebrew"
            return 0
        fi
    fi
    
    print_warning "Could not install unzip automatically"
    return 1
}

# Install Deno using the official installer
install_deno_official() {
    print_info "Attempting to install Deno using the official installer..."
    
    # Check for required tools
    if ! command -v curl &> /dev/null; then
        print_error "curl is required but not installed. Please install curl and try again."
        return 1
    fi
    
    # Try to install unzip/7z if not available
    if ! command -v unzip &> /dev/null && ! command -v 7z &> /dev/null; then
        install_unzip_tools || {
            print_error "Either unzip or 7z is required but neither is installed."
            print_error "Please install unzip and try again."
            return 1
        }
    fi
    
    # Run the official Deno installer
    if curl -fsSL https://deno.land/install.sh | sh -s -- --yes; then
        # Add Deno to PATH for this session
        export DENO_INSTALL="$HOME/.deno"
        export PATH="$DENO_INSTALL/bin:$PATH"
        print_success "Deno installed successfully via official installer"
        return 0
    else
        print_error "Failed to install Deno via official installer"
        return 1
    fi
}

# Install Deno
install_deno() {
    print_info "Starting Deno installation..."
    
    # Try package managers first (prefer npm, then brew, then pacman, dnf, snap)
    if install_deno_npm; then
        return 0
    elif install_deno_brew; then
        return 0
    elif install_deno_pacman; then
        return 0
    elif install_deno_dnf; then
        return 0
    elif install_deno_snap; then
        return 0
    elif install_deno_official; then
        return 0
    else
        print_error "Failed to install Deno using all available methods"
        print_error "Please install Deno manually from https://deno.com/"
        exit 1
    fi
}

# Install Playwright browsers
install_playwright() {
    print_info "Installing Playwright browsers..."
    
    if deno run -A npm:playwright install chromium; then
        print_success "Playwright Chromium browser installed successfully"
    else
        print_warning "Failed to install Playwright browsers automatically"
        print_warning "You may need to run 'deno run -A npm:playwright install chromium' manually later"
    fi
}

# Create executable wrapper
create_executable() {
    print_info "Creating jphw executable wrapper..."
    
    local BIN_DIR="$HOME/.local/bin"
    local WRAPPER_PATH="$BIN_DIR/jphw"
    
    # Create bin directory if it doesn't exist
    mkdir -p "$BIN_DIR"
    
    # Create the wrapper script
    cat > "$WRAPPER_PATH" << EOF
#!/bin/bash
# jphw - Japanese Homework CLI wrapper
# This script runs the CLI from the installation directory

export JPHW_DIR="$PROJECT_DIR"

cd "\$JPHW_DIR" && deno task start "\$@"
EOF
    
    # Make it executable
    chmod +x "$WRAPPER_PATH"
    
    print_success "Created executable at $WRAPPER_PATH"
}

# Add to PATH
add_to_path() {
    local BIN_DIR="$HOME/.local/bin"
    local SHELL_NAME
    SHELL_NAME=$(basename "$SHELL")
    local RC_FILE=""
    
    # Determine which shell config file to update
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
    
    # Check if BIN_DIR is already in PATH
    if echo "$PATH" | grep -q "$BIN_DIR"; then
        print_success "$BIN_DIR is already in PATH"
        return 0
    fi
    
    # Add to PATH in shell config
    if [ -n "$RC_FILE" ]; then
        print_info "Adding $BIN_DIR to PATH in $RC_FILE..."
        
        # Check if the PATH export already exists
        if grep -q "export PATH=\"\$HOME/.local/bin:\$PATH\"" "$RC_FILE" 2>/dev/null || \
           grep -q "export PATH=\$HOME/.local/bin:\$PATH" "$RC_FILE" 2>/dev/null; then
            print_success "PATH already configured in $RC_FILE"
        else
            # Add PATH export to config file
            {
                echo ""
                echo "# Added by jphw installer"
                echo "export PATH=\"\$HOME/.local/bin:\$PATH\""
            } >> "$RC_FILE"
            print_success "Added $BIN_DIR to PATH in $RC_FILE"
            print_warning "Please run 'source $RC_FILE' or restart your terminal to use jphw"
        fi
    else
        print_warning "Could not determine shell config file"
        print_warning "Please add $BIN_DIR to your PATH manually"
    fi
    
    # Also add to current session
    export PATH="$BIN_DIR:$PATH"
}

# Add Deno to PATH if installed via official installer
add_deno_to_path() {
    local DENO_INSTALL="${DENO_INSTALL:-$HOME/.deno}"
    local DENO_BIN="$DENO_INSTALL/bin"
    
    # Check if Deno bin directory exists
    if [ ! -d "$DENO_BIN" ]; then
        return 0
    fi
    
    # Check if already in PATH
    if echo "$PATH" | grep -q "$DENO_BIN"; then
        return 0
    fi
    
    local SHELL_NAME
    SHELL_NAME=$(basename "$SHELL")
    local RC_FILE=""
    
    # Determine which shell config file to update
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
    
    if [ -n "$RC_FILE" ]; then
        # Check if Deno PATH already exists
        if ! grep -q "DENO_INSTALL" "$RC_FILE" 2>/dev/null; then
            {
                echo ""
                echo "# Deno installation"
                echo "export DENO_INSTALL=\"$DENO_INSTALL\""
                echo "export PATH=\"\$DENO_INSTALL/bin:\$PATH\""
            } >> "$RC_FILE"
            print_success "Added Deno to PATH in $RC_FILE"
        fi
    fi
    
    # Add to current session
    export DENO_INSTALL="$DENO_INSTALL"
    export PATH="$DENO_BIN:$PATH"
}

# Main installation process
main() {
    # Step 1: Check/Install Deno
    if ! check_deno; then
        install_deno
    fi
    
    # Ensure Deno is in PATH
    add_deno_to_path
    
    # Verify Deno installation
    if ! command -v deno &> /dev/null; then
        print_error "Deno installation failed or is not in PATH"
        print_error "Please restart your terminal and try again"
        exit 1
    fi
    
    # Step 2: Install Playwright browsers
    install_playwright
    
    # Step 3: Create executable wrapper
    create_executable
    
    # Step 4: Add to PATH
    add_to_path
    
    # Success message
    echo ""
    echo -e "${GREEN}================================================${NC}"
    echo -e "${GREEN}Installation completed successfully!${NC}"
    echo -e "${GREEN}================================================${NC}"
    echo ""
    print_info "You can now use 'jphw' command from anywhere"
    print_info "If the command is not found, please:"
    print_info "  1. Restart your terminal, or"
    print_info "  2. Run: source ~/.bashrc (or ~/.zshrc for zsh)"
    echo ""
    print_info "To get started, run: jphw --help"
    echo ""
}

# Run main installation
main
