# HabitzPro — Backend

A production-ready **Node.js + Express + MongoDB** REST API powering the HabitzPro habit tracker frontend.

---

## Tech Stack

| Layer       | Technology                                   |
|-------------|----------------------------------------------|
| Runtime     | Node.js ≥ 18                                 |
| Framework   | Express 4                                    |
| Database    | MongoDB (Mongoose 8 ODM)                     |
| Auth        | JWT (jsonwebtoken) + bcryptjs                |
| Validation  | express-validator                            |
| File upload | Multer                                       |
| Rate limit  | express-rate-limit                           |
| Logging     | Morgan                                       |

---

## Project Structure

```
habitzpro-backend/
├── src/
│   ├── server.js              ← Express app entry point
│   ├── config/
│   │   └── db.js              ← MongoDB connection
│   ├── models/
│   │   ├── User.js            ← User schema + password hashing
│   │   └── Habit.js           ← Habit schema + streak logic
│   ├── controllers/
│   │   ├── authController.js  ← register, login, forgot/reset password
│   │   ├── userController.js  ← profile, avatar, theme
│   │   └── habitController.js ← full CRUD + toggle + analytics
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── userRoutes.js
│   │   └── habitRoutes.js
│   └── middleware/
│       ├── auth.js            ← JWT protect middleware
│       ├── errorHandler.js    ← central error handler + asyncHandler
│       └── upload.js          ← Multer avatar upload config
├── uploads/                   ← avatar images (git-ignored)
├── api.js                     ← Drop into your frontend folder
├── .env.example
├── .gitignore
└── package.json
```

---

## Quick Start

### 1. Install dependencies

```bash
cd habitzpro-backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/habitzpro
JWT_SECRET=your_super_secret_key_at_least_32_chars
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:3000,http://127.0.0.1:5500
MAX_AVATAR_SIZE_MB=2
UPLOAD_DIR=uploads
```

> **MongoDB Atlas (cloud):** Replace `MONGODB_URI` with your Atlas connection string:
> `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/habitzpro`

### 3. Run the server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

Server starts at: **http://localhost:5000**
Health check: **http://localhost:5000/api/health**

---

## Connect to Frontend

1. Copy `api.js` into your HTML project folder (next to `dashboard.html`).
2. Add this `<script>` tag **before** your page's own scripts in every HTML file:

```html
<script src="api.js"></script>
```

3. Replace the existing `localStorage`-based login in `login.html`:

```html
<!-- REPLACE the handleLogin function in login.html -->
<script>
async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  btn.textContent = 'Signing in…';
  btn.style.pointerEvents = 'none';

  try {
    await HabitzAPI.AuthAPI.login({
      email:    document.getElementById('email').value.trim(),
      password: document.getElementById('password').value,
    });
    window.location.href = 'dashboard.html';
  } catch (err) {
    btn.textContent = 'Sign In';
    btn.style.pointerEvents = '';
    alert(err.message);
  }
}
</script>
```

4. Replace the signup handler in `signup.html`:

```html
<script>
async function handleSignup(e) {
  e.preventDefault();
  const pw  = document.getElementById('password').value;
  const cfm = document.getElementById('confirm').value;
  if (pw !== cfm) { alert('Passwords do not match!'); return; }

  const btn = document.getElementById('signupBtn');
  btn.textContent = 'Creating account…';
  btn.style.pointerEvents = 'none';

  try {
    await HabitzAPI.AuthAPI.register({
      firstName: document.getElementById('fname').value.trim(),
      lastName:  document.getElementById('lname').value.trim(),
      email:     document.getElementById('email').value.trim(),
      password:  pw,
    });
    window.location.href = 'dashboard.html';
  } catch (err) {
    btn.textContent = 'Create Account';
    btn.style.pointerEvents = '';
    alert(err.message);
  }
}
</script>
```

5. Protect the dashboard by adding this at the **very top** of `dashboard.html`'s script block:

```js
(async () => {
  await HabitzAPI.requireAuth('login.html');
  // rest of your dashboard JS...
})();
```

6. Replace the `handleLogout` function in `dashboard.html`:

```js
window.handleLogout = function() {
  HabitzAPI.AuthAPI.logout();
};
```

---

## API Reference

### Base URL
```
http://localhost:5000/api
```

### Authentication
All protected routes require:
```
Authorization: Bearer <jwt_token>
```

---

### Auth Endpoints

