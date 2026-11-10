async function loadAccount() {
  try {
    const response = await fetch("/api/me");
    if (!response.ok) throw new Error("Not signed in");
    const { user } = await response.json();
    document.querySelector("#user-name").textContent = user.name.split(" ")[0];
    document.querySelector("#account-name").textContent = user.name;
    document.querySelector("#account-email").textContent = user.email;
    document.querySelector("#account-company").textContent = user.company || "Not provided";
  } catch {
    window.location.href = "/";
  }
}
document.querySelector("#logout").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/";
});
loadAccount();
