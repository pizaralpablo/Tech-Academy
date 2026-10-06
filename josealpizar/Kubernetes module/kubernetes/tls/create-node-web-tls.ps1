# Define una carpeta temporal fuera de los manifiestos para el certificado local.
$temporaryDirectory = Join-Path $env:TEMP 'k8s-lab-tls'

# Crea la carpeta temporal si todavía no existe.
New-Item -ItemType Directory -Force -Path $temporaryDirectory | Out-Null

try {
    # Genera un certificado autofirmado para el hostname del Ingress usando Docker.
    docker run --rm -v "${temporaryDirectory}:/certs" alpine/openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /certs/tls.key -out /certs/tls.crt -subj "/CN=k8s-lab.local" -addext "subjectAltName=DNS:k8s-lab.local,DNS:grafana.k8s-lab.local"
    if ($LASTEXITCODE -ne 0) {
        throw 'No se pudo generar el certificado TLS.'
    }

    # Crea o actualiza el Secret TLS en el namespace test.
    kubectl create secret tls node-web-tls --cert="$temporaryDirectory\tls.crt" --key="$temporaryDirectory\tls.key" -n test --dry-run=client -o yaml | kubectl apply -f -
    if ($LASTEXITCODE -ne 0) {
        throw 'No se pudo crear o actualizar el Secret node-web-tls.'
    }

    # Aplica el Ingress que referencia el Secret TLS.
    kubectl apply -f "$PSScriptRoot\..\ingress\web-ingress.yaml"
}
finally {
    # Elimina el certificado y la clave privada del equipo al terminar.
    Remove-Item -Path $temporaryDirectory -Recurse -Force -ErrorAction SilentlyContinue
}
