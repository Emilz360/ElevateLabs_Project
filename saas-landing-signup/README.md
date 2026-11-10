# FocalPoint — SaaS landing page + sign-up workflow

A complete starter project for the assignment: a conversion-focused landing page, validated sign-up, email verification, SQLite lead/account storage, login, and a protected welcome dashboard.

## Technology choices

- HTML, CSS and vanilla JavaScript for the frontend (no build step).
- Node.js + Express for the backend.
- SQLite via `better-sqlite3` instead of MongoDB. SQLite is simpler to install and run locally because it does not require a separate database server.
- Nodemailer for verification emails.
- bcryptjs for password hashing and JWT in an HttpOnly cookie for the signed-in session.

## Requirements

- Node.js 20 or newer
- npm
- Optional: an SMTP account to send real verification emails

## Run locally

1. Extract the ZIP and open the `saas-landing-signup` folder in VS Code.
2. Open a terminal in that folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Create your environment file:

   - Windows PowerShell: `Copy-Item .env.example .env`
   - macOS/Linux/Kali: `cp .env.example .env`

5. Open `.env`. Set `JWT_SECRET` to a long random value. For example, use a password generator. Keep this secret private.
6. Start the app:

   ```bash
   npm run dev
   ```

   Or use `npm start`.

7. Open **http://localhost:3000** in your browser.

The SQLite database is created automatically at `data/app.db` on first run.

## Test the complete workflow without SMTP

SMTP is optional for local development. If SMTP is not configured, the server prints a verification URL in the terminal and the sign-up form displays a development verification link.

1. Register using a name, email and password of at least 8 characters.
2. Find the development verification URL in the page response or terminal.
3. Open that link in the same browser.
4. The link verifies the account and signs you in.
5. The protected dashboard displays the account details.
6. Log out, then use **Log in** to test signing in again.

## Configure real email delivery

For Gmail, enable 2-Step Verification on the Google account and create an **App Password**. Do not use your normal Gmail password.

Fill in `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-google-app-password
EMAIL_FROM="FocalPoint <your-email@gmail.com>"
APP_URL=http://localhost:3000
```

Restart the server after changing `.env`. Check spam/junk if the email does not appear. Some email providers require different SMTP host, port and security settings.

## Important project files

```text
saas-landing-signup/
├── public/
│   ├── index.html       # Landing page and sign-up/login forms
│   ├── styles.css       # Responsive design
│   ├── app.js           # Frontend form requests and messages
│   ├── dashboard.html   # Post-verification dashboard
│   └── dashboard.js    # Loads the signed-in user's details
├── src/
│   └── db.js            # SQLite database and users table
├── data/                # Created automatically; contains app.db
├── server.js            # Express API, validation, email and auth
├── .env.example         # Environment variable template
├── .gitignore
└── package.json
```

## API routes

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/signup` | Validate and store a new account |
| GET | `/api/verify?token=...` | Verify email and sign the user in |
| POST | `/api/resend-verification` | Send a fresh verification link |
| POST | `/api/login` | Sign in verified users |
| GET | `/api/me` | Return current user's account details |
| POST | `/api/logout` | Clear the authentication cookie |
| GET | `/health` | Basic server health check |

## Notes before production

This is a working educational project, not a fully audited production SaaS. Before public deployment, add HTTPS, a real domain, stronger abuse protection, CSRF protection if you expand cookie-authenticated state-changing routes, privacy/terms pages, email delivery monitoring, database backups, and secure secret management. Set `NODE_ENV=production`, set `APP_URL` to your HTTPS domain, and configure SMTP. Never expose `.env` or commit it to GitHub.

The form collects a company/team name as an optional lead field. The account record is stored in SQLite; the password is stored only as a bcrypt hash. Verification tokens are stored as SHA-256 hashes and expire after 24 hours.
