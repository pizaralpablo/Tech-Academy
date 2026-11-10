-- Crea la base de datos si no existe
CREATE DATABASE IF NOT EXISTS empresa_db;
USE empresa_db;

-- Store password hashes, never plaintext passwords.
CREATE TABLE IF NOT EXISTS app_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);