| Method | Endpoint                  | Auth | Description                  |
|--------|---------------------------|------|------------------------------|
| POST   | `/auth/register`          | ✗    | Create account               |
| POST   | `/auth/login`             | ✗    | Sign in, get JWT             |
| GET    | `/auth/me`                | ✓    | Get current user             |
| PUT    | `/auth/update-profile`    | ✓    | Update name / email / bio    |
| PUT    | `/auth/change-password`   | ✓    | Change password              |
| POST   | `/auth/forgot-password`   | ✗    | Request reset code           |
| POST   | `/auth/reset-password`    | ✗    | Reset with code              |
| POST   | `/auth/logout`            | ✓    | Invalidate session (client)  |

**POST /auth/register**
```json
{
  "firstName": "Arjun",
  "lastName":  "Kumar",
  "email":     "arjun@example.com",
  "password":  "mypassword123"
}
```

**POST /auth/login**
```json
{ "email": "arjun@example.com", "password": "mypassword123" }
```

**Response (register / login):**
```json
{
  "success": true,
  "token":   "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id":          "664abc...",
    "firstName":   "Arjun",
    "lastName":    "Kumar",
    "displayName": "Arjun Kumar",
    "email":       "arjun@example.com",
    "bio":         "",
    "avatarUrl":   "",
    "theme":       "light",
    "initials":    "AK"
  }
}
```

---

### User Endpoints

| Method | Endpoint          | Description                |
|--------|-------------------|----------------------------|
| GET    | `/users/profile`  | Full profile               |
| POST   | `/users/avatar`   | Upload avatar (multipart)  |
| DELETE | `/users/avatar`   | Remove avatar              |
| PUT    | `/users/theme`    | Save theme preference      |
| DELETE | `/users/account`  | Delete account + all data  |

**POST /users/avatar** — multipart/form-data, field name: `avatar`

**PUT /users/theme**
```json
{ "theme": "dark" }
```

---

### Habit Endpoints

| Method | Endpoint                         | Description                        |
|--------|----------------------------------|------------------------------------|
| GET    | `/habits`                        | All habits (query: category, search)|
| POST   | `/habits`                        | Create habit                       |
| GET    | `/habits/:id`                    | Get one habit                      |
| PUT    | `/habits/:id`                    | Update habit                       |
| DELETE | `/habits/:id`                    | Delete habit                       |
| PATCH  | `/habits/:id/toggle`             | Toggle today's completion          |
| PATCH  | `/habits/:id/date`               | Toggle any date                    |
| PATCH  | `/habits/:id/chart-cell`         | Toggle tracking chart cell         |
| PATCH  | `/habits/:id/goal`               | Update day goal                    |
| PATCH  | `/habits/:id/archive`            | Archive / unarchive                |
| GET    | `/habits/analytics/summary`      | Full analytics data                |
| GET    | `/habits/analytics/achievements` | Achievements + milestones          |

**POST /habits**
```json
{
  "name":     "Morning Run",
  "emoji":    "🏃",
  "category": "Health",
  "note":     "Run at least 20 mins",
  "goal":     30
}
```

**PATCH /habits/:id/toggle** — no body required

**PATCH /habits/:id/date**
```json
{ "date": "2026-03-15" }
```

**PATCH /habits/:id/chart-cell**
```json
{ "year": 2026, "month": 2, "day": 15 }
```
*(month is 0-indexed: 0=January … 11=December)*

**GET /habits/analytics/summary** — Response:
```json
{
  "success": true,
  "analytics": {
    "totalHabits":    5,
    "completedToday": 3,
    "completionRate": 60,
    "bestStreak":     12,
    "last7Days":      [{ "date": "2026-03-13", "completed": 3, "total": 5 }, ...],
    "last4Weeks":     [{ "week": "W1", "completed": 18 }, ...],
    "last6Months":    [{ "month": "Oct", "completed": 72 }, ...],
    "habitBreakdown": [{ "id": "...", "name": "Morning Run", "streak": 12, ... }]
  }
}
```

---

## Deployment

### MongoDB Atlas (Free tier)
1. Create account at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a free cluster
3. Add your IP to the allowlist
4. Copy the connection string into `.env`

### Render / Railway / Fly.io
```bash
# Set environment variables in the platform's dashboard, then:
npm start
```

### Environment variables for production
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=<64-char random hex>
CLIENT_ORIGIN=https://yourdomain.com
```

> Generate a secure JWT secret:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

---

## Data Models

### User
```
firstName, lastName, displayName, email, password (hashed),
bio, avatarUrl, theme (light|dark),
resetPasswordToken, resetPasswordExpires,
createdAt, updatedAt
```

### Habit
```
user (ref), name, emoji, category, note,
completedDates: [YYYY-MM-DD],
chartCells: [{ year, month, day, ticked }],
goal (days), streak (cached),
isArchived,
createdAt, updatedAt
```

---

## License
MIT — free to use and extend.
