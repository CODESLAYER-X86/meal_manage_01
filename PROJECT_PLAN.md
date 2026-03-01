# 🍽️ Meal Management App — Project Plan & Documentation

## 📋 Project Overview

A web app for managing meals in a **student mess** (shared kitchen) housing **5 students** from different departments. The app replaces the old Google Sheets system that was prone to cheating.

### The Problem
- The previous meal manager **reduced his own meal count by 2** in Google Sheets — caught cheating
- No audit trail in spreadsheets = no accountability
- Manual calculations are error-prone
- No transparency for members

### The Solution
A web app where:
- **Only the meal manager** can edit meals, deposits, and bazar entries
- **Every single edit is logged** in an audit trail (anti-cheat)
- **All members can view** everything for full transparency
- **Automatic billing** calculations — no manual math
- Runs **24/7 on the cloud** — no need to keep any computer on

---

## 👥 Mess Members

| Name    | Email             | Role    | Phone        |
|---------|-------------------|---------|--------------|
| Omar    | omar@mess.com     | Manager | 01700000001  |
| Jahid   | jahid@mess.com    | Member  | 01700000002  |
| Zobayer | zobayer@mess.com  | Member  | 01700000003  |
| Kabbo   | kabbo@mess.com    | Member  | 01700000004  |
| Mahbub  | mahbub@mess.com   | Member  | 01700000005  |

**Default password for all:** `123456`

---

## 🛠️ Tech Stack

| Technology       | Purpose                          | Why chosen                              |
|------------------|----------------------------------|-----------------------------------------|
| **Next.js 16**   | Frontend + Backend (App Router)  | Full-stack in one, great for Vercel     |
| **TypeScript**   | Type safety                      | Fewer bugs                              |
| **Tailwind CSS** | Styling                          | Fast, no CSS files needed               |
| **Prisma 7**     | Database ORM                     | Easy DB queries, auto migrations        |
| **Neon PostgreSQL** | Cloud database (free tier)    | Free, never expires, always online      |
| **NextAuth v5**  | Authentication                   | Login/logout, role-based access         |
| **bcryptjs**     | Password hashing                 | Secure password storage                 |
| **Vercel**       | Hosting (free tier)              | Free, 24/7, auto-deploys from GitHub    |

### Why NOT Django?
- Originally planned Django, but **Netlify can't host Python**
- Switched to Next.js which Vercel hosts for free
- Better for "vibe coding" — everything in one language (TypeScript)

---

## 📁 Project Structure

```
meal-app/
├── prisma/
│   ├── schema.prisma          # Database models (9 tables)
│   ├── seed.ts                # Seeds 5 members into DB
│   └── migrations/            # Auto-generated DB migrations
├── prisma.config.ts           # Prisma 7 config (DB URL, seed command)
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout with Navbar + SessionProvider
│   │   ├── page.tsx           # Redirects to /dashboard
│   │   ├── login/page.tsx     # Login form (email + password)
│   │   ├── dashboard/page.tsx # Home — stats cards, quick actions
│   │   ├── calendar/page.tsx  # Monthly calendar — click date for details
│   │   ├── transparency/page.tsx  # All members' meals & deposits side-by-side
│   │   ├── audit-log/page.tsx # Every edit ever made (anti-cheat)
│   │   ├── billing/page.tsx   # Monthly bill calculation breakdown
│   │   ├── manager/
│   │   │   ├── meals/page.tsx     # Edit B/L/D for each member (Manager only)
│   │   │   ├── deposits/page.tsx  # Record deposits (Manager only)
│   │   │   ├── bazar/page.tsx     # Bazar entries with dynamic items (Manager only)
│   │   │   ├── members/page.tsx   # Add/manage members (Manager only)
│   │   │   └── handover/page.tsx  # Transfer manager role (Manager only)
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts  # NextAuth handler
│   │       ├── meals/route.ts       # GET/POST meals
│   │       ├── deposits/route.ts    # GET/POST deposits
│   │       ├── bazar/route.ts       # GET/POST bazar trips + items
│   │       ├── billing/route.ts     # GET monthly bill calculation
│   │       ├── members/route.ts     # GET/POST members
│   │       ├── manager/route.ts     # GET current manager / POST handover
│   │       ├── washroom/route.ts    # GET/POST/PATCH washroom duties
│   │       └── audit-log/route.ts   # GET audit log entries
│   ├── components/
│   │   ├── Navbar.tsx         # Navigation bar (role-aware links)
│   │   └── SessionProvider.tsx # NextAuth session wrapper
│   ├── lib/
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── auth.ts            # NextAuth config (credentials, JWT, roles)
│   │   ├── audit.ts           # Audit log helper functions
│   │   └── billing.ts         # Monthly bill calculation logic
│   └── types/
│       └── next-auth.d.ts     # TypeScript types for auth session
├── .env                       # Environment variables (NOT committed)
├── package.json
├── tsconfig.json
└── next.config.ts
```

