const API_BASE = "";
const $regForm = document.getElementById("register-form");
const $regError = document.getElementById("reg-error");
const $regSuccess = document.getElementById("reg-success");
const $btn = document.getElementById("reg-btn");

$regForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    $regError.classList.add("hidden");

    const full_name = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const student_id = document.getElementById("reg-studentid").value.trim();
    const password = document.getElementById("reg-password").value;

    try {
        $btn.disabled = true;
        $btn.textContent = "Registrando...";

        const payload = {
            full_name,
            email,
            student_id,
            password
        };

        const res = await fetch(`${API_BASE}/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            let errMessage = "Error interno del servidor.";
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                const err = await res.json();
                errMessage = err.detail || errMessage;
            }
            throw new Error(errMessage);
        }

        // Éxito
        $regForm.classList.add("hidden");
        $regSuccess.classList.remove("hidden");

    } catch (err) {
        $regError.textContent = err.message;
        $regError.classList.remove("hidden");
    } finally {
        $btn.disabled = false;
        $btn.textContent = "Crear Cuenta";
    }
});
