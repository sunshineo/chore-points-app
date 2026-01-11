#!/bin/bash
# =============================================================================
# Secret Rotation Script for Chore Points App
# =============================================================================
# This script helps you rotate sensitive credentials safely.
# Run this script periodically (recommended: every 90 days)
#
# Usage: ./scripts/rotate-secrets.sh [option]
#   --generate    Generate new secrets (print only, doesn't modify .env)
#   --check       Check current .env for weak/default values
#   --help        Show this help message
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo "=============================================="
    echo "$1"
    echo "=============================================="
}

generate_secrets() {
    print_header "GENERATING NEW SECRETS"
    echo ""
    echo -e "${YELLOW}Copy these values to your .env file or Vercel Environment Variables:${NC}"
    echo ""

    echo "# NextAuth Secret (32 bytes, base64 encoded)"
    echo "NEXTAUTH_SECRET=\"$(openssl rand -base64 32)\""
    echo ""

    echo "# Registration Secret (24 bytes, base64 encoded)"
    echo "REGISTRATION_SECRET=\"$(openssl rand -base64 24)\""
    echo ""

    echo -e "${YELLOW}For these credentials, you need to regenerate manually:${NC}"
    echo ""
    echo "DATABASE_URL:"
    echo "  1. Go to https://console.neon.tech"
    echo "  2. Select your project > Settings > Connection string"
    echo "  3. Click 'Reset password' to generate new credentials"
    echo "  4. Update your DATABASE_URL with the new connection string"
    echo ""
    echo "GOOGLE_CLIENT_SECRET:"
    echo "  1. Go to https://console.cloud.google.com/apis/credentials"
    echo "  2. Click on your OAuth 2.0 Client ID"
    echo "  3. Click 'Reset Secret' under Client secrets"
    echo "  4. Update GOOGLE_CLIENT_SECRET with the new value"
    echo ""
    echo "BLOB_READ_WRITE_TOKEN:"
    echo "  1. Go to https://vercel.com/dashboard/stores"
    echo "  2. Select your blob store"
    echo "  3. Go to Settings > Tokens > Create new token"
    echo "  4. Revoke the old token after updating"
    echo ""
}

