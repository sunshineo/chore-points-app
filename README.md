# Chore Points App

A family chore management and rewards system built with Next.js, TypeScript, and PostgreSQL.

## Features

- Parent and Kid roles with different permissions
- Chore management (CRUD operations for parents)
- Points ledger with full audit trail
- Reward system with redemption approval workflow
- Multi-provider authentication (Email, Google, Apple)
- Family invite code system

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5
- **Styling**: Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or use a free provider like Neon or Supabase)

### Setup

1. Install dependencies (already done):
   ```bash
   npm install
   ```

2. Set up your environment variables:
   ```bash
   cp .env.example .env
   ```

3. Update the `.env` file with your database connection string and other credentials:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
   - Optional: Google/Apple OAuth credentials

4. Generate Prisma client and run migrations:
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Schema

The app uses the following main models:

- **User**: Parent or Kid accounts with role-based access
- **Family**: Container for users with unique invite codes
- **Chore**: Reusable chores with default point values
- **PointEntry**: Ledger of all point additions/deductions (includes audit trail)
- **Reward**: Items kids can redeem with their points
- **Redemption**: Requests for rewards with approval workflow

## Development Status

- [x] Phase 1: Project Setup & Database Schema
- [ ] Phase 2: Authentication & Family Setup
- [ ] Phase 3: Chores Management
- [ ] Phase 4: Points Ledger
- [ ] Phase 5: Rewards & Redemption
- [ ] Phase 6: Polish & Testing

## Project Structure

```
chore-points-app/
├── src/
│   ├── app/              # Next.js App Router pages and API routes
│   ├── components/       # Reusable React components
│   ├── lib/             # Utility functions and configurations
│   └── types/           # TypeScript type definitions
├── prisma/
│   └── schema.prisma    # Database schema
└── public/              # Static assets
```

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new) from the creators of Next.js.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
