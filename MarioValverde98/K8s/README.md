# Database credentials

The real `secret-db.yaml` file is local-only and is excluded from Git. Do not
commit it: Kubernetes Secret manifests contain their values in readable form
when using `stringData`.

To create a local manifest:

1. Copy `secret-db.yaml.example` to `secret-db.yaml`.
2. Replace both `REPLACE_ME` values with strong, unique passwords.
3. Apply the local file with `kubectl apply -n mario -f .\secret-db.yaml`.

Keep the passwords out of source control, chat, and screenshots. Kubernetes
Secrets are not automatically encrypted in every cluster; use restricted RBAC,
encryption at rest, or an external secret manager for production.

The database container reads the application username and password from this
Secret during its first initialization. If the persistent database volume
already exists, changing the Secret alone does not rotate the MySQL account;
update the account in MySQL as well.

# Kubernetes namespace

The application resources use the `mario` namespace, declared in
`namespace.yaml`. Namespaced resources such as Pods, Services, Secrets, and
PVCs live there. PersistentVolumes and StorageClasses are cluster-scoped, so
they do not get a `metadata.namespace`.

From this `K8s` directory, create the namespace first, then apply the local
Secret and the application resources:

```powershell
kubectl apply -f .\namespace.yaml
kubectl apply -n mario -f .\secret-db.yaml
kubectl apply -n mario -f .\storageclass.yaml -f .\pvc-dynamic.yaml `
  -f .\statefulset.yaml -f .\service-db.yaml -f .\deployment.yaml `
  -f .\service.yaml -f .\ingress.yaml
```

The Secret command uses the local file with real passwords; do not apply
`secret-db.yaml.example`, which contains placeholders. The static PV/PVC
manifests are optional and are not used by the current StatefulSet.

To check the resources and make `mario` the current context's default
namespace:

```powershell
kubectl get all,pvc,ingress -n mario
kubectl config set-context --current --namespace=mario
```

Changing the default namespace only affects commands that omit `-n`; the
manifests also declare `namespace: mario` so they continue to target it
explicitly.
