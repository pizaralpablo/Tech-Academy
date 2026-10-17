-- PostgreSQL ejecuta este archivo únicamente cuando inicializa un directorio de
-- datos vacío. Si la base ya contiene datos, el script no vuelve a ejecutarse.
-- Por eso este archivo prepara el esquema inicial, pero no sustituye un sistema
-- de migraciones para cambios futuros.

-- IF NOT EXISTS permite repetir manualmente esta sentencia sin intentar crear
-- una segunda tabla con el mismo nombre.
CREATE TABLE IF NOT EXISTS users (
  -- Identificador numérico generado automáticamente para cada usuario.
  id BIGSERIAL PRIMARY KEY,

  -- Nombre elegido por el usuario. NOT NULL lo hace obligatorio y UNIQUE evita
  -- que dos cuentas utilicen exactamente el mismo nombre.
  username VARCHAR(80) NOT NULL UNIQUE,

  -- Aquí se guardará únicamente el hash seguro generado por la aplicación.
  -- La contraseña original nunca debe almacenarse en texto plano.
  password_hash VARCHAR(255) NOT NULL,

  -- Fecha y hora de creación de la cuenta, registrada automáticamente con zona horaria.
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
