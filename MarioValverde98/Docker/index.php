<?php
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$mensaje = '';
$error = false;
$usuarios = [];
$db = null;

$host = getenv('DB_HOST');
$nombreBase = getenv('DB_NAME');
$usuarioDb = getenv('DB_USER');
$contrasenaDb = getenv('DB_PASSWORD');

if (!$host || !$nombreBase || !$usuarioDb || !$contrasenaDb) {
    $mensaje = 'Falta configurar la conexión a la base de datos.';
    $error = true;
} else {
    try {
        $db = new mysqli($host, $usuarioDb, $contrasenaDb, $nombreBase);
        $db->set_charset('utf8mb4');

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $nombre = trim($_POST['nombre'] ?? '');
            $contrasena = $_POST['contrasena'] ?? '';

            if (!preg_match('/^[A-Za-z0-9_.-]{3,50}$/', $nombre)) {
                $mensaje = 'El nombre debe tener entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo.';
                $error = true;
            } elseif (strlen($contrasena) < 8 || strlen($contrasena) > 72) {
                $mensaje = 'La contraseña debe tener entre 8 y 72 caracteres.';
                $error = true;
            } else {
                $hash = password_hash($contrasena, PASSWORD_DEFAULT);
                $consulta = $db->prepare(
                    'INSERT INTO app_users (username, password_hash) VALUES (?, ?)'
                );
                $consulta->bind_param('ss', $nombre, $hash);
                $consulta->execute();

                $mensaje = 'Usuario guardado correctamente.';
            }
        }


    } catch (mysqli_sql_exception $e) {
        error_log('Error de base de datos: ' . $e->getMessage());

        if ($e->getCode() === 1062) {
            $mensaje = 'Ese nombre de usuario ya existe.';
        } else {
            $mensaje = 'No se pudo consultar la base de datos. Revisa la configuración.';
        }

        $error = true;
    }
    if ($db instanceof mysqli) {
        try {
            $resultado = $db->query(
                'SELECT username, created_at FROM app_users ORDER BY id DESC LIMIT 100'
            );
            $usuarios = $resultado->fetch_all(MYSQLI_ASSOC);
        } catch (mysqli_sql_exception $e) {
            error_log('Error al consultar usuarios: ' . $e->getMessage());
            $usuarios = [];

            if ($mensaje === '') {
                $mensaje = 'No se pudo cargar la lista de usuarios.';
            }

            $error = true;
        }
    }
}

function escapar($valor)
{
    return htmlspecialchars((string) $valor, ENT_QUOTES, 'UTF-8');
}
?>
<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Usuarios de Mario</title>
</head>
<body>
    <h1>Crear usuario de prueba</h1>

    <form method="post">
        <p>
            <label for="nombre">Nombre de usuario:</label>
            <input
                id="nombre"
                name="nombre"
                required
                minlength="3"
                maxlength="50"
            >
        </p>

        <p>
            <label for="contrasena">Contraseña de prueba:</label>
            <input
                id="contrasena"
                name="contrasena"
                type="password"
                required
                minlength="8"
                maxlength="72"
            >
        </p>

        <button type="submit">Guardar usuario</button>
    </form>

    <?php if ($mensaje !== ''): ?>
        <p><?= escapar($mensaje) ?></p>
    <?php endif; ?>

    <h2>Usuarios guardados</h2>

    <?php if (count($usuarios) === 0): ?>
        <p>Aún no hay usuarios creados desde esta página.</p>
    <?php else: ?>
        <ul>
            <?php foreach ($usuarios as $usuario): ?>
                <li>
                    <?= escapar($usuario['username']) ?>
                    — <?= escapar($usuario['created_at']) ?>
                </li>
            <?php endforeach; ?>
        </ul>
    <?php endif; ?>
</body>
</html>