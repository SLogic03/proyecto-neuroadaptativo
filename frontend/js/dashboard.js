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
function formatTime(seconds) {
    if (!seconds) return "0 min";
    if (seconds < 60) return `${seconds} seg`;
    const m = Math.floor(seconds / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    return `${m} min`;
}

function renderStats(globalProgress, totalTime, totalCompleted, totalChapters) {
    const container = document.getElementById("stats-container");
    if (!container) return;
    
    container.innerHTML = `
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div class="flex flex-col h-full justify-between">
                <div>
                    <p class="text-xs font-semibold tracking-widest uppercase text-slate-400 mb-2">Progreso Global</p>
                    <p class="text-3xl font-bold text-slate-900">${globalProgress}<span class="text-lg text-slate-400 ml-1">%</span></p>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-1.5 mt-4 overflow-hidden">
                    <div class="bg-blue-600 h-1.5 rounded-full" style="width: ${globalProgress}%"></div>
                </div>
            </div>
        </div>
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <p class="text-xs font-semibold tracking-widest uppercase text-slate-400 mb-2">Tiempo Total</p>
            <p class="text-3xl font-bold text-slate-900">${formatTime(totalTime)}</p>
        </div>
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <p class="text-xs font-semibold tracking-widest uppercase text-slate-400 mb-2">Quizzes Completados</p>
            <p class="text-3xl font-bold text-slate-900">${totalCompleted}<span class="text-lg text-slate-400 ml-1">/ ${totalChapters || 0}</span></p>
        </div>
    `;
}

function fillSidebarCourses(courses) {
    const container = document.getElementById("sidebar-courses-list");
    if (!container) return;
    container.innerHTML = courses.map(c => `
        <a href="reading.html?courseId=${c.id}" 
           class="flex items-center gap-2 px-4 py-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 text-sm transition-all">
            <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            ${c.title}
        </a>
    `).join("");
}

function renderCourseCards(courses, $container) {
    $container.innerHTML = courses.map(c => {
        const total = c.total_chapters || 0;
        const comp = (c.completed_quizzes || []).length;
        const progress = total > 0 ? Math.round((comp / total) * 100) : 0;
        const timeFmt = formatTime(c.time_spent_seconds);
        
        const lockedClass = c.locked ? "opacity-60 grayscale cursor-not-allowed" : "hover:shadow-md cursor-pointer";
        const clickAttr = c.locked ? "" : `onclick="window.location.href='reading.html?courseId=${c.id}'"`;
        const lockIcon = c.locked ? `
            <div class="absolute inset-0 bg-slate-900/40 flex items-center justify-center z-10 backdrop-blur-[1px]">
                <div class="bg-white/90 p-3 rounded-full shadow-lg">
                    <svg class="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                </div>
            </div>
        ` : "";

        return `
            <div ${clickAttr}
                 class="group bg-white rounded-xl shadow-sm transition-shadow duration-300 border border-slate-200 overflow-hidden flex flex-col relative ${lockedClass}">
                
                ${lockIcon}
                
                <div class="h-24 bg-gradient-to-r from-slate-800 to-blue-900 relative">
                    <div class="absolute inset-0 bg-black/10"></div>
                </div>

                <div class="p-5 flex-1 flex flex-col">
                    <div class="flex justify-between items-start mb-1">
                        <p class="text-xs font-semibold text-slate-500 uppercase tracking-widest">Módulo</p>
                        <span class="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md font-medium">${timeFmt}</span>
                    </div>
                    <p class="text-base font-bold text-slate-900 ${c.locked ? '' : 'group-hover:text-blue-700'} transition-colors duration-200 line-clamp-2">
                        ${c.title}
                    </p>
                    <p class="text-sm text-slate-500 mt-2 line-clamp-2 flex-1">${c.description || 'Sin descripción'}</p>
                </div>

                <div class="px-5 pb-5 mt-auto">
                    <div class="flex items-center justify-between text-xs text-slate-500 mb-2">
                        <span class="font-medium">Hoja ${c.current_chapter_index + 1} de ${total || 1}</span>
                        <span class="font-bold text-slate-700">${progress}%</span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-blue-600 h-1.5 rounded-full" style="width: ${progress}%"></div>
                    </div>
                </div>
            </div>
        `;
    }).join("");
}

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
                <div class="col-span-full text-center py-12 px-8 bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-2xl border border-slate-200">
                    <div class="w-16 h-16 mx-auto mb-5 bg-blue-100 rounded-2xl flex items-center justify-center">
                        <svg class="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                    </div>
                    <h4 class="text-base font-bold text-slate-800 mb-2">Aún no tienes módulos asignados</h4>
                    <p class="text-sm text-slate-500 max-w-xs mx-auto">Por favor, comunícate con el administrador de la ESPE para que te asigne tus cursos de inducción.</p>
                </div>
            `;
            renderStats(0, 0, 0, 0);
            return;
        }

        let totalChapters = 0, totalCompleted = 0, totalTime = 0;
        courses.forEach(c => {
            totalChapters += c.total_chapters || 0;
            totalCompleted += (c.completed_quizzes || []).length;
            totalTime += c.time_spent_seconds || 0;
        });
        
        const globalProgress = totalChapters > 0 ? Math.round((totalCompleted / totalChapters) * 100) : 0;
        
        renderStats(globalProgress, totalTime, totalCompleted, totalChapters);
        renderCourseCards(courses, $container);
        fillSidebarCourses(courses);

    } catch (err) {
        console.error("Error cargando cursos:", err);
        $container.innerHTML = `
            <div class="col-span-full text-center py-8 bg-red-50 rounded-xl border border-red-100">
                <p class="text-sm text-red-600 font-medium">Error al cargar cursos. Verifica tu conexión e intenta nuevamente.</p>
            </div>
        `;
    }
}
