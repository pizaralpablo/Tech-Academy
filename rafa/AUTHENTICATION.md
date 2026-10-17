# Autenticación de RAFA // TECH ACADEMY

La aplicación guarda sesiones e intentos de login en PostgreSQL para que las dos
réplicas web compartan el mismo estado. Ninguna migración se ejecuta al iniciar un Pod.

## Límites de login

- Cinco fallos por combinación de IP y username dentro de quince minutos.
- Veinte fallos por IP dentro de quince minutos.
- El bloqueo temporal dura quince minutos y responde con HTTP 429.
- Un login correcto limpia solamente la combinación IP y username.
- Después de un login correcto también se eliminan límites vencidos con más de 24 horas.

No existe un bloqueo global por cuenta. Así evitamos que una persona pueda bloquear
por mucho tiempo una cuenta ajena con intentos deliberados. Como consecuencia, un
ataque distribuido desde muchas direcciones podría superar este control básico.

## 1. Respaldar PostgreSQL

Desde Git Bash, crear primero un respaldo fuera del repositorio:

```bash
kubectl exec -n rafa-lab rafael-postgres-0 -- \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=plain' \
  > ../rafa_lab_before_auth.sql
```

Confirmar que el archivo no esté vacío antes de continuar. Este respaldo contiene
datos del laboratorio y no debe agregarse a Git.

## 2. Ejecutar la migración manual

```bash
kubectl exec -i -n rafa-lab rafael-postgres-0 -- \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < postgres/migrations/001-authentication.sql
```

La migración crea `user_sessions` y `auth_login_attempts`. Es aditiva, idempotente
y no cambia la tabla `users`.

## 3. Crear el Secret sin escribir valores en el historial

Los archivos temporales se generan fuera del repositorio y se eliminan después:

```bash
umask 077
openssl rand -base64 48 > /tmp/rafa-session-secret
openssl rand -base64 48 > /tmp/rafa-rate-limit-secret

kubectl create secret generic rafael-web-auth \
  --namespace rafa-lab \
  --from-file=session-secret=/tmp/rafa-session-secret \
  --from-file=rate-limit-secret=/tmp/rafa-rate-limit-secret

rm /tmp/rafa-session-secret /tmp/rafa-rate-limit-secret
```

No usar `--from-literal` con el valor visible, porque podría quedar en el historial.

## 4. Construir y cargar la imagen

```bash
docker build -f Dockerfile.rafael -t rafael-web-node:1.5 .
minikube image load rafael-web-node:1.5
```

## 5. Desplegar y verificar

```bash
kubectl apply -f deployment.yaml
kubectl rollout status deployment/rafael-web -n rafa-lab
kubectl get pods -n rafa-lab -l app=rafael-web
kubectl logs -n rafa-lab deployment/rafael-web --tail=100
```

La salida no debe mostrar cookies, tokens CSRF, contraseñas ni secretos. Probar login,
dashboard y logout; después eliminar solamente un Pod web y confirmar que la sesión
sigue funcionando cuando Kubernetes lo recrea. No eliminar PostgreSQL ni su PVC.

## HTTPS futuro

Con un Ingress HTTPS, cambiar `SESSION_COOKIE_SECURE` y `TRUST_PROXY` a `"true"`.
La cookie pasará a llamarse `__Host-rafa.sid`. No habilitar estas opciones mientras
el acceso sea HTTP porque el navegador no enviaría una cookie marcada como Secure.
