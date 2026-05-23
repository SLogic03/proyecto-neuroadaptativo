-- Habilitar la extensión para generar UUIDs automáticamente
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Sesiones
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Eventos (Telemetría pura)
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    client_timestamp BIGINT NOT NULL, -- BIGINT porque Date.now() en JS devuelve milisegundos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Inferencias (Resultados del ML y directivas del LLM)
CREATE TABLE inferences (
    id SERIAL PRIMARY KEY,
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    stress_level FLOAT,
    raw_llm_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para búsquedas rápidas (Vital para el Dashboard posterior)
CREATE INDEX idx_events_session ON events(session_id);
CREATE INDEX idx_inferences_session ON inferences(session_id);