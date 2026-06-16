/**
 * reading.js — Lógica para renderizar dinámicamente el contenido del curso
 */

const API_BASE = "";

let courseChapters = [];
let currentChapterIndex = 0;

// ── 1. Verificación de Autenticación ─────────────────────────────
const accessToken = localStorage.getItem("neuroadapt_token");
const userRaw = localStorage.getItem("neuroadapt_user");

if (!accessToken || !userRaw) {
    window.location.href = "login.html";
}

const currentUser = JSON.parse(userRaw);

// ── 1b. Rellenar datos de usuario en sidebar y bind logout ───────
document.addEventListener("DOMContentLoaded", () => {
    const $userName   = document.getElementById("user-name");
    const $userRole   = document.getElementById("user-role");
    const $userAvatar = document.getElementById("user-avatar");
    const $btnLogout  = document.getElementById("btn-logout");

    if ($userName && $userRole && $userAvatar && currentUser) {
        $userName.textContent = currentUser.full_name;
        $userRole.textContent = currentUser.role === "admin" ? "Administrador" : "Estudiante";
        const initials = currentUser.full_name
            .split(" ").filter(Boolean).slice(0, 2)
            .map(n => n[0].toUpperCase()).join("");
        $userAvatar.textContent = initials;
    }

    if ($btnLogout) {
        $btnLogout.addEventListener("click", () => {
            localStorage.removeItem("neuroadapt_token");
            localStorage.removeItem("neuroadapt_user");
            window.location.href = "login.html";
        });
    }
});

// ── 2. Inicialización ────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    // Extraer courseId de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('courseId');

    if (!courseId) {
        showError("ID de curso no proporcionado en la URL.");
        return;
    }

    loadSidebarCourses(courseId);
    loadCourseData(courseId);

    const $btnPrev = document.getElementById("btn-prev");
    const $btnNext = document.getElementById("btn-next");
    
    if ($btnPrev) {
        $btnPrev.addEventListener("click", () => {
            if (currentChapterIndex > 0) {
                currentChapterIndex--;
                if (window.resetNeuroAdaptation) window.resetNeuroAdaptation();
                renderChapter(currentChapterIndex);
                window.scrollTo(0,0);
            }
        });
    }
    
    if ($btnNext) {
        $btnNext.addEventListener("click", () => {
            if (currentChapterIndex < courseChapters.length - 1) {
                currentChapterIndex++;
                if (window.resetNeuroAdaptation) window.resetNeuroAdaptation();
                renderChapter(currentChapterIndex);
                window.scrollTo(0,0);
            }
        });
    }
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
            localStorage.removeItem("neuroadapt_user");
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

async function loadSidebarCourses(currentCourseId) {
    try {
        const response = await fetch(`${API_BASE}/student/my-courses`, {
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        });
        if (response.ok) {
            const courses = await response.json();
            const sidebar = document.getElementById("sidebar-courses");
            if (sidebar) {
                courses.forEach(c => {
                    const isActive = c.id.toString() === currentCourseId;
                    const cssClasses = isActive 
                        ? "flex items-center gap-3 px-4 py-3 rounded-md border-l-4 border-blue-600 bg-slate-100 font-bold text-slate-900 text-sm transition-all"
                        : "flex items-center gap-3 px-4 py-3 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 font-medium text-sm transition-all";
                    
                    const html = `
                        <a href="reading.html?courseId=${c.id}" class="${cssClasses}">
                            <svg class="w-5 h-5 text-current" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a3.375 3.375 0 01-4.06.52L12 17.25l-.47.24a3.375 3.375 0 01-4.06-.52L5 14.5m14 0V19a2.25 2.25 0 01-2.25 2.25H7.25A2.25 2.25 0 015 19v-4.5"/></svg>
                            ${c.title}
                        </a>
                    `;
                    sidebar.insertAdjacentHTML('beforeend', html);
                });
            }
        }
    } catch (e) {
        console.error("Error loading sidebar courses", e);
    }
}

// ── 4. Renderizar contenido ──────────────────────────────────────
function renderCourse(course) {
    const $title = document.getElementById("course-title");

    if ($title) {
        $title.textContent = course.title;
    }

    if (course.content_data) {
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
            courseChapters = data;
            currentChapterIndex = 0;
            renderChapter(0);
        } else {
            const $content = document.getElementById("reading-content");
            if ($content) $content.innerHTML = `<p>${String(data)}</p>`;
        }
    }
}

