# PostgreSQL en Kubernetes

Esta guía despliega la base de datos de la Tarea 2 en `rafa-lab`. Los comandos se
ejecutan manualmente desde la carpeta `rafa/`; ninguna contraseña real se guarda
en el repositorio.

## 1. Preparar las imágenes

Construir la imagen personalizada de PostgreSQL y la versión 1.2 de la aplicación:

```bash
docker build -t rafael-postgres:1.0 ./postgres
docker build -t rafael-web-node:1.2 -f Dockerfile.rafael .
```

Minikube utiliza su propio runtime containerd. Por eso ambas imágenes deben
cargarse después de construirlas con Docker:

```bash
minikube image load rafael-postgres:1.0
minikube image load rafael-web-node:1.2
minikube image ls
```

## 2. Crear el Secret sin escribir la contraseña en el historial

El Secret debe llamarse `rafael-postgres-credentials`, pertenecer a `rafa-lab` y
contener una clave llamada `password`. El valor base64 de un Secret no equivale a
cifrado, así que no se debe exportar su YAML ni guardarlo en Git.

En Git Bash, leer la contraseña sin mostrarla en pantalla:

```bash
read -s -p "Contraseña de PostgreSQL: " POSTGRES_PASSWORD
echo
kubectl create secret generic rafael-postgres-credentials --namespace rafa-lab --from-literal=password="$POSTGRES_PASSWORD"
unset POSTGRES_PASSWORD
```

En PowerShell, solicitarla como dato protegido y pasarla mediante una variable:

```powershell
$SecurePassword = Read-Host "Contraseña de PostgreSQL" -AsSecureString
$PostgresPassword = [System.Net.NetworkCredential]::new("", $SecurePassword).Password
kubectl create secret generic rafael-postgres-credentials --namespace rafa-lab --from-literal=password="$PostgresPassword"
Remove-Variable SecurePassword, PostgresPassword
```

En ambos casos el historial guarda el nombre de la variable, no la contraseña
literal. El Secret debe existir antes de crear los Pods que lo consumen.

## 3. Desplegar en orden

El Service se crea primero para que el nombre DNS esté disponible. Después se
crean PostgreSQL y la aplicación web:

```bash
kubectl apply -f postgres/service.yaml
kubectl apply -f postgres/statefulset.yaml
kubectl rollout status statefulset/rafael-postgres -n rafa-lab --timeout=180s
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl rollout status deployment/rafael-web -n rafa-lab --timeout=180s
```

## 4. Verificar los recursos

```bash
kubectl get pods -n rafa-lab -o wide
kubectl get pvc -n rafa-lab
kubectl get services -n rafa-lab
kubectl describe statefulset rafael-postgres -n rafa-lab
kubectl logs rafael-postgres-0 -n rafa-lab
kubectl logs -l app=rafael-web -n rafa-lab --prefix=true
kubectl exec rafael-postgres-0 -n rafa-lab -- psql -U postgres -d rafa_lab -c "\d users"
```

El PVC esperado se llama `postgres-data-rafael-postgres-0`. Si permanece en
`Pending`, hay que revisar que Minikube tenga una StorageClass predeterminada con
`kubectl get storageclass`.

## 5. Abrir y probar la aplicación

```bash
minikube service rafael-web-service -n rafa-lab --url
```

Abrir la URL devuelta, registrar un usuario y confirmar que aparece en PostgreSQL
sin consultar la columna `password_hash`:

```bash
kubectl exec rafael-postgres-0 -n rafa-lab -- psql -U postgres -d rafa_lab -c "SELECT id, username, created_at FROM users;"
```

## 6. Probar la persistencia

Primero registrar al menos un usuario. Luego eliminar solamente el Pod y esperar
a que el StatefulSet lo cree de nuevo con el mismo PVC:

```bash
kubectl delete pod rafael-postgres-0 -n rafa-lab
kubectl wait --for=condition=Ready pod/rafael-postgres-0 -n rafa-lab --timeout=180s
kubectl exec rafael-postgres-0 -n rafa-lab -- psql -U postgres -d rafa_lab -c "SELECT id, username, created_at FROM users;"
```

Los usuarios deben seguir presentes. `init.sql` se ejecuta solamente cuando el
directorio de datos está vacío; no vuelve a ejecutarse al recrear el Pod.

## 7. Limpiar sin borrar los datos

Eliminar los workloads, Services y el Secret de forma explícita. No eliminar el
PVC ni el Namespace si se desea conservar la base:

```bash
kubectl delete deployment rafael-web -n rafa-lab
kubectl delete statefulset rafael-postgres -n rafa-lab
kubectl delete service rafael-web-service rafael-postgres -n rafa-lab
kubectl delete secret rafael-postgres-credentials -n rafa-lab
kubectl get pvc -n rafa-lab
```

No ejecutar `kubectl delete pvc` ni `kubectl delete namespace rafa-lab` durante
esta limpieza: cualquiera de esas acciones puede eliminar el almacenamiento que
se quiere conservar. Para volver a desplegar, recrear primero el Secret y repetir
el orden de la sección 3.
