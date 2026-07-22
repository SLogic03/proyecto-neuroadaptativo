// ==========================================
// Módulo de Captura Conductual Avanzada
// ==========================================

console.log("Módulo de telemetría conductual (con matemáticas) inicializado.");

// Conexión WebSocket al backend (dinámica basada en el host actual)
const wsUrl = window.location.protocol === "https:" ? `wss://${window.location.host}/ws` : `ws://${window.location.host}/ws`;
const ws = new WebSocket(wsUrl);
ws.onopen = () => console.log("WebSocket conectado al backend.");
ws.onerror = (err) => console.error("WebSocket error:", err);
ws.onclose = (e) => console.error(`WebSocket cerrado: code=${e.code} reason=${e.reason} wasClean=${e.wasClean}`);

let telemetryBuffer = [];
let currentAdaptationLevel = 0;

// ID de curso actual extraído de la URL para trazabilidad
const urlCourseId = new URLSearchParams(window.location.search).get('courseId');
const currentCourseId = urlCourseId ? parseInt(urlCourseId) : null;

// Variables de estado para calcular deltas (diferencias)
// Usamos performance.now() para alta resolución temporal (µs precision)
let lastX = null, lastY = null, lastTimeMouse = null;
let lastVelocity = 0;
let lastAcceleration = 0; // Necesario para calcular jerk (da/dt)
let lastKeyTime = null;
let hoverTimers = {}; // Diccionario para medir el Dwell Time

// Acumulador para throttling de dt mínimo (8ms)
let accumulatedDistance = 0;

// Constantes de filtrado
const DEADZONE_PX = 2;    // Distancia mínima para ignorar jitter del hardware

// Buffer para promedio móvil
let recentKinematics = [];

// Función utilitaria de Throttling
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// 1. Cinemática del Ratón (Velocidad, Aceleración y Jerk)
document.addEventListener('mousemove', throttle((event) => {
    const currentTime = performance.now(); // Alta resolución temporal (sub-ms)
    let velocity = 0;
    let acceleration = 0;
    let jerk = 0;

    if (lastX !== null && lastTimeMouse !== null) {
        // Distancia euclidiana desde el último punto registrado
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        const distance = Math.hypot(dx, dy);

        // FILTRO DEADZONE: ignorar micro-movimientos de jitter del hardware
        if (distance < DEADZONE_PX) {
            return; // Descartamos el evento ruidoso
        }

        const deltaTime = currentTime - lastTimeMouse;

        // Derivadas cinemáticas con dt real
        velocity = distance / deltaTime; // px/ms
        acceleration = (velocity - lastVelocity) / deltaTime; // px/ms²
        jerk = (acceleration - lastAcceleration) / deltaTime; // px/ms³

        // Guardia contra Infinity y NaN en las derivadas
        if (!isFinite(velocity))     velocity = 0;
        if (!isFinite(acceleration)) acceleration = 0;
        if (!isFinite(jerk))         jerk = 0;
        
        // BUFFER PARA MOVING AVERAGE (últimas 5 lecturas)
        recentKinematics.push({v: velocity, a: acceleration, jerk: jerk});
        if (recentKinematics.length > 5) recentKinematics.shift();
        
        // Cálculo del promedio móvil
        const sum = recentKinematics.reduce((acc, curr) => ({
            v: acc.v + curr.v,
            a: acc.a + curr.a,
            jerk: acc.jerk + curr.jerk
        }), {v: 0, a: 0, jerk: 0});
        
        const avg_v = sum.v / recentKinematics.length;
        const avg_a = sum.a / recentKinematics.length;
        const avg_jerk = sum.jerk / recentKinematics.length;

        const mouseData = {
            type: 'mouse_kinematics',
            course_id: currentCourseId,
            x: event.clientX,
            y: event.clientY,
            v: parseFloat(avg_v.toFixed(4)), // Redondeamos para no saturar la BD
            a: parseFloat(avg_a.toFixed(6)),
            jerk: parseFloat(avg_jerk.toFixed(8)),
            timestamp: currentTime
        };

        telemetryBuffer.push(mouseData);
    }

    // Actualizamos el estado para el siguiente fotograma
    lastX = event.clientX;
    lastY = event.clientY;
    lastTimeMouse = currentTime;
    lastVelocity = velocity;
    lastAcceleration = acceleration;
}, 500), { passive: true });