---

## 🗄️ Database Schema (9 Tables)

### User
- id, name, email, password, phone, role (MANAGER/MEMBER), isActive, joinDate, leaveDate

### MealEntry
- id, date, memberId, breakfast (0/0.5/1), lunch (0/0.5/1), dinner (0/0.5/1), total
- Unique on (date + memberId)

### Deposit
- id, date, memberId, amount, note

### BazarTrip
- id, date, buyerId, totalCost, note
- Has many BazarItems

### BazarItem
- id, tripId, serialNo, itemName, quantity, unit (kg/g/litre/ml/pcs/packet/dozen), price

### WashroomCleaning
- id, date, memberId, status (PENDING/DONE/SKIPPED), note

### ManagerRotation
- id, memberId, month, year
- Unique on (month + year)

### AuditLog (Anti-Cheat System)
- id, editedById, tableName, recordId, fieldName, oldValue, newValue, action, createdAt
- **Every single edit** is recorded — who changed what, when, from what to what

### Dispute
- id, memberId, tableName, recordId, message, resolved

---

## 💰 Billing Formula (from Excel)

```
Total Cost     = Sum of all bazar trip costs in the month
Total Meals    = Sum of all members' meal totals in the month
Meal Rate      = Total Cost / Total Meals
Person's Bill  = Person's Total Meals × Meal Rate
Net Due        = Person's Deposit - Person's Bill
```

- **Positive Net Due** = mess owes the person money (overpaid)
- **Negative Net Due** = person owes the mess money (underpaid)

---

## 🔐 Authentication & Authorization

### Roles
- **MANAGER**: Can edit meals, deposits, bazar entries, add members, handover role
- **MEMBER**: Can only view everything (read-only transparency)

### Auth Flow
1. User logs in with email + password
2. NextAuth creates a JWT token with user ID and role
3. Every API route checks the session and role before allowing edits
4. Manager-only pages redirect non-managers

---

## 📱 Pages & Features

### For Everyone (All Members)
| Page | What it does |
|------|-------------|
| `/dashboard` | Personal stats — my meals, my deposits, meal rate, net due |
| `/calendar` | Monthly calendar grid — click any date to see meals + bazar |
| `/transparency` | Side-by-side view of ALL members' meals and deposits |
| `/audit-log` | Every edit ever made — filterable by table type |
| `/billing` | Monthly bill breakdown — total cost, meal rate, per-person |

### Manager Only
| Page | What it does |
|------|-------------|
| `/manager/meals` | Set B/L/D for each member on a given date |
| `/manager/deposits` | Record money deposits from members |
| `/manager/bazar` | Log bazar trips with dynamic item rows (SL, Item, Qty, Unit, Price) |
| `/manager/members` | Add new members, view member list |
| `/manager/handover` | Transfer manager role to another member |

---

## 🚀 Deployment Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Browser    │────▶│   Vercel     │────▶│  Neon Database  │
│ (Phone/PC)  │◀────│  (Next.js)   │◀────│  (PostgreSQL)   │
└─────────────┘     └──────────────┘     └─────────────────┘
     User              Free hosting         Free database
                       24/7 online          24/7 online
