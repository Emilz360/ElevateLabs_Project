require("dotenv").config();

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");
const db = require("./src/db");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const APP_URL = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 24) {
  console.error("Set JWT_SECRET in .env to a random string of at least 24 characters.");
  process.exit(1);
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a little and try again." }
});

function cleanEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function makeToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function setAuthCookie(res, user) {
  const token = jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.cookie("saas_auth", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function requireAuth(req, res, next) {
  try {
    const token = req.cookies.saas_auth;
    if (!token) return res.status(401).json({ error: "Please sign in first." });
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
}

function getMailer() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: String(SMTP_SECURE).toLowerCase() === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

async function sendVerificationEmail(email, verifyUrl) {
  const mailer = getMailer();
  if (!mailer) {
    console.log(`\n[DEV MODE] Verification link for ${email}:\n${verifyUrl}\n`);
    return false;
  }

  await mailer.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: "Verify your AcmeFlow email",
    text: `Welcome to AcmeFlow. Verify your email using this link: ${verifyUrl}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#172033">
        <h1 style="color:#635bff">Welcome to AcmeFlow</h1>
        <p>Thanks for creating an account. Confirm your email address to activate it.</p>
        <p><a href="${verifyUrl}" style="display:inline-block;background:#635bff;color:#fff;padding:13px 22px;border-radius:9px;text-decoration:none;font-weight:bold">Verify my email</a></p>
        <p style="font-size:13px;color:#687386">This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>
      </div>`
  });
  return true;
}

app.post("/api/signup", authLimiter, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim().replace(/\s+/g, " ");
    const email = cleanEmail(req.body.email);
    const password = String(req.body.password || "");
    const company = String(req.body.company || "").trim().slice(0, 100);

    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ error: "Enter a name between 2 and 80 characters." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({ error: "Your password must be at least 8 characters." });
    }
    if (!req.body.terms) {
      return res.status(400).json({ error: "Please accept the terms to continue." });
    }

    const existing = db.prepare("SELECT id, verified FROM users WHERE email = ?").get(email);
    if (existing) {
      if (existing.verified) return res.status(409).json({ error: "An account with this email already exists. Please sign in." });
      return res.status(409).json({ error: "This email is already registered but not verified. Check your inbox or use the resend option." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const rawToken = makeToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    const result = db.prepare(`
      INSERT INTO users (name, email, company, password_hash, verification_token_hash, verification_expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, email, company, passwordHash, tokenHash, expiresAt, Date.now());

    const verifyUrl = `${APP_URL}/api/verify?token=${rawToken}`;
    let emailSent = false;
    try {
      emailSent = await sendVerificationEmail(email, verifyUrl);
    } catch (mailError) {
      console.error("Email delivery failed:", mailError.message);
    }

    const response = {
      message: emailSent
        ? "Account created. Check your email for the verification link."
        : "Account created. Email is not configured, so use the development verification link."
    };
    if (process.env.NODE_ENV !== "production" && !emailSent) response.devVerificationUrl = verifyUrl;
    return res.status(201).json(response);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong while creating your account." });
  }
});

app.get("/api/verify", (req, res) => {
  const token = String(req.query.token || "");
  if (!token) return res.redirect("/?verified=invalid");
  const tokenHash = hashToken(token);
  const user = db.prepare(`
    SELECT id, name, email FROM users
    WHERE verification_token_hash = ? AND verification_expires_at > ?
  `).get(tokenHash, Date.now());

  if (!user) return res.redirect("/?verified=expired");
  db.prepare(`
    UPDATE users SET verified = 1, verification_token_hash = NULL, verification_expires_at = NULL
    WHERE id = ?
  `).run(user.id);
  setAuthCookie(res, user);
  return res.redirect("/dashboard.html");
});

app.post("/api/resend-verification", authLimiter, async (req, res) => {
  const email = cleanEmail(req.body.email);
  const user = db.prepare("SELECT id, verified FROM users WHERE email = ?").get(email);
  // Do not reveal whether an email address is registered.
  if (!user || user.verified) return res.json({ message: "If the account needs verification, a new link will be sent." });

  const rawToken = makeToken();
  db.prepare(`
    UPDATE users SET verification_token_hash = ?, verification_expires_at = ? WHERE id = ?
  `).run(hashToken(rawToken), Date.now() + 24 * 60 * 60 * 1000, user.id);

  const verifyUrl = `${APP_URL}/api/verify?token=${rawToken}`;
  try {
    const sent = await sendVerificationEmail(email, verifyUrl);
    const payload = { message: "If the account needs verification, a new link will be sent." };
    if (process.env.NODE_ENV !== "production" && !sent) payload.devVerificationUrl = verifyUrl;
    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to send the email right now." });
  }
});

app.post("/api/login", authLimiter, async (req, res) => {
  const email = cleanEmail(req.body.email);
  const password = String(req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }
  if (!user.verified) return res.status(403).json({ error: "Please verify your email before signing in." });
  setAuthCookie(res, user);
  res.json({ message: "Signed in successfully." });
});

app.get("/api/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT id, name, email, company, created_at FROM users WHERE id = ? AND verified = 1").get(req.auth.id);
  if (!user) return res.status(401).json({ error: "Account not found." });
  res.json({ user });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("saas_auth", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
  res.json({ message: "Signed out." });
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`AcmeFlow is running at ${APP_URL}`);
  console.log("Database: SQLite (created automatically in ./data)");
});