check_env() {
    print_header "CHECKING .ENV FILE FOR SECURITY ISSUES"

    ENV_FILE=".env"
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED}ERROR: .env file not found${NC}"
        exit 1
    fi

    ISSUES=0

    echo ""
    echo "Checking for weak or default values..."
    echo ""

    # Check NEXTAUTH_SECRET
    if grep -q 'NEXTAUTH_SECRET=""' "$ENV_FILE" || grep -q 'NEXTAUTH_SECRET="your-secret' "$ENV_FILE"; then
        echo -e "${RED}[CRITICAL] NEXTAUTH_SECRET is empty or default${NC}"
        ISSUES=$((ISSUES + 1))
    elif grep -q 'NEXTAUTH_SECRET=' "$ENV_FILE"; then
        SECRET=$(grep 'NEXTAUTH_SECRET=' "$ENV_FILE" | cut -d'"' -f2)
        if [ ${#SECRET} -lt 32 ]; then
            echo -e "${YELLOW}[WARNING] NEXTAUTH_SECRET appears too short (should be 32+ chars)${NC}"
            ISSUES=$((ISSUES + 1))
        else
            echo -e "${GREEN}[OK] NEXTAUTH_SECRET is set${NC}"
        fi
    fi

    # Check REGISTRATION_SECRET
    if grep -q 'REGISTRATION_SECRET=""' "$ENV_FILE" || grep -q 'REGISTRATION_SECRET="your-secret' "$ENV_FILE"; then
        echo -e "${RED}[CRITICAL] REGISTRATION_SECRET is empty or default${NC}"
        ISSUES=$((ISSUES + 1))
    elif grep -q 'family2025' "$ENV_FILE"; then
        echo -e "${RED}[CRITICAL] REGISTRATION_SECRET uses weak value 'family2025'${NC}"
        ISSUES=$((ISSUES + 1))
    elif grep -q 'REGISTRATION_SECRET=' "$ENV_FILE"; then
        SECRET=$(grep 'REGISTRATION_SECRET=' "$ENV_FILE" | cut -d'"' -f2)
        if [ ${#SECRET} -lt 16 ]; then
            echo -e "${YELLOW}[WARNING] REGISTRATION_SECRET is short (recommended: 16+ chars)${NC}"
            ISSUES=$((ISSUES + 1))
        else
            echo -e "${GREEN}[OK] REGISTRATION_SECRET is set${NC}"
        fi
    fi

    # Check DATABASE_URL for default values
    if grep -q 'DATABASE_URL="postgresql://user:password@localhost' "$ENV_FILE"; then
        echo -e "${RED}[CRITICAL] DATABASE_URL uses default localhost credentials${NC}"
        ISSUES=$((ISSUES + 1))
    elif grep -q 'DATABASE_URL=' "$ENV_FILE"; then
        echo -e "${GREEN}[OK] DATABASE_URL is configured${NC}"
    fi

    # Check NEXTAUTH_URL for HTTPS in production
    if grep -q 'NEXTAUTH_URL="http://localhost' "$ENV_FILE"; then
        echo -e "${YELLOW}[INFO] NEXTAUTH_URL is localhost (OK for development)${NC}"
    elif grep -q 'NEXTAUTH_URL="http://' "$ENV_FILE"; then
        echo -e "${RED}[CRITICAL] NEXTAUTH_URL uses HTTP - should be HTTPS in production${NC}"
        ISSUES=$((ISSUES + 1))
    elif grep -q 'NEXTAUTH_URL="https://' "$ENV_FILE"; then
        echo -e "${GREEN}[OK] NEXTAUTH_URL uses HTTPS${NC}"
    fi

    # Check for Google credentials
    if grep -q 'GOOGLE_CLIENT_SECRET=""' "$ENV_FILE"; then
        echo -e "${YELLOW}[INFO] GOOGLE_CLIENT_SECRET is not set (Google OAuth disabled)${NC}"
    elif grep -q 'GOOGLE_CLIENT_SECRET=' "$ENV_FILE"; then
        echo -e "${GREEN}[OK] GOOGLE_CLIENT_SECRET is set${NC}"
    fi

    # Check for Blob token
    if grep -q 'BLOB_READ_WRITE_TOKEN=""' "$ENV_FILE"; then
        echo -e "${YELLOW}[INFO] BLOB_READ_WRITE_TOKEN is not set (file uploads disabled)${NC}"
    elif grep -q 'BLOB_READ_WRITE_TOKEN=' "$ENV_FILE"; then
        echo -e "${GREEN}[OK] BLOB_READ_WRITE_TOKEN is set${NC}"
    fi

    echo ""
    if [ $ISSUES -gt 0 ]; then
        echo -e "${RED}Found $ISSUES security issue(s). Run './scripts/rotate-secrets.sh --generate' for new values.${NC}"
        exit 1
    else
        echo -e "${GREEN}All checks passed!${NC}"
    fi
}

show_help() {
    echo "Secret Rotation Script for Chore Points App"
    echo ""
    echo "Usage: ./scripts/rotate-secrets.sh [option]"
    echo ""
    echo "Options:"
    echo "  --generate    Generate new secrets (prints to stdout)"
    echo "  --check       Check .env for weak/default values"
    echo "  --help        Show this help message"
    echo ""
    echo "Recommended rotation schedule:"
    echo "  - NEXTAUTH_SECRET: Every 90 days or after security incident"
    echo "  - REGISTRATION_SECRET: When shared with unauthorized users"
    echo "  - DATABASE_URL: Every 90 days"
    echo "  - GOOGLE_CLIENT_SECRET: Annually or after compromise"
    echo "  - BLOB_READ_WRITE_TOKEN: Annually or after compromise"
}

# Main
case "${1:-}" in
    --generate)
        generate_secrets
        ;;
    --check)
        check_env
        ;;
    --help|-h)
        show_help
        ;;
    *)
        show_help
        ;;
esac
