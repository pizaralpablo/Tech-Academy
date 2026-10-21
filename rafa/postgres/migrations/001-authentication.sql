-- Esta migración agrega autenticación sin modificar la tabla users ni sus datos.
-- Debe ejecutarse manualmente una sola vez después de crear un respaldo.
BEGIN;

-- connect-pg-simple guarda aquí la sesión completa. sid es el identificador firmado
-- que referencia la cookie; sess contiene datos de sesión y expire controla su vencimiento.
CREATE TABLE IF NOT EXISTS user_sessions (
  sid VARCHAR NOT NULL COLLATE "default",
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL,
  CONSTRAINT user_sessions_pkey PRIMARY KEY (sid)
);

-- El índice permite retirar sesiones vencidas sin recorrer toda la tabla.
CREATE INDEX IF NOT EXISTS user_sessions_expire_idx
  ON user_sessions (expire);

-- Los intentos fallidos se comparten entre todos los Pods. El identificador es un
-- HMAC y no guarda directamente el username ni la dirección del cliente.
CREATE TABLE IF NOT EXISTS auth_login_attempts (
  identifier_hash VARCHAR(64) PRIMARY KEY,
  scope VARCHAR(16) NOT NULL CHECK (scope IN ('credential', 'ip')),
  failures INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Este índice facilita limpiar registros antiguos sin afectar las cuentas existentes.
CREATE INDEX IF NOT EXISTS auth_login_attempts_updated_idx
  ON auth_login_attempts (updated_at);

COMMIT;