// 2. Latencia de Teclado (Tiempo entre teclas)
document.addEventListener('keydown', (event) => {
    const currentTime = performance.now(); // Alta resolución temporal
    let latency = 0;

    if (lastKeyTime !== null) {
        latency = currentTime - lastKeyTime; // Milisegundos desde la última tecla
    }

    const keyData = {
        type: 'keystroke_latency',
        course_id: currentCourseId,
        key_code: event.code,
        latency_ms: parseFloat(latency.toFixed(2)), // Sub-ms precision
        timestamp: currentTime
    };

    telemetryBuffer.push(keyData);
    console.log("Latencia de tipeo:", latency.toFixed(2), "ms"); // Log de prueba

    lastKeyTime = currentTime;
}, { passive: true });

// 3. Dwell Time (Tiempo de duda/permanencia sobre botones e inputs)
// Detectamos cuando el usuario pone el ratón encima de un elemento interactivo
document.querySelectorAll('button, input').forEach(element => {

    // Inicia el cronómetro al entrar
    element.addEventListener('mouseenter', (e) => {
        const targetId = e.target.id || 'elemento_sin_id';
        hoverTimers[targetId] = performance.now();
    }, { passive: true });

    // Detiene el cronómetro al salir y calcula el Dwell Time
    element.addEventListener('mouseleave', (e) => {
        const targetId = e.target.id || 'elemento_sin_id';

        if (hoverTimers[targetId]) {
            const dwellTime = performance.now() - hoverTimers[targetId];

            const dwellData = {
                type: 'dwell_time',
                course_id: currentCourseId,
                element_id: targetId,
                duration_ms: dwellTime,
                timestamp: performance.now()
            };

            telemetryBuffer.push(dwellData);
            console.log(`Dwell Time en [${targetId}]:`, dwellTime, "ms"); // Log de prueba

            delete hoverTimers[targetId]; // Limpiamos la memoria
        }
    }, { passive: true });
});

// ==========================================
// Envío por lotes al backend vía WebSocket
// ==========================================
setInterval(() => {
    // Don't send telemetry during calibration — prevents backend from
    // triggering DOM adaptations while the user is being calibrated
    if (window._isCalibrating) return;

    if (telemetryBuffer.length > 0 && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(telemetryBuffer));
        telemetryBuffer = [];
    }
}, 3000);

// ==========================================
// Recepción de directivas neuroadaptativas
// del backend (ML + Gemini) vía WebSocket
// ==========================================

// Flag to prevent concurrent consent modals
let _consentPending = false;

// Variables de estado para Histéresis y Cooldown
let lastStateChange = 0;
const COOLDOWN_MS = 10000;
const TRIGGER_STRESS = 0.60;
const TRIGGER_NORMAL = 0.35;

ws.onmessage = (event) => {
    try {
        const directives = JSON.parse(event.data);
        console.log("Directivas neuroadaptativas recibidas:", directives);

        if (window._isCalibrating) {
            console.log('[NeuroAdapt] Ignorando directivas — calibración en curso.');
            return;
        }

        // BLOQUEO SECUENCIAL EXPERIMENTAL
        if (window.courseIsAdaptive === false) {
            // El curso es de control, silenciamos las adaptaciones visuales
            return;
        }

        const prob = directives.prob_estres !== undefined ? directives.prob_estres : 0.0;
        const now = Date.now();
        
        console.log(`[NeuroAdapt] Probabilidad de estrés evaluada: ${prob.toFixed(3)}`);

        // Bloqueo de transición (Cooldown)
        if (now - lastStateChange < COOLDOWN_MS) {
            console.log('[NeuroAdapt] En cooldown. Ignorando umbrales temporales.');
            return;
        }

        // Recuperación (Trigger Normal)
        if (prob < TRIGGER_NORMAL && currentAdaptationLevel > 0) {
            console.log(`[NeuroAdapt] Recuperación (P=${prob.toFixed(2)}). Revirtiendo a estado base.`);
            resetNeuroAdaptation();
            showNeuroNotification('Se detectó recuperación. Volviendo a entorno normal.', 'fallback');
            lastStateChange = now;
            return;
        }

        // Estrés (Trigger Stress)
        if (prob > TRIGGER_STRESS) {
            // Aseguramos que la acción sea adapt para que progrese
            directives.action = 'adapt';
            if (_consentPending) return;
            
            console.log(`[NeuroAdapt] Estrés detectado (P=${prob.toFixed(2)}). Activando adaptación.`);
            showStressConsentModal(directives);
            lastStateChange = now;
            return;
        }
        
    } catch (err) {
        console.error("Error parseando directivas del backend:", err);
    }
};

