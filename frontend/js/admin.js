/**
 * admin.js — Lógica del Panel de Administración NeuroAdapt
 *
 * Gestiona: Login JWT, listado de usuarios, creación de estudiantes,
 * listado de cursos, creación de cursos y matrículas.
 */

// ── Configuración ────────────────────────────────────────────────
const API_BASE = "";

// ── RBAC: Barrera de seguridad (solo admins) ─────────────────────
let accessToken = localStorage.getItem("neuroadapt_token") || null;
let currentUser = JSON.parse(localStorage.getItem("neuroadapt_user") || "null");

if (!accessToken || !currentUser || currentUser.role !== "admin") {
    // No es admin → expulsar al login
    localStorage.removeItem("neuroadapt_token");
    localStorage.removeItem("neuroadapt_user");
    window.location.href = "login.html";
}

let usersCache = [];
let coursesCache = [];
let enrollmentLog = [];

// ── Elementos del DOM ────────────────────────────────────────────
const $loginScreen   = document.getElementById("login-screen");
const $dashboard     = document.getElementById("admin-dashboard");
const $loginForm     = document.getElementById("login-form");
const $loginError    = document.getElementById("login-error");
const $pageTitle     = document.getElementById("page-title");
const $userName      = document.getElementById("user-name");
const $userRole      = document.getElementById("user-role");
const $userAvatar    = document.getElementById("user-avatar");
const $btnLogout     = document.getElementById("btn-logout");

// Sections
const $sectionUsers   = document.getElementById("section-users");
const $sectionCourses = document.getElementById("section-courses");
const $sectionEnroll  = document.getElementById("section-enroll");

// Nav buttons
const $navUsers   = document.getElementById("nav-users");
const $navCourses = document.getElementById("nav-courses");
const $navEnroll  = document.getElementById("nav-enroll");

// Forms
const $formCreateUser   = document.getElementById("form-create-user");
const $formCreateCourse = document.getElementById("form-create-course");
const $formEnroll       = document.getElementById("form-enroll");

// ── Utilidades ───────────────────────────────────────────────────

/**
 * Realiza una petición autenticada al backend.
 */
async function apiFetch(path, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
    };

    if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });

    if (res.status === 401) {
        // Token expirado → forzar logout
        showToast("Sesión expirada. Inicia sesión de nuevo.", "error");
        logout();
        throw new Error("Unauthorized");
    }

    return res;
}

/**
 * Muestra un toast notification.
 */
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");

    const colors = {
        success: "bg-emerald-600",
        error:   "bg-red-600",
        info:    "bg-blue-600",
    };

    toast.className = `toast-in ${colors[type] || colors.info} text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg max-w-sm`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transition = "opacity 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

/**
 * Genera iniciales a partir de un nombre.
 */
function initials(name) {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0].toUpperCase())
        .join("");
}

// ── Login ────────────────────────────────────────────────────────

$loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    $loginError.classList.add("hidden");

    const email    = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    try {
        // OAuth2PasswordRequestForm espera form-data, no JSON
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
            throw new Error(err.detail || "Error de autenticación");
        }

        const data = await res.json();
        accessToken = data.access_token;
        currentUser = data.user;

        // Persistir en localStorage
        localStorage.setItem("neuroadapt_token", accessToken);
        localStorage.setItem("neuroadapt_user", JSON.stringify(currentUser));

        enterDashboard();
        showToast(`Bienvenido, ${currentUser.full_name}`, "success");

    } catch (err) {
        $loginError.textContent = err.message;
        $loginError.classList.remove("hidden");
    }
});

function enterDashboard() {
    $loginScreen.classList.add("hidden");
    $dashboard.classList.remove("hidden");
    $dashboard.classList.add("fade-in");

    // Update sidebar user info
    if (currentUser) {
        $userName.textContent = currentUser.full_name;
        $userRole.textContent = currentUser.role;
        $userAvatar.textContent = initials(currentUser.full_name);
    }

    // Load initial data
    loadUsers();
    loadCourses();
    showSection("users");
}

