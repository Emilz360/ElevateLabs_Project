const signupForm = document.querySelector("#signup-form");
const signupMessage = document.querySelector("#signup-message");
const loginDialog = document.querySelector("#login-dialog");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");

function showMessage(element, message, isError = false, link = "") {
  element.classList.toggle("error", isError);
  element.textContent = message;
  if (link) {
    const a = document.createElement("a");
    a.href = link;
    a.textContent = "Verify account now (development mode)";
    a.rel = "noopener";
    element.appendChild(a);
  }
}

async function postJson(url, data) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed.");
  return result;
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = signupForm.querySelector("button[type=submit]");
  const data = Object.fromEntries(new FormData(signupForm).entries());
  data.terms = signupForm.elements.terms.checked;
  button.disabled = true;
  button.textContent = "Creating your account…";
  showMessage(signupMessage, "");
  try {
    const result = await postJson("/api/signup", data);
    showMessage(signupMessage, result.message, false, result.devVerificationUrl);
    signupForm.reset();
  } catch (error) {
    showMessage(signupMessage, error.message, true);
  } finally {
    button.disabled = false;
    button.innerHTML = 'Create free account <span>→</span>';
  }
});

function openLogin() { loginDialog.showModal(); }
document.querySelector("#open-login").addEventListener("click", openLogin);
document.querySelector("#form-login").addEventListener("click", openLogin);
document.querySelector("#close-login").addEventListener("click", () => loginDialog.close());

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector("button[type=submit]");
  const data = Object.fromEntries(new FormData(loginForm).entries());
  button.disabled = true;
  showMessage(loginMessage, "");
  try {
    await postJson("/api/login", data);
    window.location.href = "/dashboard.html";
  } catch (error) {
    showMessage(loginMessage, error.message, true);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#resend-verification").addEventListener("click", async () => {
  const email = loginForm.elements.email.value.trim();
  if (!email) return showMessage(loginMessage, "Enter your email address first.", true);
  try {
    const result = await postJson("/api/resend-verification", { email });
    showMessage(loginMessage, result.message, false, result.devVerificationUrl);
  } catch (error) {
    showMessage(loginMessage, error.message, true);
  }
});

const verifiedStatus = new URLSearchParams(location.search).get("verified");
if (verifiedStatus === "expired") showMessage(signupMessage, "That verification link is invalid or has expired. Sign in and request a new one.", true);
if (verifiedStatus === "invalid") showMessage(signupMessage, "Invalid verification link.", true);
