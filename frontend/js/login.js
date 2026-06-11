/**
 * login.js — Lógica de inicio de sesión para estudiantes
 */

const API_BASE = "http://localhost:8080";
const $loginForm = document.getElementById("student-login-form");
const $loginError = document.getElementById("login-error");

// Si ya hay sesión activa (token), redirigir al dashboard
if (localStorage.getItem("neuroadapt_token")) {
    window.location.href = "dashboard.html";
}

$loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    $loginError.classList.add("hidden");

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const btn = document.getElementById("login-btn");

    try {
        btn.disabled = true;
        btn.textContent = "Iniciando...";

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

        // Redirigir al dashboard
        window.location.href = "dashboard.html";

    } catch (err) {
        $loginError.textContent = err.message;
        $loginError.classList.remove("hidden");
    } finally {
        btn.disabled = false;
        btn.textContent = "Entrar";
    }
});
