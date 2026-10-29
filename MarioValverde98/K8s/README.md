# Database credentials

The real `secret-db.yaml` file is local-only and is excluded from Git. Do not
commit it: Kubernetes Secret manifests contain their values in readable form
when using `stringData`.

To create a local manifest:

1. Copy `secret-db.yaml.example` to `secret-db.yaml`.
2. Replace both `REPLACE_ME` values with strong, unique passwords.
3. Apply the local file with `kubectl apply -f .\secret-db.yaml`.

Keep the passwords out of source control, chat, and screenshots. Kubernetes
Secrets are not automatically encrypted in every cluster; use restricted RBAC,
encryption at rest, or an external secret manager for production.

The database container reads the application username and password from this
Secret during its first initialization. If the persistent database volume
already exists, changing the Secret alone does not rotate the MySQL account;
update the account in MySQL as well.
