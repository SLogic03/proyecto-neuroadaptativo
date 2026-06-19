/**
 * calibration.js — Módulo de Calibración de Estrés
 * 
 * Antes de iniciar el módulo de lectura, ejecuta un test de 2 fases:
 *   Fase 1: Escritura — El usuario escribe un párrafo. Se mide velocidad de tipeo y latencia entre teclas.
 *   Fase 2: Lectura  — El usuario lee un párrafo. Se mide cinemática del mouse (velocidad, aceleración).
 * 
 * El resultado (baseline) se guarda en localStorage por usuario.
 * Cuando el usuario cambia de hoja, la neuroadaptación se reinicia a ese baseline calibrado.
 */

const CALIBRATION_KEY_PREFIX = 'neuroadapt_calibration_';

// ── Textos para la calibración ──────────────────────────────────
const CALIBRATION_WRITING_PROMPT = `Escribe con tranquilidad el siguiente texto (cópialo tal cual):

"La educación superior tiene como misión fundamental formar ciudadanos críticos, responsables y comprometidos con el desarrollo de la sociedad. Cada estudiante tiene el potencial de transformar su entorno a través del conocimiento adquirido en las aulas y en la práctica profesional."`;

const CALIBRATION_READING_TEXT = `<p class="mb-4 text-justify text-slate-700 leading-relaxed">La administración pública constituye un servicio a la colectividad que se rige por los principios de eficacia, eficiencia, calidad, jerarquía y transparencia. En este contexto, los recursos tecnológicos proporcionados por la institución son bienes públicos destinados a facilitar los fines académicos e institucionales.</p>
<p class="mb-4 text-justify text-slate-700 leading-relaxed">El uso de la infraestructura tecnológica está estrictamente reservado para actividades académicas, de investigación, vinculación y gestión administrativa. Utilizar estos recursos para fines comerciales, envío de correo masivo no solicitado, distribución de material ofensivo o cualquier actividad ajena a la misión institucional constituye una falta disciplinaria.</p>
<p class="text-justify text-slate-700 leading-relaxed">Las contraseñas de acceso son estrictamente personales e intransferibles. Cada usuario es responsable de las acciones realizadas bajo su cuenta. Compartir credenciales compromete la seguridad institucional y puede acarrear sanciones conforme al reglamento vigente.</p>`;

// ── Estado de calibración ───────────────────────────────────────
let calPhase = 0; // 0=no iniciado, 1=escribiendo, 2=leyendo, 3=completado
let calTypingData = [];
let calMouseData = [];
let calLastKeyTime = null;
let calLastMouseX = null, calLastMouseY = null, calLastMouseTime = null;
let calLastVelocity = 0;
let calReadingStartTime = null;

// Listeners temporales (para poder removerlos después)
let _calKeyHandler = null;
let _calMouseHandler = null;

/**
 * Verifica si el usuario actual ya tiene calibración guardada.
 */
function hasCalibration(userId) {
    const key = CALIBRATION_KEY_PREFIX + userId;
    return localStorage.getItem(key) !== null;
}

/**
 * Obtiene la calibración guardada del usuario.
 */
function getCalibration(userId) {
    const key = CALIBRATION_KEY_PREFIX + userId;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch(e) { return null; }
}

/**
 * Guarda la calibración del usuario.
 */
function saveCalibration(userId, baseline) {
    const key = CALIBRATION_KEY_PREFIX + userId;
    localStorage.setItem(key, JSON.stringify(baseline));
}

/**
 * Muestra el modal de calibración. Retorna una Promise que se resuelve 
 * cuando la calibración finaliza.
 */
function startCalibration(userId) {
    return new Promise((resolve) => {
        const modal = document.getElementById('calibration-modal');
        if (!modal) { resolve(); return; }

        modal.classList.remove('hidden');
        showPhaseIntro(resolve, userId);
    });
}

