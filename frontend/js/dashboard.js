/**
 * dashboard.js — Lógica del panel de estudiante
 */

const API_BASE = "http://localhost:8080";

// ── 1. Verificación de Autenticación ─────────────────────────────
const accessToken = localStorage.getItem("neuroadapt_token");
const userRaw = localStorage.getItem("neuroadapt_user");

if (!accessToken || !userRaw) {
    // Si no hay token o datos de usuario, redirigir inmediatamente al login
    window.location.href = "login.html";
}

const currentUser = JSON.parse(userRaw);

// ── 2. Inicialización de UI ──────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    // Rellenar datos del usuario en la sidebar
    const $userName = document.getElementById("user-name");
    const $userRole = document.getElementById("user-role");
    const $userAvatar = document.getElementById("user-avatar");
    
    if ($userName && $userRole && $userAvatar) {
        $userName.textContent = currentUser.full_name;
        $userRole.textContent = currentUser.role === "admin" ? "Administrador" : "Estudiante";
        
        // Generar iniciales (ej. "Juan Pérez" -> "JP")
        const initials = currentUser.full_name
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map(n => n[0].toUpperCase())
            .join("");
        $userAvatar.textContent = initials;
    }

    // Configurar el botón de cerrar sesión
    const $btnLogout = document.getElementById("btn-logout");
    if ($btnLogout) {
        $btnLogout.addEventListener("click", () => {
            localStorage.removeItem("neuroadapt_token");
            localStorage.removeItem("neuroadapt_user");
            window.location.href = "login.html";
        });
    }

    // Cargar cursos
    loadMyCourses();
});

// ── 3. Cargar datos del Backend ──────────────────────────────────
async function loadMyCourses() {
    const $container = document.getElementById("courses-container");
    const $count = document.getElementById("courses-count");
    
    if (!$container) return;

    try {
        const response = await fetch(`${API_BASE}/student/my-courses`, {
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        });

        if (response.status === 401) {
            // Token expirado o inválido
            localStorage.removeItem("neuroadapt_token");
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error("Error al cargar cursos");
        }

        const courses = await response.json();
        
        if ($count) {
            $count.textContent = `${courses.length} curso(s)`;
        }

        if (courses.length === 0) {
            $container.innerHTML = `
                <div class="text-center py-6 bg-slate-50 rounded-xl border border-slate-100">
                    <p class="text-sm text-slate-500">No estás matriculado en ningún curso aún.</p>
                </div>
            `;
            return;
        }

        // Renderizar tarjetas
        $container.innerHTML = courses.map(c => `
            <div class="group flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer">
                <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round"
                            d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                        ${c.title}
                    </p>
                    <p class="text-xs text-slate-500 mt-1 truncate">${c.description || 'Sin descripción'}</p>
                </div>
                <span class="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-wide">Activo</span>
            </div>
        `).join("");

    } catch (err) {
        console.error("Error cargando cursos:", err);
        $container.innerHTML = `
            <div class="text-center py-6 bg-red-50 rounded-xl border border-red-100">
                <p class="text-sm text-red-500">Error al cargar cursos. Intenta nuevamente.</p>
            </div>
        `;
    }
}
