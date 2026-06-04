// ==========================================
// Módulo de Captura Conductual Avanzada
// ==========================================

console.log("Módulo de telemetría conductual (con matemáticas) inicializado.");

// Conexión WebSocket al backend (a través de Nginx en puerto 80)
const ws = new WebSocket('ws://localhost/ws');
ws.onopen = () => console.log("WebSocket conectado al backend.");
ws.onerror = (err) => console.error("WebSocket error:", err);
ws.onclose = (e) => console.error(`WebSocket cerrado: code=${e.code} reason=${e.reason} wasClean=${e.wasClean}`);

let telemetryBuffer = [];

// Variables de estado para calcular deltas (diferencias)
let lastX = null, lastY = null, lastTimeMouse = null;
let lastVelocity = 0;
let lastKeyTime = null;
let hoverTimers = {}; // Diccionario para medir el Dwell Time

// 1. Cinemática del Ratón (Velocidad y Aceleración)
document.addEventListener('mousemove', (event) => {
    const currentTime = Date.now();
    let velocity = 0;
    let acceleration = 0;

    if (lastX !== null && lastTimeMouse !== null) {
        const deltaTime = currentTime - lastTimeMouse;

        if (deltaTime > 0) { // Evitamos divisiones por cero
            // Teorema de Pitágoras para la distancia euclidiana
            const distance = Math.sqrt(Math.pow(event.clientX - lastX, 2) + Math.pow(event.clientY - lastY, 2));

            velocity = distance / deltaTime; // px/ms
            acceleration = (velocity - lastVelocity) / deltaTime; // px/ms^2
        }
    }

    const mouseData = {
        type: 'mouse_kinematics',
        x: event.clientX,
        y: event.clientY,
        v: parseFloat(velocity.toFixed(4)), // Redondeamos para no saturar la BD
        a: parseFloat(acceleration.toFixed(6)),
        timestamp: currentTime
    };

    telemetryBuffer.push(mouseData);

    // Actualizamos el estado para el siguiente fotograma
    lastX = event.clientX;
    lastY = event.clientY;
    lastTimeMouse = currentTime;
    lastVelocity = velocity;
}, { passive: true });

// 2. Latencia de Teclado (Tiempo entre teclas)
document.addEventListener('keydown', (event) => {
    const currentTime = Date.now();
    let latency = 0;

    if (lastKeyTime !== null) {
        latency = currentTime - lastKeyTime; // Milisegundos desde la última tecla
    }

    const keyData = {
        type: 'keystroke_latency',
        key_code: event.code,
        latency_ms: latency,
        timestamp: currentTime
    };

    telemetryBuffer.push(keyData);
    console.log("Latencia de tipeo:", latency, "ms"); // Log de prueba

    lastKeyTime = currentTime;
}, { passive: true });

// 3. Dwell Time (Tiempo de duda/permanencia sobre botones e inputs)
// Detectamos cuando el usuario pone el ratón encima de un elemento interactivo
document.querySelectorAll('button, input').forEach(element => {

    // Inicia el cronómetro al entrar
    element.addEventListener('mouseenter', (e) => {
        const targetId = e.target.id || 'elemento_sin_id';
        hoverTimers[targetId] = Date.now();
    }, { passive: true });

    // Detiene el cronómetro al salir y calcula el Dwell Time
    element.addEventListener('mouseleave', (e) => {
        const targetId = e.target.id || 'elemento_sin_id';

        if (hoverTimers[targetId]) {
            const dwellTime = Date.now() - hoverTimers[targetId];

            const dwellData = {
                type: 'dwell_time',
                element_id: targetId,
                duration_ms: dwellTime,
                timestamp: Date.now()
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

        if (directives.action && directives.action !== "none") {
            applyNeuroAdaptation(directives);
        }
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
function applyNeuroAdaptation(directives) {
    console.log(`[NeuroAdapt] Aplicando adaptación: ${directives.action}`);

    const body = document.body;

    // ── Ajustar tamaño de fuente ──
    if (directives.font_size) {
        body.style.fontSize = directives.font_size;
        console.log(`[NeuroAdapt] font-size -> ${directives.font_size}`);
    }

    // ── Ajustar interlineado ──
    if (directives.line_height) {
        body.style.lineHeight = directives.line_height;
        console.log(`[NeuroAdapt] line-height -> ${directives.line_height}`);
    }

    // ── Tema visual calmante ──
    if (directives.theme) {
        // Removemos temas previos y aplicamos el nuevo
        body.classList.remove('neuro-theme-calm', 'neuro-theme-warm', 'neuro-theme-minimal');
        body.classList.add(`neuro-theme-${directives.theme}`);

        // Inyectamos variables CSS de tema si es necesario
        const themeStyles = {
            calm:    { bg: '#0a0a14', accent: '#6C5CE7', text: '#d8d8e8' },
            warm:    { bg: '#14100a', accent: '#FDCB6E', text: '#e8e0d0' },
            minimal: { bg: '#0f0f12', accent: '#81ECEC', text: '#e0e0e0' },
        };
        const t = themeStyles[directives.theme];
        if (t) {
            body.style.setProperty('--neuro-bg', t.bg);
            body.style.setProperty('--neuro-accent', t.accent);
            body.style.setProperty('--neuro-text', t.text);
        }
        console.log(`[NeuroAdapt] theme -> ${directives.theme}`);
    }

    // ── Ocultar/mostrar sidebar ──
    if (directives.hide_sidebar !== undefined) {
        const sidebar = document.querySelector('aside');
        const main = document.querySelector('main');
        if (sidebar) {
            if (directives.hide_sidebar) {
                sidebar.style.transition = 'transform 0.5s ease, opacity 0.5s ease';
                sidebar.style.transform = 'translateX(-100%)';
                sidebar.style.opacity = '0';
                sidebar.style.pointerEvents = 'none';
                if (main) main.style.marginLeft = '0';
            } else {
                sidebar.style.transform = 'translateX(0)';
                sidebar.style.opacity = '1';
                sidebar.style.pointerEvents = 'auto';
                if (main) main.style.marginLeft = '';
            }
        }
        console.log(`[NeuroAdapt] hide_sidebar -> ${directives.hide_sidebar}`);
    }

    // ── Simplificar contenido ──
    if (directives.simplify_content) {
        document.querySelectorAll('.hide-in-agentic').forEach(el => {
            el.style.opacity = '0.3';
            el.style.filter = 'blur(1px)';
        });
        console.log("[NeuroAdapt] Contenido simplificado (baja opacidad)");
    }

    // ── Notificación visual efímera ──
    if (directives.message) {
        showNeuroNotification(directives.message, directives.action);
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