// ── Fase Intro ──────────────────────────────────────────────────
function showPhaseIntro(resolve, userId) {
    const body = document.getElementById('calibration-body');
    const progress = document.getElementById('calibration-progress');
    const title = document.getElementById('calibration-title');
    const subtitle = document.getElementById('calibration-subtitle');

    title.textContent = 'Calibración de Estrés';
    subtitle.textContent = 'Este breve ejercicio establece tu perfil conductual base. Solo tomará un minuto.';
    progress.style.width = '0%';

    body.innerHTML = `
        <div class="text-center py-6">
            <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-100 flex items-center justify-center">
                <svg class="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a3.375 3.375 0 01-4.06.52L12 17.25l-.47.24a3.375 3.375 0 01-4.06-.52L5 14.5m14 0V19a2.25 2.25 0 01-2.25 2.25H7.25A2.25 2.25 0 015 19v-4.5"/>
                </svg>
            </div>
            <p class="text-slate-600 text-sm mb-2">El sistema necesita conocer tu comportamiento <strong>en estado relajado</strong> para poder detectar estrés con precisión.</p>
            <p class="text-slate-500 text-xs mb-8">Se medirán tu velocidad de tipeo, movimiento del mouse y ritmo de lectura.</p>
            <button id="cal-start-btn" class="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] shadow-lg shadow-blue-600/20">
                Comenzar Calibración
            </button>
        </div>
    `;

    document.getElementById('cal-start-btn').addEventListener('click', () => {
        showPhase1(resolve, userId);
    });
}

// ── Fase 1: Escritura ───────────────────────────────────────────
function showPhase1(resolve, userId) {
    const body = document.getElementById('calibration-body');
    const progress = document.getElementById('calibration-progress');
    const title = document.getElementById('calibration-title');
    const subtitle = document.getElementById('calibration-subtitle');

    calPhase = 1;
    calTypingData = [];
    calLastKeyTime = null;

    title.textContent = 'Fase 1 de 2: Escritura';
    subtitle.textContent = 'Escribe el texto que aparece abajo con calma y naturalidad.';
    progress.style.width = '25%';

    body.innerHTML = `
        <div class="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p class="text-sm text-blue-800 font-medium leading-relaxed">${CALIBRATION_WRITING_PROMPT.replace(/\n/g, '<br>')}</p>
        </div>
        <textarea id="cal-textarea" rows="5" placeholder="Empieza a escribir aquí..." 
            class="w-full p-4 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm text-slate-700 resize-none transition-all"></textarea>
        <div class="flex items-center justify-between mt-4">
            <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-blue-400 pulse-dot"></div>
                <span id="cal-typing-count" class="text-xs text-slate-400">0 caracteres escritos</span>
            </div>
            <button id="cal-phase1-next" disabled
                class="px-6 py-2.5 bg-slate-300 text-slate-500 font-semibold rounded-xl cursor-not-allowed transition-all text-sm">
                Mínimo 80 caracteres
            </button>
        </div>
    `;

    const textarea = document.getElementById('cal-textarea');
    const counter = document.getElementById('cal-typing-count');
    const nextBtn = document.getElementById('cal-phase1-next');

    // Capturar latencia de teclas
    _calKeyHandler = (e) => {
        if (calPhase !== 1) return;
        const now = performance.now();
        if (calLastKeyTime !== null) {
            calTypingData.push(now - calLastKeyTime);
        }
        calLastKeyTime = now;

        const len = textarea.value.length;
        counter.textContent = `${len} caracteres escritos`;

        if (len >= 80) {
            nextBtn.disabled = false;
            nextBtn.textContent = 'Continuar a Fase 2';
            nextBtn.className = 'px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all text-sm transform hover:scale-[1.02] shadow-md';
        }
    };
    textarea.addEventListener('keydown', _calKeyHandler);

    nextBtn.addEventListener('click', () => {
        if (textarea.value.length < 80) return;
        textarea.removeEventListener('keydown', _calKeyHandler);
        showPhase2(resolve, userId);
    });
}

