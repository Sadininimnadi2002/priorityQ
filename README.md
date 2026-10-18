# PriorityQ - Smart Digital Token and Priority-Based Queue Management

MERN stack project: React + Bootstrap frontend, Node/Express API, MongoDB with Mongoose, JWT auth.

## 1. Run the backend

Requirements: Node.js 18+ and MongoDB (local install or a free MongoDB Atlas cluster).

```bash
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
# open .env and set MONGO_URI and JWT_SECRET
npm run seed                # creates demo services + accounts
npm run dev                 # API on http://localhost:5000
npm test                    # unit tests for the priority algorithm
```

Demo accounts created by `npm run seed`:

| Role  | Email                  | Password   | Notes                    |
|-------|------------------------|------------|--------------------------|
| Admin | admin@priorityq.com    | Admin@123  |                          |
| Staff | staff1@priorityq.com   | Staff@123  | assigned to General Enquiry |
| Staff | staff2@priorityq.com   | Staff@123  | assigned to Billing      |
| User  | user@priorityq.com     | User@123   |                          |

If `npm install` fails on `bcrypt` (rare, usually missing build tools), replace it with `bcryptjs`:
`npm uninstall bcrypt && npm i bcryptjs`, then change `require('bcrypt')` to `require('bcryptjs')` in `models/User.js`.

## 2. Run the frontend

Keep the backend running in one terminal, then in a second terminal:

```bash
cd frontend
npm install
cp .env.example .env        # Windows: copy .env.example .env
npm run dev                 # opens on http://localhost:5173
```

`CLIENT_URL` in `backend/.env` must match the frontend address (default `http://localhost:5173`), or the browser will block requests (CORS).

### Try the whole flow in the browser

1. Open two different browsers (or one normal + one private window).
2. Window A: log in as `user@priorityq.com`, open **Services**, join **General Enquiry**, open **My token**.
3. Window B: log in as `staff1@priorityq.com`, open **Active queue**. The token appears within 5 seconds.
4. In window B click **Priority**, choose Urgent and give a reason. Then open **Counter** and click **Call next token**.
5. Window A updates within 10 seconds and shows "It's your turn".
6. In window B click **Start serving**, then **Complete**.
7. Log in as `admin@priorityq.com`: see the dashboard numbers, **Reports** (including the priority change you made), and manage users, staff and services.

### Frontend pages

| Role | Pages |
|---|---|
| Public | Home, Log in, Create account |
| User | Dashboard, Services, My token, History, Profile |
| Staff | Dashboard, Active queue, Counter (queue controls), History, Profile |
| Admin | Dashboard (with all queues), Users, Staff, Services, Reports (with priority history), and all staff pages for any service |

## 3. Test the API with Postman, in this order

All protected routes need the header `Authorization: Bearer <token>`.

1. `GET  /api/health`
2. `POST /api/auth/login` body `{"email":"user@priorityq.com","password":"User@123"}` -> copy `token`
3. `GET  /api/services` -> copy a service `_id`
4. `POST /api/queue/join` body `{"serviceId":"<id>"}` -> you get a token like `GEN-001` with position and ETA
5. `GET  /api/queue/my-active`
6. Log in as `staff1@priorityq.com` -> copy that token
7. `GET  /api/staff/queues/<serviceId>` -> live queue in priority order
8. `PATCH /api/staff/queue/<entryId>/priority` body `{"priority":"URGENT","reason":"Elderly customer"}`
9. `POST /api/staff/queues/<serviceId>/call-next`, then `PATCH .../serve`, then `PATCH .../complete`
10. Log in as admin -> `GET /api/admin/stats`, `/api/admin/priority-logs`, `/api/admin/reports?days=7`
11. Security checks: the user token on `GET /api/staff/my-service` must return **403**; no token must return **401**.

To test several customers, register more users with `POST /api/auth/register` (each can hold one active token).

## 4. API reference

| Method | Endpoint | Access |
|---|---|---|
| POST | /api/auth/register | public |
| POST | /api/auth/login | public |
| GET / PUT | /api/auth/me | logged in |
| GET | /api/services, /api/services/:id | public |
| POST / PUT / DELETE | /api/services, /api/services/:id | admin |
| PATCH | /api/services/:id/status `{isActive}` | admin |
| POST | /api/queue/join `{serviceId}` | user |
| GET | /api/queue/my-active, /api/queue/history | user |
| DELETE | /api/queue/:id/leave | user |
| GET | /api/staff/my-service | staff/admin |
| GET | /api/staff/queues/:serviceId | staff/admin |
| POST | /api/staff/queues/:serviceId/call-next | staff/admin |
| PATCH | /api/staff/queue/:id/call, serve, complete, skip, restore | staff/admin |
| PATCH | /api/staff/queue/:id/priority `{priority, reason}` | staff/admin |
| PATCH | /api/staff/service/:serviceId/queue-status `{status}` | staff/admin |
| GET | /api/staff/stats/:serviceId, /api/staff/history/:serviceId | staff/admin |
| GET / POST / PUT / DELETE | /api/admin/users, /api/admin/users/:id | admin |
| PATCH | /api/admin/staff/:id/assign `{serviceId}` | admin |
| GET | /api/admin/queues, /priority-logs, /stats, /reports | admin |

Staff can only act on **their assigned service**; admins can act on any.

## 5. How the queue algorithm works (`backend/utils/priorityEngine.js`)

1. **Priority**: EMERGENCY, then URGENT, then NORMAL.
2. **Join time**: earlier joiners first within the same level.
3. **Aging (fairness A)**: every `AGING_MINUTES` (default 20) a waiting person moves up one level, but never above URGENT, so nobody can overtake an EMERGENCY just by waiting.
4. **Streak (fairness B)**: after `MAX_HIGH_STREAK` (default 3) high-priority calls in a row, the next call is the oldest NORMAL person. The streak only counts while NORMAL people are waiting.
5. **Estimated wait** = (people ahead + people being served) x average service minutes. The average starts as the configured value and blends in real completion times after 5 completed tokens.

Set either value to `0` in `.env` to switch that mechanism off.

## 6. Queue status rules

- WAITING -> CALLED -> SERVING -> COMPLETED
- WAITING/CALLED -> SKIPPED -> (restore) WAITING
- WAITING/CALLED -> CANCELLED (customer leaves)
- Queue OPEN: joins allowed, calling allowed. PAUSED: no joins, no new calls. CLOSED: no joins, staff can still call people already waiting.

## 7. Folder structure

```
backend/
  config/       database connection
  models/       User, Service, QueueEntry, PriorityLog
  middleware/   auth (JWT + roles), validators, central error handler
  controllers/  auth, service, queue, staff, admin
  routes/       URL -> controller mapping
  utils/        priorityEngine (pure algorithm), queueService (DB helpers), helpers
  tests/        algorithm unit tests
  seed.js       demo data
  server.js     app entry point

frontend/src/
  services/     api.js (axios + JWT interceptor), endpoints.js (one function per API call)
  context/      AuthContext: logged-in user, login, register, logout
  hooks/        usePolling (auto refresh), useStaffService (which service staff pages show)
  components/   navbar, route guards, token ticket, badges, modal, stats
  pages/        public/, user/, staff/, admin/
  utils/        formatting helpers and shared constants
```

## 8. Git

```bash
git add .
git commit -m "feat: add React frontend with role-based dashboards, live token tracking and staff counter"
git push
```
