# Laboratorio de almacenamiento en Kubernetes

Este laboratorio compara aprovisionamiento estático y dinámico sin utilizar ni
modificar el PVC de PostgreSQL. Todos los comandos se ejecutan manualmente desde
la carpeta `rafa/`.

## Recursos aislados

| Ejemplo | Recurso | Nombre |
| --- | --- | --- |
| Estático | PersistentVolume | `rafa-storage-lab-static-pv` |
| Estático | PersistentVolumeClaim | `rafa-storage-lab-static-pvc` |
| Dinámico | StorageClass | `rafa-storage-lab-dynamic` |
| Dinámico | PersistentVolumeClaim | `rafa-storage-lab-dynamic-pvc` |

Los dos PVC pertenecen a `rafa-lab`, pero usan nombres y clases que no coinciden
con `postgres-data-rafael-postgres-0`. Ningún manifiesto referencia el StatefulSet,
el Service ni el almacenamiento de PostgreSQL.

## Diferencia entre los dos ejemplos

En el aprovisionamiento **estático**, una persona crea primero el PV y define su
capacidad, ubicación y política de recuperación. Después se crea un PVC compatible
que se vincula con ese PV. Aquí ambos declaran la clase exclusiva
`rafa-storage-lab-static`; no dependen de la StorageClass predeterminada.

En el aprovisionamiento **dinámico**, se crea una StorageClass y el PVC solicita
espacio a esa clase. El provisionador `k8s.io/minikube-hostpath` crea el PV sin que
tengamos que escribirlo manualmente.

## Dónde viven los datos

Minikube utiliza un nodo que se ejecuta dentro de Docker. Por eso `hostPath` apunta
al sistema de archivos del **nodo Minikube**, no directamente a una carpeta de
Windows. Este mecanismo es apropiado para un clúster local de un solo nodo, pero
no representa una solución de almacenamiento distribuido para producción.

El ejemplo estático usa `/data/rafa-storage-lab-static` con
`type: DirectoryOrCreate`, de modo que Kubernetes crea el directorio dentro del
nodo si todavía no existe.

## Retain y Delete

- `Retain` conserva el almacenamiento subyacente cuando se elimina el PVC. El PV
  queda disponible para recuperación manual y sus datos requieren limpieza o
  reutilización consciente.
- `Delete` solicita al provisionador que elimine el volumen dinámico y sus datos
  cuando se elimina el PVC correspondiente.

`Retain` **no equivale a un respaldo**. Los datos continúan dependiendo del nodo
Minikube y pueden perderse si el perfil, el nodo o su almacenamiento se eliminan.
Un respaldo real debe existir en otra ubicación y tener un proceso de restauración
probado.

## 1. Confirmar que PostgreSQL sigue separado

Antes de comenzar, verificar el PVC existente y anotar su nombre y estado:

```bash
kubectl get pvc postgres-data-rafael-postgres-0 -n rafa-lab -o wide
```

El comando debe mostrar el PVC de PostgreSQL como `Bound`. No se debe editar ni
eliminar durante este laboratorio.

## 2. Validar los manifiestos sin aplicarlos

```bash
kubectl apply --dry-run=client -f storage-lab/static/persistent-volume.yaml
kubectl apply --dry-run=client -f storage-lab/static/persistent-volume-claim.yaml
kubectl apply --dry-run=client -f storage-lab/dynamic/storage-class.yaml
kubectl apply --dry-run=client -f storage-lab/dynamic/persistent-volume-claim.yaml
```

## 3. Probar el aprovisionamiento estático

Crear primero el PV y después el PVC que lo reclama:

```bash
kubectl apply -f storage-lab/static/persistent-volume.yaml
kubectl apply -f storage-lab/static/persistent-volume-claim.yaml
```

Comprobar que ambos quedaron vinculados entre sí:

```bash
kubectl get pv rafa-storage-lab-static-pv
kubectl get pvc rafa-storage-lab-static-pvc -n rafa-lab -o wide
kubectl describe pv rafa-storage-lab-static-pv
kubectl describe pvc rafa-storage-lab-static-pvc -n rafa-lab
```

El PV y el PVC deben mostrar estado `Bound`, capacidad `256Mi` y clase
`rafa-storage-lab-static`.

## 4. Probar el aprovisionamiento dinámico

Crear primero la StorageClass y después el PVC:

```bash
kubectl apply -f storage-lab/dynamic/storage-class.yaml
kubectl apply -f storage-lab/dynamic/persistent-volume-claim.yaml
```

Verificar que Minikube creó un PV y lo vinculó automáticamente:

```bash
kubectl get storageclass rafa-storage-lab-dynamic
kubectl get pvc rafa-storage-lab-dynamic-pvc -n rafa-lab -o wide
kubectl describe pvc rafa-storage-lab-dynamic-pvc -n rafa-lab
kubectl get pv
```

El PVC debe quedar `Bound`. En su columna `VOLUME` aparecerá el nombre generado
del PV dinámico; ese nombre será diferente en cada creación.

## 5. Comparar sin afectar PostgreSQL

```bash
kubectl get pv
kubectl get pvc -n rafa-lab
kubectl get storageclass
kubectl get pods -n rafa-lab
```

Esta revisión debe mostrar los dos PVC del laboratorio junto al PVC de PostgreSQL,
sin reiniciar ni reemplazar ningún Pod de la aplicación.

## 6. Limpiar solamente el laboratorio

Usar siempre los nombres completos. Primero eliminar los PVC y luego sus recursos
de aprovisionamiento:

```bash
kubectl delete pvc rafa-storage-lab-static-pvc -n rafa-lab
kubectl delete pv rafa-storage-lab-static-pv
kubectl delete pvc rafa-storage-lab-dynamic-pvc -n rafa-lab
kubectl delete storageclass rafa-storage-lab-dynamic
```

Con `Retain`, eliminar el PV estático no borra automáticamente el directorio ni
convierte su contenido en un respaldo. Con `Delete`, eliminar el PVC dinámico pide
al provisionador que borre su PV y sus datos.

No ejecutar ninguno de estos comandos durante la limpieza:

```text
kubectl delete pvc --all -n rafa-lab
kubectl delete pv --all
kubectl delete namespace rafa-lab
kubectl delete pvc postgres-data-rafael-postgres-0 -n rafa-lab
```

Al terminar, confirmar que PostgreSQL continúa intacto:

```bash
kubectl get pvc postgres-data-rafael-postgres-0 -n rafa-lab -o wide
kubectl get pods -n rafa-lab
```
