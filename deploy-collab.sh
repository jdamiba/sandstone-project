#!/bin/bash

echo "🚀 Deploying ShareJS Collaboration Server to Railway..."

# Check if Railway CLI is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx is not available. Please install Node.js and npm."
    exit 1
fi

# Login to Railway (if not already logged in)
echo "🔐 Logging into Railway..."
npx @railway/cli login

# Initialize Railway project (if not already initialized)
if [ ! -f ".railway" ]; then
    echo "📁 Initializing Railway project..."
    npx @railway/cli init
fi

# Set environment variables
echo "🔧 Setting environment variables..."
npx @railway/cli variables set DATABASE_URL="$DATABASE_URL"
npx @railway/cli variables set NODE_ENV="production"
npx @railway/cli variables set NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Deploy to Railway
echo "🚀 Deploying to Railway..."
npx @railway/cli up

# Get the deployment URL
echo "🔗 Getting deployment URL..."
DEPLOYMENT_URL=$(npx @railway/cli domain)

echo "✅ Deployment complete!"
echo "🌐 Collaboration server URL: $DEPLOYMENT_URL"
echo ""
echo "📝 Next steps:"
echo "1. Update your .env file with: NEXT_PUBLIC_COLLABORATION_URL=$DEPLOYMENT_URL"
echo "2. Deploy your Next.js app to Vercel with the updated environment variable"
echo "3. Test the collaboration features in production"
