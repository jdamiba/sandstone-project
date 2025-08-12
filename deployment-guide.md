# Deployment Guide

## Environment Variables

### Production Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Collaboration Server
NEXT_PUBLIC_COLLABORATION_URL=https://your-collab-server.railway.app
COLLABORATION_PORT=3002

# App Configuration
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NODE_ENV=production
```

## Deployment Options

### Option 1: Vercel + Railway (Recommended)

#### Frontend (Vercel)

1. Connect GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

#### Collaboration Server (Railway)

1. Create new Railway project
2. Connect GitHub repository
3. Set environment variables
4. Deploy collaboration server

### Option 2: Railway All-in-One

1. Create Railway project
2. Add both Next.js app and collaboration server
3. Configure environment variables
4. Deploy both services together

### Option 3: Render

1. Create Render account
2. Deploy Next.js app as Web Service
3. Deploy collaboration server as Web Service
4. Configure environment variables

## Configuration Files

### Railway Configuration (railway.toml)

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"
healthcheckPath = "/"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
```

### Docker Configuration (Dockerfile)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000 3002

CMD ["npm", "start"]
```

## Production Checklist

- [ ] Environment variables configured
- [ ] Database SSL enabled
- [ ] Clerk webhooks configured
- [ ] Collaboration server deployed
- [ ] CORS configured for collaboration server
- [ ] Health checks implemented
- [ ] Monitoring and logging set up
- [ ] SSL certificates configured
- [ ] Domain names configured
- [ ] CDN configured (optional)