/**
 * Shows a consent modal asking the user whether they want to apply
 * stress-reduction adaptations. Only applies if user accepts.
 */
function showStressConsentModal(directives) {
    const modal = document.getElementById('stress-consent-modal');
    if (!modal) {
        // Fallback: apply directly if modal doesn't exist
        applyNeuroAdaptation(directives);
        return;
    }

    _consentPending = true;

    const nextLevel = currentAdaptationLevel + 1;
    const titleEl = document.getElementById('stress-consent-title');
    const descEl = document.getElementById('stress-consent-description');

    // Customize message based on adaptation level
    if (nextLevel === 1) {
        if (titleEl) titleEl.textContent = 'Se detectó estrés cognitivo';
        if (descEl) descEl.textContent = 'El sistema ha detectado un patrón atípico en tu comportamiento. ¿Deseas aplicar ajustes visuales suaves (tipografía más grande, fondo cálido) para reducir la carga cognitiva?';
    } else if (nextLevel === 2) {
        if (titleEl) titleEl.textContent = 'El estrés persiste';
        if (descEl) descEl.textContent = 'Seguimos detectando indicadores de estrés. ¿Deseas que la IA simplifique el contenido en párrafos más concisos y fáciles de leer?';
    } else {
        if (titleEl) titleEl.textContent = 'Nivel de estrés elevado';
        if (descEl) descEl.textContent = 'Se mantiene un patrón de estrés elevado. ¿Deseas que el contenido se transforme en viñetas resumidas para lectura rápida?';
    }

    // Show modal
    modal.classList.remove('hidden');

    // Setup handlers (clone to remove old listeners)
    const acceptBtn = document.getElementById('stress-consent-accept');
    const rejectBtn = document.getElementById('stress-consent-reject');
    const newAccept = acceptBtn.cloneNode(true);
    const newReject = rejectBtn.cloneNode(true);
    acceptBtn.parentNode.replaceChild(newAccept, acceptBtn);
    rejectBtn.parentNode.replaceChild(newReject, rejectBtn);

    newAccept.addEventListener('click', () => {
        modal.classList.add('hidden');
        _consentPending = false;
        applyNeuroAdaptation(directives);
    });

    newReject.addEventListener('click', () => {
        modal.classList.add('hidden');
        _consentPending = false;
        console.log('[NeuroAdapt] Usuario rechazó la adaptación.');
        showNeuroNotification('Adaptación omitida. Se preguntará nuevamente si se detecta estrés.', 'none');
    });
}

/**
 * Aplica las directivas de adaptación cognitiva al DOM.
 * Modifica estilos, visibilidad y layout según el JSON
 * generado por el motor Gemini en el backend.
 * Now theme-aware: uses different colors for dark vs light mode.
 *
 * @param {Object} directives - JSON con claves: action, theme, font_size,
 *                               line_height, hide_sidebar, simplify_content, message
 */