// ── Logout ───────────────────────────────────────────────────────

function logout() {
    accessToken = null;
    currentUser = null;
    localStorage.removeItem("neuroadapt_token");
    localStorage.removeItem("neuroadapt_user");
    window.location.href = "login.html";
}

$btnLogout.addEventListener("click", () => {
    logout();
    showToast("Sesión cerrada", "info");
});

// ── Navigation ───────────────────────────────────────────────────

const sections = {
    users:   { el: $sectionUsers,   nav: $navUsers,   title: "Estudiantes" },
    courses: { el: $sectionCourses, nav: $navCourses, title: "Cursos" },
    enroll:  { el: $sectionEnroll,  nav: $navEnroll,  title: "Matrículas" },
};

function showSection(name) {
    Object.entries(sections).forEach(([key, sec]) => {
        const isActive = key === name;
        sec.el.classList.toggle("hidden", !isActive);
        sec.nav.classList.toggle("bg-slate-100", isActive);
        sec.nav.classList.toggle("text-slate-900", isActive);
        sec.nav.classList.toggle("text-slate-500", !isActive);
    });
    $pageTitle.textContent = sections[name].title;

    // Refresh dropdowns when switching to enroll section
    if (name === "enroll") {
        populateEnrollDropdowns();
    }
}

$navUsers.addEventListener("click", () => showSection("users"));
$navCourses.addEventListener("click", () => showSection("courses"));
$navEnroll.addEventListener("click", () => showSection("enroll"));

// ── Users CRUD ───────────────────────────────────────────────────

async function loadUsers() {
    try {
        const res = await apiFetch("/admin/users");
        if (!res.ok) throw new Error("Error al cargar usuarios");
        usersCache = await res.json();
        renderUsersTable();
    } catch (err) {
        console.error("[ADMIN] loadUsers:", err);
    }
}

function renderUsersTable() {
    const tbody = document.getElementById("users-table-body");
    document.getElementById("users-count").textContent = `${usersCache.length} registros`;

    if (usersCache.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="5" class="px-8 py-8 text-center text-sm text-slate-400">
                No hay usuarios registrados
            </td></tr>`;
        return;
    }

    tbody.innerHTML = usersCache.map(u => `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-8 py-4 text-sm text-slate-600 font-mono">${u.id}</td>
            <td class="px-8 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'} flex items-center justify-center text-xs font-bold">
                        ${initials(u.full_name)}
                    </div>
                    <span class="text-sm font-medium text-slate-900">${u.full_name}</span>
                </div>
            </td>
            <td class="px-8 py-4 text-sm text-slate-600">${u.email}</td>
            <td class="px-8 py-4">
                <span class="px-2.5 py-1 text-xs font-bold rounded-full uppercase tracking-wide ${
                    u.role === 'admin'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                }">${u.role}</span>
            </td>
            <td class="px-8 py-4">
                <span class="inline-flex items-center gap-1.5 text-xs font-semibold ${u.is_active ? 'text-emerald-600' : 'text-red-500'}">
                    <span class="w-2 h-2 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-red-400'}"></span>
                    ${u.is_active ? 'Activo' : 'Inactivo'}
                </span>
            </td>
        </tr>
    `).join("");
}

$formCreateUser.addEventListener("submit", async (e) => {
    e.preventDefault();
    const full_name = document.getElementById("new-user-name").value.trim();
    const email     = document.getElementById("new-user-email").value.trim();
    const password  = document.getElementById("new-user-pass").value;

    try {
        const res = await apiFetch("/admin/users", {
            method: "POST",
            body: JSON.stringify({ full_name, email, password, role: "student" }),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Error al crear usuario");
        }

        const newUser = await res.json();
        showToast(`Estudiante "${newUser.full_name}" creado exitosamente`, "success");
        $formCreateUser.reset();
        await loadUsers();

    } catch (err) {
        showToast(err.message, "error");
    }
});

// ── Courses CRUD ─────────────────────────────────────────────────

async function loadCourses() {
    try {
        const res = await apiFetch("/admin/courses");
        if (!res.ok) throw new Error("Error al cargar cursos");
        coursesCache = await res.json();
        renderCoursesTable();
    } catch (err) {
        console.error("[ADMIN] loadCourses:", err);
    }
}

function renderCoursesTable() {
    const tbody = document.getElementById("courses-table-body");
    document.getElementById("courses-count").textContent = `${coursesCache.length} cursos`;

    if (coursesCache.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="4" class="px-8 py-8 text-center text-sm text-slate-400">
                No hay cursos registrados
            </td></tr>`;
        return;
    }

    tbody.innerHTML = coursesCache.map(c => `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-8 py-4 text-sm text-slate-600 font-mono">${c.id}</td>
            <td class="px-8 py-4 text-sm font-medium text-slate-900">${c.title}</td>
            <td class="px-8 py-4 text-sm text-slate-600">${c.description || '—'}</td>
            <td class="px-8 py-4 text-sm text-slate-500">${c.created_at ? new Date(c.created_at).toLocaleDateString('es-EC') : '—'}</td>
        </tr>
    `).join("");
}

