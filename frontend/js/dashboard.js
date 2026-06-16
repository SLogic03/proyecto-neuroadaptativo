/**
 * dashboard.js — Lógica del panel de estudiante
 */

const API_BASE = "";

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

        // Renderizar tarjetas mejoradas estilo Moodle
        $container.innerHTML = courses.map(c => `
            <div onclick="window.location.href='reading.html?courseId=${c.id}'"
                 class="group bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-200 cursor-pointer overflow-hidden flex flex-col">
                
                <!-- Top Header / Image Area -->
                <div class="h-24 bg-gradient-to-r from-slate-800 to-blue-900 relative">
                    <div class="absolute inset-0 bg-black/10"></div>
                </div>

                <!-- Course Info -->
                <div class="p-5 flex-1 flex flex-col">
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Módulo</p>
                    <p class="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors duration-200 line-clamp-2">
                        ${c.title}
                    </p>
                    <p class="text-sm text-slate-500 mt-2 line-clamp-2 flex-1">${c.description || 'Sin descripción'}</p>
                </div>

                <!-- Simulated Progress Bar -->
                <div class="px-5 pb-5 mt-auto">
                    <div class="flex items-center justify-between text-xs text-slate-500 mb-2">
                        <span class="font-medium">Progreso general</span>
                        <span class="font-bold text-slate-700">0%</span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-blue-600 h-1.5 rounded-full" style="width: 0%"></div>
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
