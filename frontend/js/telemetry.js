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
const MIN_DT_MS = 8;      // Delta time mínimo para calcular derivadas (evita picos)

// 1. Cinemática del Ratón (Velocidad, Aceleración y Jerk)
document.addEventListener('mousemove', (event) => {
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

        // PROTECCIÓN CONTRA PICOS: si dt < 8ms, acumulamos distancia
        // pero NO calculamos nuevas derivadas (evita v → ∞)
        if (deltaTime < MIN_DT_MS) {
            accumulatedDistance += distance;
            // Actualizamos posición pero NO el timestamp ni la velocidad
            lastX = event.clientX;
            lastY = event.clientY;
            return;
        }

        // Incluimos cualquier distancia acumulada durante el throttling
        const totalDistance = accumulatedDistance + distance;
        accumulatedDistance = 0; // Reset del acumulador

        // Derivadas cinemáticas con dt real
        velocity = totalDistance / deltaTime; // px/ms
        acceleration = (velocity - lastVelocity) / deltaTime; // px/ms²
        jerk = (acceleration - lastAcceleration) / deltaTime; // px/ms³

        // Guardia contra Infinity y NaN en las derivadas
        if (!isFinite(velocity))     velocity = 0;
        if (!isFinite(acceleration)) acceleration = 0;
        if (!isFinite(jerk))         jerk = 0;
    }

    const mouseData = {
        type: 'mouse_kinematics',
        x: event.clientX,
        y: event.clientY,
        v: parseFloat(velocity.toFixed(4)), // Redondeamos para no saturar la BD
        a: parseFloat(acceleration.toFixed(6)),
        jerk: parseFloat(jerk.toFixed(8)),
        timestamp: currentTime
    };

    telemetryBuffer.push(mouseData);

    // Actualizamos el estado para el siguiente fotograma
    lastX = event.clientX;
    lastY = event.clientY;
    lastTimeMouse = currentTime;
    lastVelocity = velocity;
    lastAcceleration = acceleration;
}, { passive: true });

// 2. Latencia de Teclado (Tiempo entre teclas)
document.addEventListener('keydown', (event) => {
    const currentTime = performance.now(); // Alta resolución temporal
    let latency = 0;

    if (lastKeyTime !== null) {
        latency = currentTime - lastKeyTime; // Milisegundos desde la última tecla
    }

    const keyData = {
        type: 'keystroke_latency',
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
    if (telemetryBuffer.length > 0 && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(telemetryBuffer));
        telemetryBuffer = [];
    }
}, 500);

// ==========================================
// Recepción de directivas neuroadaptativas
// del backend (ML + Gemini) vía WebSocket
// ==========================================
ws.onmessage = (event) => {
    try {
        const directives = JSON.parse(event.data);
        console.log("Directivas neuroadaptativas recibidas:", directives);

        // Si el estado cognitivo es Normal, forzamos action a 'none' para restaurar la UI
        if (directives.cognitive_state === "Normal" || directives.atypical === false) {
            directives.action = "none";
        }

        // Siempre llamamos a la función de adaptación, ya sea para adaptar o restaurar
        applyNeuroAdaptation(directives);
        
    } catch (err) {
        console.error("Error parseando directivas del backend:", err);
    }
};

/**
 * Aplica las directivas de adaptación cognitiva al DOM.
 * Modifica estilos, visibilidad y layout según el JSON
 * generado por el motor Gemini en el backend.
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

    if (directives.action === 'adapt' || directives.action === 'stress_detected') {
        // ── Incrementar nivel de adaptación progresiva ─────────────
        currentAdaptationLevel++;
        console.log(`[NeuroAdapt] Nivel de adaptación progresiva: ${currentAdaptationLevel}`);

        // ── NIVEL 1: Solo mutación CSS (sin llamada al backend) ───
        if (currentAdaptationLevel === 1) {
            root.style.setProperty('--dyn-font-size', '1.25rem');
            root.style.setProperty('--dyn-line-height', '1.9');
            root.style.setProperty('--dyn-letter-spacing', '0.03em');
            root.style.setProperty('--dyn-bg-color', '#fef9c3'); // Crema suave
            root.style.setProperty('--dyn-text-color', '#334155');

            if (readingContent) {
                readingContent.style.backgroundColor = '#fef9c3';
                readingContent.style.fontSize = '1.25rem';
                readingContent.style.lineHeight = '1.9';
            }
        }

        // ── NIVEL >= 2: Llamada al backend para simplificar texto ─
        if (currentAdaptationLevel >= 2) {
            root.style.setProperty('--dyn-font-size', '1.4rem');
            root.style.setProperty('--dyn-line-height', '2.0');
            root.style.setProperty('--dyn-letter-spacing', '0.06em');
            root.style.setProperty('--dyn-bg-color', '#FEF3C7');
            root.style.setProperty('--dyn-text-color', '#334155');

            // Extraer texto original del contenido de lectura
            const originalText = readingContent ? readingContent.innerText : '';

            if (originalText.trim().length > 0) {
                const token = localStorage.getItem('neuroadapt_token');
                const API_BASE = window.location.protocol === 'https:'
                    ? `https://${window.location.host}`
                    : `http://${window.location.host}`;

                try {
                    const response = await fetch(`${API_BASE}/student/simplify`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            text: originalText,
                            level: currentAdaptationLevel
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
        
        const response = await fetch(`${API_BASE}/student/simplify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ text: paragraphs })
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