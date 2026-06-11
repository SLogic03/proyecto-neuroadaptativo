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
            localStorage.removeItem("neuroadapt_user");
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
                <div class="text-center py-12 px-8 bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-2xl border border-slate-200">
                    <div class="w-16 h-16 mx-auto mb-5 bg-blue-100 rounded-2xl flex items-center justify-center">
                        <svg class="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                    </div>
                    <h4 class="text-base font-bold text-slate-800 mb-2">Aún no tienes módulos asignados</h4>
                    <p class="text-sm text-slate-500 max-w-xs mx-auto">Por favor, comunícate con el administrador de la ESPE para que te asigne tus cursos de inducción.</p>
                </div>
            `;
            return;
        }

        // Renderizar tarjetas mejoradas
        $container.innerHTML = courses.map(c => `
            <div onclick="window.location.href='reading.html?courseId=${c.id}'"
                 class="group relative bg-white rounded-2xl border border-slate-200 p-5 cursor-pointer
                        hover:shadow-xl hover:-translate-y-1 hover:border-blue-300
                        transition-all duration-300 overflow-hidden">
                <!-- Accent bar -->
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors duration-300">
                        <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors duration-200 truncate">
                            ${c.title}
                        </p>
                        <p class="text-xs text-slate-500 mt-1 truncate">${c.description || 'Sin descripción'}</p>
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                        <span class="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-wide">Activo</span>
                        <svg class="w-5 h-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all duration-200" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                    </div>
                </div>
            </div>
        `).join("");

    } catch (err) {
        console.error("Error cargando cursos:", err);
        $container.innerHTML = `
            <div class="text-center py-8 bg-red-50 rounded-xl border border-red-100">
                <p class="text-sm text-red-600 font-medium">Error al cargar cursos. Verifica tu conexión e intenta nuevamente.</p>
            </div>
        `;
    }
}