$formCreateCourse.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title       = document.getElementById("new-course-title").value.trim();
    const description = document.getElementById("new-course-desc").value.trim();

    try {
        const res = await apiFetch("/admin/courses", {
            method: "POST",
            body: JSON.stringify({ title, description }),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Error al crear curso");
        }

        const newCourse = await res.json();
        showToast(`Curso "${newCourse.title}" creado exitosamente`, "success");
        $formCreateCourse.reset();
        await loadCourses();

    } catch (err) {
        showToast(err.message, "error");
    }
});

// ── Enrollment ───────────────────────────────────────────────────

function populateEnrollDropdowns() {
    const $userSelect   = document.getElementById("enroll-user");
    const $courseSelect  = document.getElementById("enroll-course");

    // Populate users (students only)
    const students = usersCache.filter(u => u.role === "student");
    $userSelect.innerHTML = '<option value="">Seleccionar estudiante…</option>' +
        students.map(u => `<option value="${u.id}">${u.full_name} (${u.email})</option>`).join("");

    // Populate courses
    $courseSelect.innerHTML = '<option value="">Seleccionar curso…</option>' +
        coursesCache.map(c => `<option value="${c.id}">${c.title}</option>`).join("");
}

$formEnroll.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user_id   = parseInt(document.getElementById("enroll-user").value);
    const course_id = parseInt(document.getElementById("enroll-course").value);

    if (!user_id || !course_id) {
        showToast("Selecciona un estudiante y un curso", "error");
        return;
    }

    try {
        const res = await apiFetch("/admin/enroll", {
            method: "POST",
            body: JSON.stringify({ user_id, course_id }),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Error al matricular");
        }

        const enrollment = await res.json();
        showToast(`${enrollment.user_email} matriculado en "${enrollment.course_title}"`, "success");

        // Add to log
        enrollmentLog.unshift(enrollment);
        renderEnrollmentLog();
        $formEnroll.reset();

    } catch (err) {
        showToast(err.message, "error");
    }
});

function renderEnrollmentLog() {
    const container = document.getElementById("enrollments-list");

    if (enrollmentLog.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-400 text-center py-4">Las matrículas realizadas aparecerán aquí</p>';
        return;
    }

    container.innerHTML = enrollmentLog.map(e => `
        <div class="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div class="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-slate-900">${e.user_email}</p>
                <p class="text-xs text-slate-500">Matriculado en <strong>${e.course_title}</strong></p>
            </div>
            <span class="text-xs text-slate-400">${e.enrolled_at ? new Date(e.enrolled_at).toLocaleString('es-EC') : ''}</span>
        </div>
    `).join("");
}

// ── Init ─────────────────────────────────────────────────────────

(function init() {
    // RBAC ya validó que es admin — entrar directo al dashboard
    if (accessToken && currentUser) {
        enterDashboard();
    }
})();
