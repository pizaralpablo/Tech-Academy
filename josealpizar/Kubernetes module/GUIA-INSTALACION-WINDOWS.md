# Guía de instalación en Windows

Esta guía resume la instalación del entorno local para trabajar con Kubernetes, Docker, Terraform y OpenLens.

## 1. Requisitos

- Windows 11 o Windows 10 actualizado.
- PowerShell.
- Permisos de administrador para Docker Desktop y WSL2.
- Conexión a Internet.

## 2. Comprobar WinGet

Abrir PowerShell y comprobar que `winget` está disponible:

```powershell
winget --version
```

Si el comando no existe, instalar o actualizar **App Installer** desde Microsoft Store.

## 3. Instalar las herramientas

Ejecutar estos comandos en PowerShell:

```powershell
winget install --id Microsoft.VisualStudioCode --exact --silent --accept-package-agreements --accept-source-agreements
winget install --id Docker.DockerDesktop --exact --silent --accept-package-agreements --accept-source-agreements
winget install --id Kubernetes.minikube --exact --silent --accept-package-agreements --accept-source-agreements
winget install --id Hashicorp.Terraform --exact --silent --accept-package-agreements --accept-source-agreements
winget install --id MuhammedKalkan.OpenLens --exact --silent --accept-package-agreements --accept-source-agreements
```

Durante esta instalación:

- Visual Studio Code puede indicar que ya está instalado.
- Docker Desktop puede solicitar permisos de administrador.
- Si OpenLens ya estaba abierto durante la instalación, cerrarlo y repetir el comando.

## 4. Instalar WSL2

Docker Desktop necesita WSL2 para ejecutar contenedores Linux. Ejecutar PowerShell como administrador:

```powershell
wsl --install --no-distribution
```

Reiniciar Windows cuando el sistema lo solicite. Después del reinicio, abrir Docker Desktop y esperar a que el motor esté iniciado.

Comprobar Docker:

```powershell
docker version
docker info
```

La salida debe mostrar una sección `Server` y el sistema Linux de Docker Desktop.

## 5. Comprobar las herramientas

Después de instalar o reiniciar, abrir una nueva terminal para actualizar el `PATH` y ejecutar:

```powershell
code --version
docker --version
minikube version
terraform version
```

## 6. Crear el clúster local

Iniciar Docker Desktop y crear el clúster Minikube usando Docker:

```powershell
minikube start --driver=docker
```

Comprobar el estado:

```powershell
minikube status
kubectl config current-context
kubectl get nodes
```

El contexto debe ser `minikube` y el nodo debe aparecer como `Ready`.

Si `kubectl` no está disponible, se puede usar el cliente incluido por Minikube:

```powershell
minikube kubectl -- get nodes
```

## 7. Abrir el clúster en OpenLens

Abrir OpenLens desde el menú Inicio. OpenLens normalmente detecta el archivo de configuración de Kubernetes automáticamente.

En OpenLens, seleccionar el contexto o clúster `minikube`.

Para confirmar el contexto desde PowerShell:

```powershell
kubectl config use-context minikube
```

## 8. Construir la imagen Node

La aplicación y sus Dockerfiles están en la carpeta `docker`. Construir y cargar la imagen en Minikube:

```powershell
cd C:\Users\PASHA\k8s-lab
docker build -f .\docker\Dockerfile.node -t k8s-lab-node:latest .\docker
minikube image load k8s-lab-node:latest
```

## 9. Crear la base de datos y desplegar la website en Kubernetes

Los manifiestos de Kubernetes están en la carpeta `kubernetes`:

```powershell
kubectl apply -f .\kubernetes\secrets\postgres-secret.yaml
kubectl apply -f .\kubernetes\services\postgres-service.yaml
kubectl apply -f .\kubernetes\storage\postgres-storageclass.yaml
kubectl apply -f .\kubernetes\storage\postgres-pv.yaml
kubectl apply -f .\kubernetes\storage\postgres-pvc.yaml
kubectl apply -f .\kubernetes\pods\postgres-statefulset.yaml
kubectl apply -f .\kubernetes\quotas\resource-quota.yaml
kubectl apply -f .\kubernetes\pods\deployment.yaml
kubectl apply -f .\kubernetes\services\service.yaml
kubectl apply -f .\kubernetes\pods\postgres-health-cronjob.yaml
kubectl apply -f .\kubernetes\ingress\web-ingress.yaml
kubectl apply -f .\kubernetes\configmaps\fluent-bit-config.yaml
kubectl apply -f .\kubernetes\pods\fluent-bit-daemonset.yaml
kubectl apply -f .\kubernetes\configmaps\loki-config.yaml
kubectl apply -f .\kubernetes\configmaps\grafana-datasource.yaml
kubectl apply -f .\kubernetes\pods\loki-deployment.yaml
kubectl apply -f .\kubernetes\pods\grafana-deployment.yaml
kubectl apply -f .\kubernetes\services\loki-service.yaml
kubectl apply -f .\kubernetes\services\grafana-service.yaml
kubectl apply -f .\kubernetes\ingress\grafana-ingress.yaml
kubectl rollout status statefulset/postgres -n test
kubectl rollout status deployment/node-web -n test
kubectl get pods,service -n test
kubectl get resourcequota -n test
kubectl get daemonset fluent-bit -n test
```

