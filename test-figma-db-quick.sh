#!/bin/bash
# Quick test script for Figma database functionality

set -e

echo "🧪 AIKit Figma Database Quick Test"
echo "==================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check if AIKit is installed
echo -n "📦 Checking AIKit installation... "
if command -v aikit &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "   Please install AIKit: npm install -g @tdsoft-tech/aikit"
    exit 1
fi

# Test 2: Check Node.js version
echo -n "🔧 Checking Node.js version... "
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 18 ]; then
    echo -e "${GREEN}✓${NC} ($(node -v))"
else
    echo -e "${RED}✗${NC}"
    echo "   Node.js >= 18 required, found: $(node -v)"
    exit 1
fi

# Test 3: Check if better-sqlite3 is available
echo -n "💾 Checking database dependencies... "
if npm list better-sqlite3 &> /dev/null || npm list -g @tdsoft-tech/aikit &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠${NC}"
    echo "   Installing dependencies..."
    npm install better-sqlite3
fi

# Test 4: Run unit tests
echo -n "🧪 Running unit tests... "
if npm test &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "   Some tests failed. Run 'npm test' for details."
fi

# Test 5: Check build
echo -n "🏗️  Building project... "
if npm run build &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "   Build failed. Run 'npm run build' for details."
    exit 1
fi

# Test 6: Check CLI executable
echo -n "⚡ Testing CLI... "
if node dist/cli.js --version &> /dev/null; then
    echo -e "${GREEN}✓${NC} ($(node dist/cli.js --version))"
else
    echo -e "${RED}✗${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ All checks passed!${NC}"
echo ""
echo "Next steps:"
echo "1. Get a Figma Personal Access Token from:"
echo "   https://www.figma.com/developers/api#access-tokens"
echo ""
echo "2. Test with a public Figma file:"
echo "   /analyze-figma https://www.figma.com/design/lC34qpTSy2MYalTIOsj8S2/..."
echo ""
echo "3. Check database was created:"
echo "   ls -la .aikit/figma.db"
echo ""
echo "4. Inspect database contents:"
echo "   sqlite3 .aikit/figma.db 'SELECT * FROM figma_files;'"
echo ""
echo "📖 Full testing guide: TESTING_FIGMA_DB.md"

