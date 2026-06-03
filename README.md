# CCI Planning Claude Design

Planning CCI 2026 - React + Next.js 15 with collaborative real-time sync for multi-user planning.

## 📋 Features

- ✅ Next.js 15 App Router (SSR + API routes)
- ✅ React 19 with TypeScript strict mode
- ✅ Zustand state management
- ✅ Real-time collaborative sync (HTTP polling 5s + Socket.IO)
- ✅ PostgreSQL (Neon) multi-user safe
- ✅ Vercel deployment ready
- ✅ Tailwind CSS v4
- ✅ Device ID auth (no OAuth complexity)

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ LTS
- pnpm 8+
- PostgreSQL (Neon)
- Vercel account

### Local Development

```bash
# Clone repo
git clone https://github.com/StephaneKlint/CCI_Planning_Claude_Design.git
cd CCI_Planning_Claude_Design

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL

# Run dev server
pnpm dev
```

App will be at `http://localhost:3000`

## 📦 Project Structure

```
packages/
├── frontend/          # Next.js 15 app
│   ├── app/          # App Router pages & API routes
│   ├── components/   # React components
│   ├── hooks/        # Custom hooks
│   ├── store/        # Zustand stores
│   ├── lib/          # Utilities & types
│   └── styles/       # CSS
├── shared/           # Shared types & validators
└── migrations/       # Database migrations (Drizzle)
```

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 15, React 19, TypeScript
- **State**: Zustand
- **Styling**: Tailwind CSS v4
- **Real-time**: Socket.IO client
- **Database**: PostgreSQL (Neon) with connection pooling
- **Deploy**: Vercel serverless
- **Testing**: Vitest + React Testing Library

### API Routes
- `GET /api/health` - Health check
- `GET /api/planning` - List plannings
- `POST /api/planning` - Create planning
- `GET /api/planning/[id]` - Get planning
- `PATCH /api/planning/[id]` - Update with version control
- `GET /api/planning/[id]/changes` - Polling sync
- `POST /api/planning/[id]/join` - Register collaborator

## 🔄 Multi-User Sync

Conflict-free sync using:
1. **Optimistic updates** - UI responds immediately
2. **Version control** - increment on every change
3. **HTTP polling** - every 5 seconds
4. **Last-write-wins** - deterministic resolution

## 📊 Database Schema

See `/migrations` folder for Drizzle ORM schema.

Tables:
- `users` - Device ID + sessions
- `plannings` - Main planning data (JSONB)
- `planning_versions` - Audit trail
- `collaborators` - Real-time tracking
- `sessions` - Session store

## 🧪 Testing

```bash
pnpm test                 # Run tests
pnpm test:watch          # Watch mode
pnpm type-check          # TypeScript check
```

## 🚢 Deployment

### Vercel (Recommended)

```bash
# Connect to Vercel
vercel link

# Deploy
vercel deploy
```

Environment variables needed:
- `DATABASE_URL` - PostgreSQL connection string
- `KV_REST_API_URL` - Vercel KV URL
- `KV_REST_API_TOKEN` - Vercel KV token
- `NEXT_PUBLIC_API_BASE` - Frontend API base URL

## 🔐 Security

- ✅ Device ID validation
- ✅ Session cookies (HttpOnly, secure, SameSite)
- ✅ CORS headers
- ✅ Input validation (Zod)
- ✅ SQL injection prevention (parameterized queries)
- ✅ Rate limiting (Vercel)

## 📚 Documentation

- [Architecture Decision Record](./ARCHITECTURE.md) (coming soon)
- [API Docs](./API.md) (coming soon)
- [Contributing Guide](./CONTRIBUTING.md) (coming soon)

## 📝 License

Private project - Stephane Durand @ KLINT

## 🤝 Contributing

See CONTRIBUTING.md for guidelines.