async function applyNeuroAdaptation(directives) {
    console.log(`[NeuroAdapt] Aplicando adaptación: ${directives.action}`);

    const root = document.documentElement;
    const sidebar = document.getElementById('sidebar');
    const container = document.getElementById('reading-container');
    const readingContent = document.getElementById('reading-content');
    const isDark = root.getAttribute('data-theme') === 'dark';

    if (directives.action === 'adapt' || directives.action === 'stress_detected') {
        // ── Incrementar nivel de adaptación progresiva ─────────────
        currentAdaptationLevel++;
        root.setAttribute('data-stress-level', String(currentAdaptationLevel));
        console.log(`[NeuroAdapt] Nivel de adaptación progresiva: ${currentAdaptationLevel}`);

        // ── NIVEL 1: Solo mutación CSS (sin llamada al backend) ───
        if (currentAdaptationLevel === 1) {
            root.style.setProperty('--dyn-font-size', '1.25rem');
            root.style.setProperty('--dyn-line-height', '1.9');
            root.style.setProperty('--dyn-letter-spacing', '0.03em');

            if (isDark) {
                // Dark mode: use deep navy/indigo tones for calm
                root.style.setProperty('--dyn-bg-color', '#1a1a2e');
                root.style.setProperty('--dyn-text-color', '#d1d5db');
                root.style.setProperty('--surface-bg', '#1e1e36');
                if (readingContent) {
                    readingContent.style.backgroundColor = '#1e1e36';
                    readingContent.style.fontSize = '1.25rem';
                    readingContent.style.lineHeight = '1.9';
                }
            } else {
                // Light mode: warm cream tones
                root.style.setProperty('--dyn-bg-color', '#fef9c3');
                root.style.setProperty('--dyn-text-color', '#334155');
                if (readingContent) {
                    readingContent.style.backgroundColor = '#fef9c3';
                    readingContent.style.fontSize = '1.25rem';
                    readingContent.style.lineHeight = '1.9';
                }
            }
        }

        // ── NIVEL >= 2: Llamada al backend para simplificar texto ─
        if (currentAdaptationLevel >= 2) {
            root.style.setProperty('--dyn-font-size', '1.4rem');
            root.style.setProperty('--dyn-line-height', '2.0');
            root.style.setProperty('--dyn-letter-spacing', '0.06em');

            if (isDark) {
                root.style.setProperty('--dyn-bg-color', '#1a1a2e');
                root.style.setProperty('--dyn-text-color', '#e5e7eb');
                root.style.setProperty('--surface-bg', '#1e1e36');
            } else {
                root.style.setProperty('--dyn-bg-color', '#FEF3C7');
                root.style.setProperty('--dyn-text-color', '#334155');
            }

            // Extraer texto original del contenido de lectura
            const originalText = readingContent ? readingContent.innerText : '';

            if (originalText.trim().length > 0) {
                const token = localStorage.getItem('neuroadapt_token');
                const API_BASE = window.location.protocol === 'https:'
                    ? `https://${window.location.host}`
                    : `http://${window.location.host}`;

                try {
                    // Obtener courseId y chapterIndex del entorno global de reading.js
                    const urlParams = new URLSearchParams(window.location.search);
                    const courseId = parseInt(urlParams.get('id'), 10) || 1;
                    const cIndex = (typeof currentChapterIndex !== 'undefined') ? currentChapterIndex : 0;

                    const response = await fetch(`${API_BASE}/student/simplify`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            text: originalText,
                            level: currentAdaptationLevel,
                            course_id: courseId,
                            chapter_index: cIndex
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (readingContent) {
                            readingContent.innerHTML = data.summary;
                        }
                    } else {
                        console.error(`[NeuroAdapt] Error del servidor: ${response.status}`);
                    }
                } catch (err) {
                    console.error('[NeuroAdapt] Error en simplificación:', err);
                }
            }
        }

        // Hide sidebar if requested to reduce cognitive load
        if (directives.hide_sidebar) {
            if (sidebar) {
                sidebar.classList.add('-translate-x-full');
            }
            if (container) {
                container.classList.remove('ml-64');
                container.classList.add('ml-0');
            }
        }
    }
    // NOTA: Se eliminó el bloque 'else' que revertía estilos (efecto rebote).
    // Los cambios neuroadaptativos son permanentes durante la sesión.

    // Ephemeral visual notification
    if (directives.message) {
        showNeuroNotification(directives.message, directives.action);
    }
}

window.resetNeuroAdaptation = function() {
    // Reset adaptation level to 0 (calibrated baseline)
    if (typeof currentAdaptationLevel !== 'undefined') {
        currentAdaptationLevel = 0;
    }

    // Reset consent pending flag
    _consentPending = false;

    // Reset visual styles on reading content
    const content = document.getElementById('reading-content');
    if (content) {
        content.style.backgroundColor = '';
        content.style.fontSize = '';
        content.style.lineHeight = '';
        content.classList.remove('bg-yellow-50', 'text-lg', 'p-4'); 
    }
    
    // Detect current theme to restore proper defaults
    const root = document.documentElement;
    const isDark = root.getAttribute('data-theme') === 'dark';
    root.removeAttribute('data-stress-level');

    root.style.setProperty('--dyn-font-size', '1.125rem');
    root.style.setProperty('--dyn-line-height', '1.75');
    root.style.setProperty('--dyn-letter-spacing', 'normal');

    if (isDark) {
        root.style.setProperty('--dyn-bg-color', '#0f172a');
        root.style.setProperty('--dyn-text-color', '#e2e8f0');
        root.style.setProperty('--surface-bg', '#1e293b');
    } else {
        root.style.setProperty('--dyn-bg-color', '#f8fafc');
        root.style.setProperty('--dyn-text-color', '#1e293b');
        root.style.setProperty('--surface-bg', '#ffffff');
    }

    // Restore sidebar if it was hidden
    const sidebar = document.getElementById('sidebar');
    const container = document.getElementById('reading-container');
    if (sidebar) {
        sidebar.classList.remove('-translate-x-full');
    }
    if (container) {
        container.classList.add('ml-64');
        container.classList.remove('ml-0');
    }

    // Reset telemetry kinematic state to calibrated baseline
    lastVelocity = 0;
    lastAcceleration = 0;
    accumulatedDistance = 0;

    // Log baseline status
    if (window._neuroBaseline) {
        console.log("[UX] Neuroadaptación reiniciada al baseline calibrado:", window._neuroBaseline.calibratedAt);
    } else {
        console.log("[UX] Neuroadaptación reiniciada (sin baseline calibrado).");
    }
};