```

- **Vercel**: Hosts the app (free, auto-deploys from GitHub)
- **Neon**: Hosts the PostgreSQL database (free tier, no expiry)
- **GitHub**: Stores the code (push to deploy)

---

## 📝 Step-by-Step Work Log

### Phase 1: Planning
1. ✅ Discussed project requirements (meal tracking for 5 students)
2. ✅ Analyzed the existing Excel file (`meal-february-2026.xlsx`)
   - Sheet1: Daily meals (B/L/D) for 5 members + bazar items + billing formulas
   - Deposit sheet: Daily deposits for each member
3. ✅ Identified critical feature: **Audit log** (after catching manager cheating)
4. ✅ Listed all features: meals, deposits, bazar, billing, calendar, transparency, washroom, manager rotation

### Phase 2: Tech Stack Decision
5. ✅ Initially planned **Django** (Python)
6. ✅ Discovered Netlify can't host Django → switched to **Next.js + Vercel**
7. ✅ Final stack: Next.js 16 + Prisma 7 + Neon PostgreSQL + Vercel

### Phase 3: Project Setup
8. ✅ Created Next.js project with `create-next-app`
9. ✅ Installed dependencies: prisma, @prisma/client, next-auth, bcryptjs, date-fns
10. ✅ Initialized Neon database via `neonctl`
11. ✅ Created Prisma schema with all 9 models

### Phase 4: Backend Development
12. ✅ Created `src/lib/prisma.ts` — Prisma client singleton
13. ✅ Created `src/lib/auth.ts` — NextAuth config with credentials + JWT + roles
14. ✅ Created `src/lib/audit.ts` — Audit log helper functions
15. ✅ Created `src/lib/billing.ts` — Monthly bill calculation logic
16. ✅ Created all 9 API routes (meals, deposits, bazar, billing, members, manager, washroom, audit-log, auth)

### Phase 5: Frontend Development
17. ✅ Created `SessionProvider` and `Navbar` components
18. ✅ Created login page with email/password form
19. ✅ Created dashboard with personal stats and quick actions
20. ✅ Created calendar page with monthly grid and date details
21. ✅ Created transparency page (all members side-by-side)
22. ✅ Created audit log page with table filter
23. ✅ Created billing page with formula breakdown
24. ✅ Created manager pages: meals, deposits, bazar, members, handover

### Phase 6: Database & Deployment
25. ✅ Fixed Prisma 7 compatibility (removed `url` from schema, added driver adapter)
26. ✅ Ran `prisma migrate dev --name init` — all 9 tables created in Neon
27. ✅ Generated Prisma client
28. ✅ Seeded database with 5 members (Omar as Manager, others as Members)
29. ✅ Build tested — **all 23 routes compile successfully**
30. ✅ Initialized git repo, committed all code
31. ✅ Pushed to GitHub: `CODESLAYER-X86/meal_manage_01`
32. 🔄 **Deploying on Vercel** (in progress)

### Phase 7: Post-Deployment (TODO)
33. ⬜ Verify Vercel deployment works
34. ⬜ Test login with all 5 members
35. ⬜ Test meal entry, deposit, and bazar flows
36. ⬜ Change default passwords
37. ⬜ Share URL with mess members

---

## ⚙️ Environment Variables

These are set in **Vercel** (not in the code):

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgresql://neondb_owner:REDACTED@ep-polished-meadow-aiinjitm-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require` |
| `NEXTAUTH_SECRET` | `REDACTED` |

---

## 🔧 Useful Commands (for development)

```bash
# Start dev server
npm run dev

# Run database migration
npx prisma migrate dev --name <migration_name>

# Generate Prisma client after schema changes
npx prisma generate

# Seed database
npx prisma db seed

# Build for production
npx prisma generate && next build

# View database in browser
npx prisma studio
```

---

## 🐛 Known Issues & Notes

1. **This dev environment** cannot connect to Neon via Node.js (outbound TCP blocked) — but Vercel can
2. Database was seeded via Neon MCP tools (SQL) instead of the seed script
3. Prisma 7 requires driver adapters — using `@prisma/adapter-neon` for the app
4. The `prisma.config.ts` handles the datasource URL (not `schema.prisma`)
5. Build command on Vercel must be `npx prisma generate && next build`

---

*Last updated: March 2, 2026*
