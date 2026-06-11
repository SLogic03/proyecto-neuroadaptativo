"""
====================================================================
 llm_service.py  --  Sprint 2 / Bloque 2
 Servicio de IA Generativa para directivas DOM neuroadaptativas.
 Utiliza Gemini 3.1 Flash Lite para generar instrucciones de
 adaptacion cognitiva del frontend en tiempo real.
====================================================================
"""

import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

# ── Cargar variables de entorno desde .env ─────────────────────────
load_dotenv()

# ── Configuracion de Gemini (LS-17) ───────────────────────────────
API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    print("[LLM] ADVERTENCIA: GEMINI_API_KEY no encontrada en variables de entorno.")
else:
    genai.configure(api_key=API_KEY)
    print("[LLM] Gemini API configurada correctamente.")

# Modelo optimizado para velocidad y cuota gratuita
MODEL_NAME = "gemini-3.1-flash-lite"

# ── Respuestas predefinidas ────────────────────────────────────────
BASE_RESPONSE = {
    "action": "none",
    "message": "Estado cognitivo normal. Sin adaptaciones necesarias."
}

FALLBACK_RESPONSE = {
    "action": "fallback",
    "theme": "calm_default",
    "font_size": "105%",
    "line_height": "1.7",
    "hide_sidebar": False,
    "simplify_content": False,
    "message": "Respuesta de contingencia aplicada por error en el servicio LLM."
}

# ── Prompt del sistema ─────────────────────────────────────────────
SYSTEM_PROMPT = (
    "Eres un motor de accesibilidad cognitiva integrado en una plataforma "
    "educativa neuroadaptativa. Tu funcion es generar directivas JSON para "
    "modificar el DOM del frontend y reducir la carga cognitiva del usuario.\n\n"
    "REGLAS ESTRICTAS:\n"
    "1. Responde UNICAMENTE con un objeto JSON valido, sin markdown, sin "
    "comentarios, sin texto adicional.\n"
    "2. El JSON debe contener exactamente estas claves:\n"
    '   - "action": "adapt"\n'
    '   - "theme": un tema visual calmante (ej. "calm", "warm", "minimal")\n'
    '   - "font_size": porcentaje CSS (ej. "110%", "115%")\n'
    '   - "line_height": valor numerico como string (ej. "1.8", "2.0")\n'
    '   - "hide_sidebar": booleano true/false\n'
    '   - "simplify_content": booleano true/false\n'
    '   - "message": breve descripcion de la adaptacion en espanol\n'
    "3. Ajusta la intensidad de la adaptacion segun la severidad del estado "
    "cognitivo reportado.\n"
)


async def get_dom_directives(
    cognitive_state: str,
    features: dict = None,
) -> dict:
    """Genera directivas de adaptacion DOM basadas en el estado cognitivo.

    Args:
        cognitive_state: Estado detectado ("Normal", "Estres", "Frustracion").
        features: Metricas opcionales del modelo ML (velocity, jerk, etc.).

    Returns:
        Diccionario con directivas para modificar el DOM del frontend.
    """

    # ── Atajo: estado normal -> respuesta instantanea sin API call ──
    if cognitive_state.lower() in ("normal", "base", "ok"):
        print(f"[LLM] Estado '{cognitive_state}' -> sin adaptacion (bypass API)")
        return BASE_RESPONSE

    # ── Construir el prompt del usuario (LS-16) ────────────────────
    user_prompt = (
        f"Estado cognitivo detectado: **{cognitive_state}**.\n"
    )

    if features:
        user_prompt += (
            f"Metricas del modelo ML:\n"
            f"- Velocidad del raton: {features.get('velocity', 'N/A')} px/ms\n"
            f"- Aceleracion: {features.get('acceleration', 'N/A')} px/ms2\n"
            f"- Jerk: {features.get('jerk', 'N/A')}\n"
            f"- Tiempo inactivo: {features.get('idle_time', 'N/A')} s\n"
            f"- Click rate: {features.get('click_rate', 'N/A')} clicks\n"
            f"- Indice de estres: {features.get('stress_index', 'N/A')}\n"
        )

    user_prompt += (
        "\nGenera las directivas DOM JSON para adaptar la interfaz y "
        "reducir la carga cognitiva del estudiante."
    )

    # ── Llamada a Gemini con resiliencia (LS-20) ───────────────────
    try:
        print(f"[LLM] Consultando {MODEL_NAME} para estado '{cognitive_state}'...")

        model = genai.GenerativeModel(
            model_name=MODEL_NAME,
            system_instruction=SYSTEM_PROMPT,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.3,
                max_output_tokens=256,
            ),
        )

        response = await model.generate_content_async(user_prompt)

        # Extraer el texto y parsear JSON
        raw_text = response.text.strip()
        directives = json.loads(raw_text)

        print(f"[LLM] Directivas generadas exitosamente: {directives.get('action', '?')}")
        return directives

    except json.JSONDecodeError as e:
        print(f"[LLM][ERROR] Respuesta no es JSON valido: {e}")
        print(f"[LLM][ERROR] Texto crudo recibido: {raw_text[:200]}")
        return FALLBACK_RESPONSE

    except Exception as e:
        print(f"[LLM][ERROR] Fallo en llamada a Gemini: {type(e).__name__}: {e}")
        return FALLBACK_RESPONSE


async def simplify_text(text: str) -> str:
    """Utiliza Gemini para generar un resumen simplificado del texto dado."""
    try:
        print(f"[LLM] Solicitando simplificación de texto ({len(text)} caracteres)...")
        
        prompt = (
            "Actúa como un tutor experto en accesibilidad cognitiva. "
            "Tu tarea es tomar el siguiente texto, que puede ser complejo o legal, "
            "y resumirlo en unas pocas viñetas (bullet points) usando un lenguaje "
            "extremadamente claro, sencillo y directo. "
            "Usa emojis para hacerlo más amigable.\n\n"
            f"Texto original:\n{text}\n\n"
            "Resumen simplificado en formato HTML (usa <ul> y <li>):"
        )
        
        model = genai.GenerativeModel(
            model_name=MODEL_NAME,
            generation_config=genai.GenerationConfig(
                temperature=0.4,
                max_output_tokens=512,
            ),
        )
        
        response = await model.generate_content_async(prompt)
        return response.text.strip()
        
    except Exception as e:
        print(f"[LLM][ERROR] Fallo en simplificación de texto: {type(e).__name__}: {e}")
        return "<ul><li>No se pudo generar el resumen simplificado debido a un error de conexión con la IA.</li></ul>"