function renderChapter(index) {
    const chapter = courseChapters[index];
    if (!chapter) return;

    const $content = document.getElementById("reading-content");
    const $quizContainer = document.getElementById("quiz-container");
    const $btnPrev = document.getElementById("btn-prev");
    const $btnNext = document.getElementById("btn-next");

    if (!$content || !$quizContainer) return;

    // Render content
    let htmlContent = `
        <div id="reading-focus-guide" class="hidden"></div>
        <h2 class="text-3xl font-bold mb-6">${chapter.chapter_title || 'Capítulo'}</h2>
    `;

    if (chapter.sections) {
        chapter.sections.forEach(sec => {
            htmlContent += `<p class="mb-4 text-justify">${sec.text}</p>`;
        });
    }

    $content.innerHTML = htmlContent;

    // Render quiz
    if (chapter.quiz) {
        const q = chapter.quiz;
        const quizId = `quiz-${index}`;
        $quizContainer.classList.remove('hidden');
        $quizContainer.innerHTML = `
            <div class="flex items-center gap-2 mb-4">
                <div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                    </svg>
                </div>
                <p class="text-sm font-bold text-slate-700 uppercase tracking-wide">Punto de Control</p>
            </div>
            <p class="text-sm font-semibold text-slate-800 mb-4">${q.question || q.text}</p>
            <div class="space-y-2" id="${quizId}-options">
                ${q.options.map((opt, optIdx) => `
                    <button
                        class="quiz-option w-full text-left px-4 py-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:border-blue-400 hover:bg-blue-50 transition-all active:scale-[0.99]"
                        data-quiz-id="${quizId}"
                        data-option-index="${optIdx}"
                        data-correct-index="${q.correctIndex}"
                    >
                        <span class="inline-flex items-center gap-3">
                            <span class="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">${String.fromCharCode(65 + optIdx)}</span>
                            ${opt}
                        </span>
                    </button>
                `).join('')}
            </div>
            <div id="${quizId}-feedback" class="mt-4 hidden"></div>
        `;

        $quizContainer.querySelectorAll('.quiz-option').forEach(btn => {
            btn.addEventListener('click', handleQuizAnswer);
        });
    } else {
        $quizContainer.classList.add('hidden');
        $quizContainer.innerHTML = '';
    }

    // Pagination buttons logic
    if ($btnPrev) {
        if (index > 0) $btnPrev.classList.remove('hidden');
        else $btnPrev.classList.add('hidden');
    }

    if ($btnNext) {
        $btnNext.classList.add('hidden'); // Oculto hasta resolver quiz o si no hay quiz lo mostramos?
        if (!chapter.quiz && index < courseChapters.length - 1) {
            $btnNext.classList.remove('hidden');
        }
    }
}

// ── 5. Lógica de evaluación de quiz ──────────────────────────────
function handleQuizAnswer(e) {
    const btn = e.currentTarget;
    const quizId = btn.dataset.quizId;
    const selectedIndex = parseInt(btn.dataset.optionIndex);
    const correctIndex = parseInt(btn.dataset.correctIndex);
    const $feedback = document.getElementById(`${quizId}-feedback`);
    const $optionsContainer = document.getElementById(`${quizId}-options`);

    if (!$feedback || !$optionsContainer) return;

    // Deshabilitar todos los botones de este quiz
    $optionsContainer.querySelectorAll('.quiz-option').forEach(b => {
        b.disabled = true;
        b.classList.remove('hover:border-blue-400', 'hover:bg-blue-50');
        b.classList.add('cursor-not-allowed', 'opacity-60');
    });

    // Resaltar la respuesta seleccionada y la correcta
    $optionsContainer.querySelectorAll('.quiz-option').forEach(b => {
        const idx = parseInt(b.dataset.optionIndex);
        if (idx === correctIndex) {
            b.classList.remove('border-slate-200', 'bg-white', 'opacity-60');
            b.classList.add('border-emerald-400', 'bg-emerald-50', 'opacity-100');
            b.querySelector('.w-6').classList.remove('border-slate-300', 'text-slate-500');
            b.querySelector('.w-6').classList.add('border-emerald-500', 'text-emerald-700', 'bg-emerald-100');
        }
        if (idx === selectedIndex && idx !== correctIndex) {
            b.classList.remove('border-slate-200', 'bg-white');
            b.classList.add('border-red-400', 'bg-red-50', 'opacity-100');
            b.querySelector('.w-6').classList.remove('border-slate-300', 'text-slate-500');
            b.querySelector('.w-6').classList.add('border-red-500', 'text-red-700', 'bg-red-100');
        }
    });

    // Mostrar feedback
    $feedback.classList.remove('hidden');
    if (selectedIndex === correctIndex) {
        $feedback.innerHTML = `
            <div class="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                <svg class="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p class="text-sm font-semibold text-emerald-800">¡Correcto! Has comprendido esta sección.</p>
            </div>
        `;
        const $btnNext = document.getElementById("btn-next");
        if ($btnNext && currentChapterIndex < courseChapters.length - 1) {
            $btnNext.classList.remove('hidden');
        }
    } else {
        $feedback.innerHTML = `
            <div class="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
                <svg class="w-5 h-5 text-red-600 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p class="text-sm font-semibold text-red-800">Respuesta incorrecta. Revisa la hoja anterior e intenta de nuevo.</p>
            </div>
        `;
        // Permitir reintentar después de 2.5 segundos
        setTimeout(() => {
            $optionsContainer.querySelectorAll('.quiz-option').forEach(b => {
                const idx = parseInt(b.dataset.optionIndex);
                b.disabled = false;
                b.classList.remove('cursor-not-allowed', 'opacity-60', 'border-red-400', 'bg-red-50', 'opacity-100');
                b.classList.add('hover:border-blue-400', 'hover:bg-blue-50');
                if (idx !== correctIndex) {
                    b.classList.add('border-slate-200', 'bg-white');
                    b.querySelector('.w-6').classList.remove('border-red-500', 'text-red-700', 'bg-red-100');
                    b.querySelector('.w-6').classList.add('border-slate-300', 'text-slate-500');
                }
            });
            $feedback.classList.add('hidden');
        }, 2500);
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
