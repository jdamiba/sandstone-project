# Sandstone Setup Instructions

## Environment Variables

Create a `.env.local` file in your project root with the following variables:

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_c3RlcmxpbmctcHJpbWF0ZS0wLmNsZXJrLmFjY291bnRzLmRldiQ
CLERK_SECRET_KEY=sk_test_GaQ7HHaN6oz7UCln5dV2kQd0sgonDAGg3H4yN4fu7l
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Neon PostgreSQL Database
DATABASE_URL=postgresql://username:password@hostname/database?sslmode=require

# Application
NODE_ENV=development
```

## Database Setup

### Option 1: Neon PostgreSQL (Recommended)

1. **Create a Neon account** at [neon.tech](https://neon.tech)
2. **Create a new project** and database
3. **Copy the connection string** from your Neon dashboard
4. **Add it to your `.env.local`** as `DATABASE_URL`
5. **Run the schema** using Neon's SQL editor or psql:

```bash
# Using the initialization script (recommended)
npm run db:init

# Using psql with Neon connection string
psql "your-neon-connection-string" -f database-schema.sql

# Or copy and paste the schema into Neon's SQL editor
```

### Option 2: Local PostgreSQL

1. **Install PostgreSQL** if you haven't already
2. **Create a database** named `sandstone`
3. **Run the schema** from `database-schema.sql`:

```bash
psql -d sandstone -f database-schema.sql
```

## Clerk Webhook Configuration

1. **Go to your Clerk Dashboard**
2. **Navigate to Webhooks** in the sidebar
3. **Create a new webhook endpoint**:
   - **Endpoint URL**: `https://your-domain.com/api/webhooks/clerk`
   - **Events to send**: Select all user events (`user.created`, `user.updated`, `user.deleted`)
4. **Copy the webhook secret** and add it to your `.env.local` file as `CLERK_WEBHOOK_SECRET`

## Testing the Setup

### Database Connection

```bash
# Test database connection
npm run db:test
```

### Webhook Testing

1. **Start your development server**: `npm run dev`
2. **Sign up a new user** through your app
3. **Check the console logs** for webhook processing messages
4. **Verify in your database** that the user was created

## API Endpoints

### Webhook Handler

- **POST** `/api/webhooks/clerk` - Handles Clerk webhook events

### Authentication Utilities

- `getCurrentUser()` - Gets current user and syncs with database
- `checkDocumentPermission()` - Checks user permissions for documents
- `getUserDocuments()` - Gets user's documents

## Database Functions

The webhook handler automatically:

- ✅ Creates new users when they sign up
- ✅ Updates user data when they modify their profile
- ✅ Soft deletes users when they delete their account
- ✅ Maintains user activity timestamps

## Troubleshooting

### Webhook Not Working

1. Check that `CLERK_WEBHOOK_SECRET` is set correctly
2. Verify the webhook URL is accessible
3. Check server logs for webhook processing errors

### Database Connection Issues

1. Verify `DATABASE_URL` is set correctly in `.env.local`
2. Check that your Neon database is active
3. Ensure the database and tables exist
4. Verify SSL connection settings for Neon

### User Sync Issues

1. Check that the webhook is receiving events
2. Verify database permissions
3. Check for constraint violations in logs
