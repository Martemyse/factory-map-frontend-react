#!/bin/bash

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Factory Map Deployment Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Test 1: Check containers are running
echo -e "${YELLOW}1. Checking Docker containers...${NC}"
if sudo docker ps | grep -q "React_App_Factory_Map"; then
    echo -e "${GREEN}✓ Containers are running${NC}"
    sudo docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "React_App_Factory_Map|factory_tileserver"
else
    echo -e "${RED}✗ Containers not running${NC}"
    exit 1
fi
echo ""

# Test 2: Check container health
echo -e "${YELLOW}2. Checking container health...${NC}"
FRONTEND_HEALTH=$(sudo docker inspect React_App_Factory_Map_Frontend --format='{{.State.Health.Status}}' 2>/dev/null || echo "no healthcheck")
BACKEND_HEALTH=$(sudo docker inspect React_App_Factory_Map_Backend --format='{{.State.Health.Status}}' 2>/dev/null || echo "no healthcheck")
TILESERVER_HEALTH=$(sudo docker inspect factory_tileserver --format='{{.State.Health.Status}}' 2>/dev/null || echo "no healthcheck")

echo "Frontend: $FRONTEND_HEALTH"
echo "Backend: $BACKEND_HEALTH"
echo "Tileserver: $TILESERVER_HEALTH"
echo ""

# Test 3: Check port 8087 is listening
echo -e "${YELLOW}3. Checking port 8087...${NC}"
if sudo netstat -tulpn | grep -q ":8087"; then
    echo -e "${GREEN}✓ Port 8087 is listening${NC}"
else
    echo -e "${RED}✗ Port 8087 is NOT listening${NC}"
    exit 1
fi
echo ""

# Test 4: Test frontend HTML
echo -e "${YELLOW}4. Testing frontend (http://localhost:8087/)...${NC}"
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8087/)
if [ "$FRONTEND_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ Frontend responding (HTTP $FRONTEND_RESPONSE)${NC}"
else
    echo -e "${RED}✗ Frontend failed (HTTP $FRONTEND_RESPONSE)${NC}"
fi
echo ""

# Test 5: Test Nginx health endpoint
echo -e "${YELLOW}5. Testing Nginx health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s http://localhost:8087/health)
if [ "$HEALTH_RESPONSE" = "healthy" ]; then
    echo -e "${GREEN}✓ Nginx health check passed${NC}"
else
    echo -e "${RED}✗ Nginx health check failed${NC}"
fi
echo ""

# Test 6: Test API proxy
echo -e "${YELLOW}6. Testing API proxy (http://localhost:8087/api/health)...${NC}"
API_RESPONSE=$(curl -s http://localhost:8087/api/health)
if echo "$API_RESPONSE" | grep -q "healthy"; then
    echo -e "${GREEN}✓ API proxy working${NC}"
    echo "Response: $API_RESPONSE"
else
    echo -e "${RED}✗ API proxy failed${NC}"
    echo "Response: $API_RESPONSE"
fi
echo ""

# Test 7: Test tileserver proxy
echo -e "${YELLOW}7. Testing tileserver proxy (http://localhost:8087/tiles/)...${NC}"
TILES_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8087/tiles/)
if [ "$TILES_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ Tileserver proxy working (HTTP $TILES_RESPONSE)${NC}"
else
    echo -e "${RED}✗ Tileserver proxy failed (HTTP $TILES_RESPONSE)${NC}"
fi
echo ""

# Test 8: Test tile JSON
echo -e "${YELLOW}8. Testing tile JSON (http://localhost:8087/tiles/data/LTH_factory.json)...${NC}"
TILEJSON_RESPONSE=$(curl -s http://localhost:8087/tiles/data/LTH_factory.json | jq -r '.id' 2>/dev/null)
if [ "$TILEJSON_RESPONSE" = "LTH_factory" ]; then
    echo -e "${GREEN}✓ Tile JSON accessible${NC}"
else
    echo -e "${RED}✗ Tile JSON failed (got: $TILEJSON_RESPONSE)${NC}"
fi
echo ""

# Test 9: Get hostname/IP
echo -e "${YELLOW}9. External access URLs...${NC}"
HOSTNAME=$(hostname)
IP=$(hostname -I | awk '{print $1}')
echo "Hostname: $HOSTNAME"
echo "IP Address: $IP"
echo ""
echo "Access from browser:"
echo -e "${GREEN}http://$IP:8087${NC}"
echo -e "${GREEN}http://ecotech.utlth-ol.si:8087${NC}"
echo ""

# Test 10: Check Nginx config
echo -e "${YELLOW}10. Checking Nginx configuration...${NC}"
if sudo docker exec React_App_Factory_Map_Frontend nginx -t 2>&1 | grep -q "successful"; then
    echo -e "${GREEN}✓ Nginx configuration is valid${NC}"
else
    echo -e "${RED}✗ Nginx configuration has errors${NC}"
    sudo docker exec React_App_Factory_Map_Frontend nginx -t
fi
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "1. All services should be accessible through port 8087 ONLY"
echo "2. Ports 7998 and 7999 should NOT be exposed to host"
echo "3. Nginx routes:"
echo "   - / → Static React app"
echo "   - /api/ → Backend (7998)"
echo "   - /tiles/ → Tileserver (80)"
echo ""
echo "To check logs:"
echo "  sudo docker logs React_App_Factory_Map_Frontend"
echo "  sudo docker logs React_App_Factory_Map_Backend"
echo "  sudo docker logs factory_tileserver"
echo ""
echo -e "${GREEN}Test complete!${NC}"