let isSummarizing = false;

async function triggerLLMSummary() {
    const agentPanel = document.getElementById('agent-panel');
    const summaryContainer = document.getElementById('agent-summary-content');
    const readingContent = document.getElementById('reading-content');
    
    if (!agentPanel || !summaryContainer || !readingContent || isSummarizing) return;
    
    // Mostramos el panel en estado de carga
    agentPanel.classList.remove('hidden');
    summaryContainer.innerHTML = `
        <div class="flex items-center gap-2 text-blue-600">
            <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span>Generando resumen neuroadaptativo con Gemini...</span>
        </div>
    `;
    
    isSummarizing = true;
    
    try {
        // Extraemos solo el texto de los párrafos actuales
        const paragraphs = Array.from(readingContent.querySelectorAll('p')).map(p => p.textContent).join('\\n\\n');
        
        const token = localStorage.getItem('access_token');
        const API_BASE = window.location.protocol === "https:" ? `https://${window.location.host}` : `http://${window.location.host}`;
        
        // Obtener variables globales de reading.js
        const urlParams = new URLSearchParams(window.location.search);
        const courseId = parseInt(urlParams.get('id'), 10) || 1;
        const cIndex = (typeof currentChapterIndex !== 'undefined') ? currentChapterIndex : 0;

        const response = await fetch(`${API_BASE}/student/simplify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                text: paragraphs,
                level: 3,
                course_id: courseId,
                chapter_index: cIndex
            })
        });
        
        if (!response.ok) throw new Error('Fallo al obtener resumen');
        
        const data = await response.json();
        summaryContainer.innerHTML = data.summary;
        
    } catch (err) {
        console.error("Error en resumen LLM:", err);
        summaryContainer.innerHTML = '<p class="text-red-500">No se pudo cargar el resumen en este momento.</p>';
    } finally {
        isSummarizing = false;
    }
}

/**
 * Muestra una notificación flotante temporal con el mensaje
 * de la adaptación neuroadaptativa.
 */
function showNeuroNotification(message, action) {
    // Evitamos duplicados
    const existing = document.getElementById('neuro-notification');
    if (existing) existing.remove();

    const colors = {
        adapt:    { bg: 'rgba(108,92,231,0.15)', border: 'rgba(108,92,231,0.4)', text: '#A29BFE' },
        fallback: { bg: 'rgba(253,203,110,0.15)', border: 'rgba(253,203,110,0.4)', text: '#FDCB6E' },
    };
    const c = colors[action] || colors.adapt;

    const notification = document.createElement('div');
    notification.id = 'neuro-notification';
    notification.style.cssText = `
        position: fixed; bottom: 24px; right: 24px; z-index: 9999;
        max-width: 380px; padding: 14px 20px;
        background: ${c.bg}; border: 1px solid ${c.border};
        border-radius: 12px; backdrop-filter: blur(16px);
        color: ${c.text}; font-size: 13px; font-weight: 500;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        transform: translateY(20px); opacity: 0;
        transition: transform 0.4s ease, opacity 0.4s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Animate in
    requestAnimationFrame(() => {
        notification.style.transform = 'translateY(0)';
        notification.style.opacity = '1';
    });

    // Auto-remove after 6s
    setTimeout(() => {
        notification.style.transform = 'translateY(20px)';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 400);
    }, 6000);
}