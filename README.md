# Maintenance Tracker

A web-based vehicle maintenance tracking application built for automotive shops. Designed to be usable on any device including Kindles and low-resolution screens.

---

## Features

- **Vehicle management** — Add and track cars, trucks, motorcycles, boats, ATVs, and more
- **Inspection checklists** — Per-vehicle inspection templates tailored to each vehicle type and subtype
- **Maintenance logs** — Log service history with hours, cost, and notes
- **Mileage tracking** — Record odometer readings over time
- **Todo lists** — Per-vehicle task lists for pending work
- **Cost tracking** — Track parts and labor costs per vehicle
- **Sold vehicle archiving** — Mark vehicles as sold; they're archived, not deleted
- **Messaging** — Direct messages and group chats between shop members
- **Push notifications** — Browser push notifications for installed PWA users
- **Admin portal** — Manage accounts, assignments, and shop-wide settings
- **Help & documentation** — Built-in guide for technicians and operators

---

## User Roles

| Role | Description |
|------|-------------|
| **Admin** | Full access — manages accounts, vehicle assignments, and all shop data |
| **Technician** | Access to all vehicles, inspections, logs, and messaging |
| **Operator (Driver)** | Linked to their own vehicles; can communicate with the shop |

Admin login is accessed by adding `?admin` to the end of the app URL.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | Express.js (v5), TypeScript |
| Database | PostgreSQL via Drizzle ORM |
| Auth | JWT (30-day tokens), bcrypt password hashing |
| Push | Web Push API (VAPID) |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
artifacts/
  dealer-tracker/     # React + Vite frontend
  api-server/         # Express.js REST API
packages/
  db/                 # Drizzle ORM schema and database client
  api-zod/            # Shared Zod validation schemas
  api-client-react/   # React Query hooks for the API
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- PostgreSQL database

### Setup

```bash
# Install dependencies
pnpm install

# Set environment variables
# Create a .env file in the root with:
# DATABASE_URL=postgresql://user:password@host:5432/dbname
# JWT_SECRET=your-secret-key
# VAPID_PUBLIC_KEY=...
# VAPID_PRIVATE_KEY=...
# SITE_PASSWORD=...  (optional shop access password)

# Push the database schema
pnpm --filter @workspace/db run push

# Start the API server
pnpm --filter @workspace/api-server run dev

# Start the frontend (in a separate terminal)
pnpm --filter @workspace/dealer-tracker run dev
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret key for signing JWT tokens |
| `VAPID_PUBLIC_KEY` | No | VAPID public key for push notifications |
| `VAPID_PRIVATE_KEY` | No | VAPID private key for push notifications |
| `SITE_PASSWORD` | No | Optional password to restrict app access |

---

## License

Private — all rights reserved.
