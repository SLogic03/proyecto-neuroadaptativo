/**
 * reading.js — Lógica para renderizar dinámicamente el contenido del curso
 */

const API_BASE = "http://localhost:8080";

// ── 1. Verificación de Autenticación ─────────────────────────────
const accessToken = localStorage.getItem("neuroadapt_token");

if (!accessToken) {
    window.location.href = "login.html";
}

// ── 2. Inicialización ────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    // Extraer courseId de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('courseId');

    if (!courseId) {
        showError("ID de curso no proporcionado en la URL.");
        return;
    }

    loadCourseData(courseId);
});

// ── 3. Cargar datos del curso ────────────────────────────────────
async function loadCourseData(courseId) {
    try {
        const response = await fetch(`${API_BASE}/student/courses/${courseId}`, {
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        });

        if (response.status === 401) {
            localStorage.removeItem("neuroadapt_token");
            window.location.href = "login.html";
            return;
        }

        if (response.status === 403) {
            showError("No estás matriculado en este curso.");
            return;
        }

        if (!response.ok) {
            throw new Error("Error al cargar los datos del curso.");
        }

        const course = await response.json();
        renderCourse(course);

    } catch (err) {
        console.error("Error:", err);
        showError("Hubo un problema al cargar el contenido del curso.");
    }
}

// ── 4. Renderizar contenido ──────────────────────────────────────
function renderCourse(course) {
    const $title = document.getElementById("course-title");
    const $content = document.getElementById("reading-content");
    const $sidebar = document.getElementById("sidebar");

    // 4.1 Actualizar el título
    if ($title) {
        $title.textContent = course.title;
    }

    // 4.2 Renderizar el contenido JSON en HTML
    if ($content && course.content_data) {
        let htmlContent = `
            <!-- Focus Guide (Hidden by default, can be toggled by LLM via telemetry.js) -->
            <div id="reading-focus-guide" class="hidden"></div>
        `;
        
        // Asumiendo que content_data es un array de objetos con "section" y "text" o un string JSON
        let data = course.content_data;
        if (typeof data === "string") {
            try {
                data = JSON.parse(data);
            } catch (e) {
                console.error("Error parsing content_data:", e);
                data = [];
            }
        }

        if (Array.isArray(data)) {
            data.forEach((item, index) => {
                htmlContent += `
                    <h3 id="section-${index}" class="text-xl font-bold mt-8 mb-4">${item.section || ''}</h3>
                    <p class="mb-4 text-justify">${item.text || ''}</p>
                `;
            });
        } else {
            htmlContent += `<p>${String(data)}</p>`;
        }

        $content.innerHTML = htmlContent;

        // 4.3 Generar Menú Lateral de forma opcional (si hay secciones)
        if (Array.isArray(data) && data.length > 0) {
            const $nav = $sidebar.querySelector('nav');
            if ($nav) {
                // Añadir un divisor y el título del índice
                const indexHtml = `
                    <div class="my-6 border-t border-slate-100"></div>
                    <p class="px-4 mb-4 text-xs font-semibold tracking-widest uppercase text-slate-400">Índice del Curso</p>
                    ${data.map((item, idx) => `
                        <a href="#section-${idx}" class="flex items-center gap-3 px-4 py-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium text-xs transition-all truncate" title="${item.section}">
                            <div class="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                            ${item.section}
                        </a>
                    `).join('')}
                `;
                $nav.insertAdjacentHTML('beforeend', indexHtml);
            }
        }
    } else if ($content) {
        $content.innerHTML = `<p class="text-slate-500 italic">Este curso no tiene contenido disponible.</p>`;
    }
}

function showError(message) {
    const $title = document.getElementById("course-title");
    const $content = document.getElementById("reading-content");
    
    if ($title) $title.textContent = "Error de Acceso";
    if ($content) {
        $content.innerHTML = `
            <div class="bg-red-50 text-red-700 p-6 rounded-xl border border-red-200">
                <p class="font-semibold">${message}</p>
                <p class="mt-4"><a href="dashboard.html" class="text-blue-600 underline hover:text-blue-800">Volver al Dashboard</a></p>
            </div>
        `;
    }
}
