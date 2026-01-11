#!/bin/bash
# =============================================================================
# Security Update Checker for Chore Points App
# =============================================================================
# Checks for security-relevant package updates and NextAuth stable release.
# Run periodically: ./scripts/check-security-updates.sh
#
# Recommended: Add to CI/CD or run weekly
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BLUE}===============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===============================================${NC}"
}

# Navigate to project root
cd "$(dirname "$0")/.."

print_header "CHECKING FOR SECURITY UPDATES"

echo ""
echo "Checking npm audit for vulnerabilities..."
AUDIT_RESULT=$(npm audit --json 2>/dev/null || true)
VULN_COUNT=$(echo "$AUDIT_RESULT" | grep -o '"vulnerabilities":{[^}]*}' | grep -oE '"total":[0-9]+' | grep -oE '[0-9]+' || echo "0")

if [ "$VULN_COUNT" = "0" ]; then
    echo -e "${GREEN}[OK] No known vulnerabilities found${NC}"
else
    echo -e "${RED}[ALERT] Found $VULN_COUNT vulnerabilities${NC}"
    echo "Run 'npm audit' for details"
fi

print_header "CHECKING AUTH PACKAGES"

echo ""
echo "Current next-auth version:"
CURRENT_VERSION=$(npm ls next-auth --depth=0 2>/dev/null | grep next-auth | grep -oE '[0-9]+\.[0-9]+\.[0-9]+(-beta\.[0-9]+)?' || echo "unknown")
echo "  Installed: $CURRENT_VERSION"

echo ""
echo "Checking for stable v5 release..."
LATEST_STABLE=$(npm view next-auth@latest version 2>/dev/null || echo "unknown")
LATEST_BETA=$(npm view next-auth@beta version 2>/dev/null || echo "unknown")

echo "  Latest stable (v4): $LATEST_STABLE"
echo "  Latest beta (v5): $LATEST_BETA"

if [[ "$LATEST_STABLE" == 5.* ]]; then
    echo -e "${GREEN}[INFO] NextAuth v5 stable is now available!${NC}"
    echo "  Run: npm install next-auth@latest"
elif [[ "$CURRENT_VERSION" != "$LATEST_BETA" && "$LATEST_BETA" != "unknown" ]]; then
    echo -e "${YELLOW}[UPDATE] Newer beta available: $LATEST_BETA${NC}"
    echo "  Run: npm install next-auth@$LATEST_BETA"
else
    echo -e "${GREEN}[OK] You're on the latest beta${NC}"
fi

echo ""
echo "Checking @auth/prisma-adapter..."
ADAPTER_CURRENT=$(npm ls @auth/prisma-adapter --depth=0 2>/dev/null | grep prisma-adapter | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
ADAPTER_LATEST=$(npm view @auth/prisma-adapter@latest version 2>/dev/null || echo "unknown")
echo "  Installed: $ADAPTER_CURRENT"
echo "  Latest: $ADAPTER_LATEST"

if [ "$ADAPTER_CURRENT" != "$ADAPTER_LATEST" ] && [ "$ADAPTER_LATEST" != "unknown" ]; then
    echo -e "${YELLOW}[UPDATE] Update available${NC}"
    echo "  Run: npm install @auth/prisma-adapter@latest"
else
    echo -e "${GREEN}[OK] Up to date${NC}"
fi

print_header "CHECKING OTHER SECURITY-CRITICAL PACKAGES"

echo ""
PACKAGES=("bcryptjs" "prisma" "@prisma/client" "next")

for pkg in "${PACKAGES[@]}"; do
    CURRENT=$(npm ls "$pkg" --depth=0 2>/dev/null | grep "$pkg" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "unknown")
    LATEST=$(npm view "$pkg@latest" version 2>/dev/null || echo "unknown")

    if [ "$CURRENT" = "unknown" ]; then
        echo "  $pkg: not installed"
    elif [ "$CURRENT" != "$LATEST" ] && [ "$LATEST" != "unknown" ]; then
        echo -e "  $pkg: ${YELLOW}$CURRENT -> $LATEST available${NC}"
    else
        echo -e "  $pkg: ${GREEN}$CURRENT (current)${NC}"
    fi
done

print_header "RECOMMENDATIONS"

echo ""
echo "1. Run 'npm audit fix' to auto-fix compatible vulnerabilities"
echo "2. Check GitHub Security Advisories for next-auth:"
echo "   https://github.com/nextauthjs/next-auth/security/advisories"
echo "3. Subscribe to Auth.js releases for stable v5 notification:"
echo "   https://github.com/nextauthjs/next-auth/releases"
echo "4. Run this script monthly or add to CI pipeline"
echo ""

print_header "DONE"