// ── Fase 2: Lectura ─────────────────────────────────────────────
function showPhase2(resolve, userId) {
    const body = document.getElementById('calibration-body');
    const progress = document.getElementById('calibration-progress');
    const title = document.getElementById('calibration-title');
    const subtitle = document.getElementById('calibration-subtitle');

    calPhase = 2;
    calMouseData = [];
    calLastMouseX = null;
    calLastMouseY = null;
    calLastMouseTime = null;
    calLastVelocity = 0;

    title.textContent = 'Fase 2 de 2: Lectura';
    subtitle.textContent = 'Lee el siguiente texto con calma. Mueve el mouse de forma natural mientras lees.';
    progress.style.width = '60%';

    body.innerHTML = `
        <div id="cal-reading-area" class="p-6 bg-white rounded-xl border border-slate-200 shadow-sm font-serif text-base leading-relaxed mb-4 max-h-64 overflow-y-auto">
            ${CALIBRATION_READING_TEXT}
        </div>
        <div class="flex items-center justify-between mt-4">
            <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-emerald-400 pulse-dot"></div>
                <span id="cal-read-timer" class="text-xs text-slate-400">Leyendo... 0s</span>
            </div>
            <button id="cal-phase2-done" disabled
                class="px-6 py-2.5 bg-slate-300 text-slate-500 font-semibold rounded-xl cursor-not-allowed transition-all text-sm">
                Espera al menos 10s
            </button>
        </div>
    `;

    calReadingStartTime = performance.now();
    const timerLabel = document.getElementById('cal-read-timer');
    const doneBtn = document.getElementById('cal-phase2-done');

    // Capturar cinemática del mouse durante lectura
    _calMouseHandler = (e) => {
        if (calPhase !== 2) return;
        const now = performance.now();
        if (calLastMouseX !== null && calLastMouseTime !== null) {
            const dx = e.clientX - calLastMouseX;
            const dy = e.clientY - calLastMouseY;
            const dist = Math.hypot(dx, dy);
            const dt = now - calLastMouseTime;
            if (dt > 5 && dist > 2) {
                const velocity = dist / dt;
                const acceleration = Math.abs(velocity - calLastVelocity) / dt;
                calMouseData.push({ velocity, acceleration, dt });
                calLastVelocity = velocity;
            }
        }
        calLastMouseX = e.clientX;
        calLastMouseY = e.clientY;
        calLastMouseTime = now;
    };
    document.addEventListener('mousemove', _calMouseHandler, { passive: true });

    // Timer countdown
    const timerInterval = setInterval(() => {
        if (calPhase !== 2) { clearInterval(timerInterval); return; }
        const elapsed = Math.floor((performance.now() - calReadingStartTime) / 1000);
        timerLabel.textContent = `Leyendo... ${elapsed}s`;

        if (elapsed >= 10) {
            doneBtn.disabled = false;
            doneBtn.textContent = 'Finalizar Calibración';
            doneBtn.className = 'px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all text-sm transform hover:scale-[1.02] shadow-md';
        }
    }, 1000);

    doneBtn.addEventListener('click', () => {
        if ((performance.now() - calReadingStartTime) < 10000) return;
        clearInterval(timerInterval);
        document.removeEventListener('mousemove', _calMouseHandler);
        calPhase = 3;
        finishCalibration(resolve, userId);
    });
}

