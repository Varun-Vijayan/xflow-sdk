#!/bin/bash

echo "🧪 XFlow SDK Local Testing"
echo "=========================="

# Step 1: Check if POC infrastructure is available
echo "🔍 Checking POC infrastructure..."
if [ ! -d "../xflow-poc" ]; then
    echo "❌ ../xflow-poc directory not found!"
    echo "   Please ensure the POC project is in a sibling directory"
    exit 1
fi

# Step 2: Start POC infrastructure
echo "🐳 Starting Temporal infrastructure..."
cd ../xflow-poc

# Generate fresh certificates and JWT if needed
if [ ! -f "src/auth/admin-token.jwt" ]; then
    echo "🔑 Generating JWT tokens and certificates..."
    node src/auth/generate-jwt.js
    node src/auth/generate-ssl-certificates.js
fi

# Start infrastructure
echo "🚀 Starting Docker services..."
docker-compose down
docker-compose up -d

# Wait for services
echo "⏳ Waiting for services to start..."
sleep 20

# Test connectivity
echo "🔍 Testing Temporal connectivity..."
curl -f -s http://localhost:8234 > /dev/null && echo "   ✅ Temporal UI accessible" || echo "   ❌ Temporal UI not accessible"

# Step 3: Build and test SDK
echo "📦 Building XFlow SDK..."
cd ../xflow-sdk
npm run build

# Step 4: Run the test
echo "🎯 Running SDK test..."
npm run test:example

echo ""
echo "🎉 Test completed!"
echo ""
echo "📊 Services:"
echo "   - Temporal Server: localhost:7233"
echo "   - Temporal UI: http://localhost:8234"
echo ""
echo "🛑 To stop infrastructure: cd ../xflow-poc && docker-compose down" 