`secrets/postgres-secret.yaml` administra las credenciales. Los archivos de `storage/` declaran la StorageClass, el PV y el PVC explícitos de PostgreSQL. `pods/postgres-statefulset.yaml` monta `postgres-pvc` y crea una instancia PostgreSQL single con almacenamiento persistente. La carpeta `pods` contiene los recursos que crean o administran Pods: `pod.yaml`, `deployment.yaml`, `postgres-statefulset.yaml` y `postgres-health-cronjob.yaml`. La base de datos no se expone fuera del clúster. Cambiar `change-this-password` en el Secret antes de usar este ejemplo fuera de un entorno local.

`quotas/resource-quota.yaml` limita el consumo total del namespace `test` y la cantidad de Pods, Services y PVCs.

`configmaps/fluent-bit-config.yaml` configura la lectura de logs de los contenedores y `pods/fluent-bit-daemonset.yaml` ejecuta un agente Fluent Bit por nodo. Para revisar los logs recolectados en este laboratorio:

```powershell
kubectl get pods -n test -l app=fluent-bit -o wide
kubectl logs -n test -l app=fluent-bit --tail=50
```

La página web incluye formularios de registro e inicio de sesión. Node.js se conecta a PostgreSQL usando el Service interno y guarda únicamente hashes de las contraseñas.

El Service web es interno y el Ingress funciona como punto de entrada. Activar el controlador Ingress de Minikube:

```powershell
minikube addons enable ingress
kubectl get ingress -n test
```

Con el driver Docker en Windows, el Ingress necesita un tunel activo para
publicar sus puertos en el equipo local. Abrir otra PowerShell y dejarla
ejecutando durante el uso del laboratorio:

```powershell
minikube tunnel
```

El tunel debe permanecer abierto. Si se cierra, los Ingress seguiran
apareciendo en Kubernetes, pero las URLs dejaran de responder desde Windows.

Para usar el hostname local, agrega esta línea al archivo `C:\Windows\System32\drivers\etc\hosts` como administrador:

```text
127.0.0.1 k8s-lab.local
127.0.0.1 grafana.k8s-lab.local
```

Crear el certificado TLS local y el Secret usado por el Ingress mediante el script:

```powershell
& .\kubernetes\tls\create-node-web-tls.ps1
```

La website estará disponible en `https://k8s-lab.local`. El navegador mostrará una advertencia porque el certificado es autofirmado.

Grafana estará disponible en `https://grafana.k8s-lab.local` con el usuario `admin` y la password local `admin123`. Fluent Bit envia los logs a Loki y Grafana ya tiene Loki configurado como fuente de datos.

Comprobar el acceso al finalizar:

```powershell
kubectl get ingress -n test
curl.exe -k -I https://k8s-lab.local/
curl.exe -k -I https://grafana.k8s-lab.local/
```

La web debe responder con `200 OK` y Grafana normalmente con `302 Found` hacia `/login`.

## 10. Crear el Pod de ejemplo

El manifiesto está guardado en:

```text
C:\Users\PASHA\k8s-lab\kubernetes\pods\pod.yaml
```

Su contenido crea un Pod Nginx:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
  namespace: test
  labels:
    app: nginx
spec:
  containers:
    - name: nginx
      image: nginx:latest
      ports:
        - containerPort: 80
```

Desde PowerShell, entrar en la carpeta y aplicar el manifiesto:

```powershell
cd C:\Users\PASHA\k8s-lab
kubectl apply -f .\kubernetes\pods\pod.yaml
kubectl get pods -n test
```

También se puede aplicar usando Minikube:

```powershell
minikube kubectl -- apply -f .\kubernetes\pods\pod.yaml
minikube kubectl -- get pods -n test
```

En OpenLens, el Pod aparecerá dentro del clúster `minikube`, en la sección de Pods del namespace `test`.

## 11. Comandos útiles

```powershell
kubectl get pods -n test -o wide
kubectl describe pod nginx-pod -n test
kubectl logs nginx-pod -n test
kubectl delete pod nginx-pod -n test
minikube stop
minikube start
minikube delete
```

## 12. Problemas frecuentes

### Docker no conecta con el engine

Abrir Docker Desktop y esperar a que indique que está funcionando. Comprobar el contexto:

```powershell
docker context ls
docker version
```

El contexto recomendado es `desktop-linux`.

### El nodo aparece como `NotReady`

Esperar unos segundos y comprobarlo de nuevo:

```powershell
kubectl wait --for=condition=Ready node/minikube --timeout=120s
kubectl get nodes
```

### Los comandos recién instalados no se reconocen

Cerrar la terminal y abrir una nueva. Los instaladores pueden modificar el `PATH` y la terminal existente no siempre detecta el cambio.

### OpenLens no muestra el clúster automáticamente

En OpenLens, añadir el archivo de configuración de Kubernetes ubicado normalmente en:

```text
%USERPROFILE%\.kube\config
```

Seleccionar el contexto `minikube`.
