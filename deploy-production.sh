#!/bin/bash

# Production Deployment Script for Factory Map Application
# This script pulls the latest code and rebuilds the Docker containers

set -e  # Exit on error

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Factory Map - Production Deployment${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.prod.yml" ]; then
    echo -e "${RED}Error: docker-compose.prod.yml not found!${NC}"
    echo "Please run this script from the project root directory."
    exit 1
fi

# Step 1: Pull latest changes
echo -e "${YELLOW}Step 1: Pulling latest changes from Git...${NC}"
git pull
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Git pull successful${NC}"
else
    echo -e "${RED}✗ Git pull failed${NC}"
    exit 1
fi
echo ""

# Step 2: Stop existing containers
echo -e "${YELLOW}Step 2: Stopping existing containers...${NC}"
sudo docker compose -f docker-compose.prod.yml down
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Containers stopped${NC}"
else
    echo -e "${RED}✗ Failed to stop containers${NC}"
    exit 1
fi
echo ""

# Step 3: Build and start containers
echo -e "${YELLOW}Step 3: Building and starting containers...${NC}"
sudo docker compose -f docker-compose.prod.yml up --build -d
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Containers built and started${NC}"
else
    echo -e "${RED}✗ Failed to build/start containers${NC}"
    exit 1
fi
echo ""

# Step 4: Wait for services to be healthy
echo -e "${YELLOW}Step 4: Waiting for services to be healthy (45 seconds)...${NC}"
for i in {45..1}; do
    echo -ne "${BLUE}  $i seconds remaining...\r${NC}"
    sleep 1
done
echo -e "${GREEN}✓ Wait complete${NC}                      "
echo ""

# Step 5: Check container status
echo -e "${YELLOW}Step 5: Checking container status...${NC}"
sudo docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "NAMES|React_App_Factory_Map|factory_tileserver"
echo ""

# Step 6: Quick health check
echo -e "${YELLOW}Step 6: Running health checks...${NC}"
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8077/)
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8077/api/health)
TILES_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8077/tiles/)

if [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Frontend: OK (HTTP $FRONTEND_STATUS)${NC}"
else
    echo -e "${RED}✗ Frontend: FAILED (HTTP $FRONTEND_STATUS)${NC}"
fi

if [ "$API_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ API Proxy: OK (HTTP $API_STATUS)${NC}"
else
    echo -e "${RED}✗ API Proxy: FAILED (HTTP $API_STATUS)${NC}"
fi

if [ "$TILES_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Tiles Proxy: OK (HTTP $TILES_STATUS)${NC}"
else
    echo -e "${RED}✗ Tiles Proxy: FAILED (HTTP $TILES_STATUS)${NC}"
fi
echo ""

# Step 7: Show access URLs
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Deployment Complete!${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
IP=$(hostname -I | awk '{print $1}')
echo -e "Access the application at:"
echo -e "  ${GREEN}http://$IP:8077${NC}"
echo -e "  ${GREEN}http://ecotech.utlth-ol.si:8077${NC}"
echo ""
echo "Useful commands:"
echo "  ${BLUE}sudo docker ps${NC}                                    # Check container status"
echo "  ${BLUE}sudo docker logs React_App_Factory_Map_Frontend${NC}   # View frontend logs"
echo "  ${BLUE}sudo docker logs React_App_Factory_Map_Backend${NC}    # View backend logs"
echo "  ${BLUE}sudo docker logs factory_tileserver${NC}                # View tileserver logs"
echo "  ${BLUE}./test-deployment.sh${NC}                              # Run full diagnostic test"
echo ""
echo -e "${GREEN}Done!${NC}"