// ── Finalización y cálculo de baseline ──────────────────────────
function finishCalibration(resolve, userId) {
    const body = document.getElementById('calibration-body');
    const progress = document.getElementById('calibration-progress');
    const title = document.getElementById('calibration-title');
    const subtitle = document.getElementById('calibration-subtitle');

    progress.style.width = '100%';
    title.textContent = 'Calibración Completada';
    subtitle.textContent = 'Tu perfil conductual base ha sido registrado exitosamente.';

    // ── Calcular métricas de baseline ──
    // Typing: media y desviación estándar de latencia entre teclas
    const typingLatencies = calTypingData.filter(t => t > 0 && t < 2000); // filtrar outliers
    const avgTypingLatency = typingLatencies.length > 0 
        ? typingLatencies.reduce((a, b) => a + b, 0) / typingLatencies.length 
        : 150;
    const stdTypingLatency = typingLatencies.length > 1
        ? Math.sqrt(typingLatencies.reduce((sum, t) => sum + Math.pow(t - avgTypingLatency, 2), 0) / typingLatencies.length)
        : 50;

    // Mouse: media y desviación estándar de velocidad
    const mouseVelocities = calMouseData.map(d => d.velocity).filter(v => isFinite(v) && v > 0);
    const avgMouseVelocity = mouseVelocities.length > 0 
        ? mouseVelocities.reduce((a, b) => a + b, 0) / mouseVelocities.length 
        : 0.5;
    const stdMouseVelocity = mouseVelocities.length > 1
        ? Math.sqrt(mouseVelocities.reduce((sum, v) => sum + Math.pow(v - avgMouseVelocity, 2), 0) / mouseVelocities.length)
        : 0.2;

    // Mouse: media de aceleración
    const mouseAccelerations = calMouseData.map(d => d.acceleration).filter(a => isFinite(a) && a > 0);
    const avgMouseAcceleration = mouseAccelerations.length > 0
        ? mouseAccelerations.reduce((a, b) => a + b, 0) / mouseAccelerations.length
        : 0.01;

    // Tiempo de lectura
    const readingDuration = calReadingStartTime ? (performance.now() - calReadingStartTime) / 1000 : 15;

    const baseline = {
        typing: {
            avgLatencyMs: parseFloat(avgTypingLatency.toFixed(2)),
            stdLatencyMs: parseFloat(stdTypingLatency.toFixed(2)),
            sampleCount: typingLatencies.length
        },
        mouse: {
            avgVelocity: parseFloat(avgMouseVelocity.toFixed(4)),
            stdVelocity: parseFloat(stdMouseVelocity.toFixed(4)),
            avgAcceleration: parseFloat(avgMouseAcceleration.toFixed(6)),
            sampleCount: mouseVelocities.length
        },
        reading: {
            durationSeconds: parseFloat(readingDuration.toFixed(1))
        },
        calibratedAt: new Date().toISOString()
    };

    saveCalibration(userId, baseline);
    console.log('[Calibración] Baseline guardado:', baseline);

    // Exponer baseline globalmente para telemetry.js
    window._neuroBaseline = baseline;

    // Mostrar resumen visual
    body.innerHTML = `
        <div class="text-center py-4">
            <div class="w-16 h-16 mx-auto mb-5 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg class="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
            </div>
            <div class="grid grid-cols-3 gap-3 mb-6">
                <div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p class="text-2xl font-bold text-slate-800">${baseline.typing.avgLatencyMs.toFixed(0)}<span class="text-xs text-slate-400 ml-1">ms</span></p>
                    <p class="text-xs text-slate-500 mt-1">Latencia media de tipeo</p>
                </div>
                <div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p class="text-2xl font-bold text-slate-800">${baseline.mouse.avgVelocity.toFixed(2)}<span class="text-xs text-slate-400 ml-1">px/ms</span></p>
                    <p class="text-xs text-slate-500 mt-1">Velocidad media del mouse</p>
                </div>
                <div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p class="text-2xl font-bold text-slate-800">${baseline.reading.durationSeconds.toFixed(0)}<span class="text-xs text-slate-400 ml-1">seg</span></p>
                    <p class="text-xs text-slate-500 mt-1">Tiempo de lectura</p>
                </div>
            </div>
            <p class="text-xs text-slate-400 mb-6">Estos valores se usarán como referencia para detectar desviaciones conductuales durante tu sesión de lectura.</p>
            <button id="cal-finish-btn" class="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] shadow-lg shadow-emerald-600/20">
                Comenzar Lectura
            </button>
        </div>
    `;

    document.getElementById('cal-finish-btn').addEventListener('click', () => {
        const modal = document.getElementById('calibration-modal');
        // Animate out
        modal.querySelector('.calibration-card').style.transform = 'scale(0.95)';
        modal.querySelector('.calibration-card').style.opacity = '0';
        setTimeout(() => {
            modal.classList.add('hidden');
            resolve(baseline);
        }, 300);
    });
}

// ── API pública ─────────────────────────────────────────────────
window.CalibrationModule = {
    hasCalibration,
    getCalibration,
    startCalibration,
    saveCalibration
};
