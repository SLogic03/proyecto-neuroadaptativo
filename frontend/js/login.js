/**
 * login.js — Lógica de inicio de sesión unificada (estudiantes y admins)
 *
 * Redirección basada en roles (RBAC):
 *   - admin   → admin.html
 *   - student → dashboard.html
 */

const API_BASE = "http://localhost:8080";
const $loginForm = document.getElementById("student-login-form");
const $loginError = document.getElementById("login-error");

// ── Si ya hay sesión activa, redirigir según rol ─────────────────
const existingToken = localStorage.getItem("neuroadapt_token");
const existingUser  = JSON.parse(localStorage.getItem("neuroadapt_user") || "null");

if (existingToken && existingUser) {
    window.location.href = existingUser.role === "admin" ? "admin.html" : "dashboard.html";
}

// ── Login ────────────────────────────────────────────────────────
$loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    $loginError.classList.add("hidden");

    const email    = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const btn      = document.getElementById("login-btn");

    try {
        btn.disabled = true;
        btn.textContent = "Iniciando…";

        // FastAPI OAuth2PasswordRequestForm expects form-data
        const formData = new URLSearchParams();
        formData.append("username", email);
        formData.append("password", password);

        const res = await fetch(`${API_BASE}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData,
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Credenciales incorrectas");
        }

        const data = await res.json();

        // Guardar token y usuario
        localStorage.setItem("neuroadapt_token", data.access_token);
        localStorage.setItem("neuroadapt_user", JSON.stringify(data.user));

        // Redirigir según rol (RBAC)
        if (data.user.role === "admin") {
            window.location.href = "admin.html";
        } else {
            window.location.href = "dashboard.html";
        }

    } catch (err) {
        $loginError.textContent = err.message;
        $loginError.classList.remove("hidden");
    } finally {
        btn.disabled = false;
        btn.textContent = "Entrar";
    }
});
