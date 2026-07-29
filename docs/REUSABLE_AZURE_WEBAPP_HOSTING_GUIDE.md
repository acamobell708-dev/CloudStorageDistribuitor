# Reusable Azure Container Apps hosting guide

Use this guide when deploying another small web application from a new GitHub
repository while keeping the existing Cloud Storage Distributor application
running.

## 1. Architecture used

The deployment flow is:

```text
Push to main
    -> GitHub CI
    -> immutable container image in GHCR
    -> GitHub authenticates to Azure through OIDC
    -> Bicep updates the Azure Container App
    -> Azure verifies the health endpoint
```

The application contains:

- a Dockerfile that packages the frontend and server;
- a public HTTPS Azure Container App;
- a Bicep template describing the Azure resources;
- CI checks for syntax, tests, builds and infrastructure;
- an automated production deployment workflow;
- scale-to-zero configuration for low idle usage;
- GitHub environment secrets for confidential configuration;
- an optional runtime managed identity for accessing Azure services.

## 2. Keep the existing application separate

The existing application currently uses:

| Setting | Existing value |
| --- | --- |
| GitHub repository | `CloudStorageDistribuitor` |
| Azure resource group | `cloud-storage-distributor-rg` |
| Azure Container App | `adam-cloud-storage-app-2026` |
| GitHub environment | `production` |
| Azure region | `uksouth` |

Do not use the existing resource group or Container App name in a new
repository's deployment settings unless intentionally updating this
application.

For a separate application, use:

- a new GitHub repository;
- a new Azure resource group;
- a globally unique Container App name;
- a separate GHCR package;
- a new GitHub federated credential;
- application-specific secrets;
- preferably a separate Microsoft Entra deployment application.

## 3. Prepare the new repository

Create a new GitHub repository and add the application code.

The production application must:

1. listen on `0.0.0.0`;
2. use the port supplied through the `PORT` environment variable;
3. provide an unauthenticated health endpoint such as `/api/health`;
4. avoid writing persistent application data inside the container;
5. keep credentials out of the image and repository.

Add these deployment files:

```text
Dockerfile
.dockerignore
infra/main.bicep
.github/workflows/ci.yml
.github/workflows/deploy.yml
```

The files in this repository can be used as a starting point. Remove
Cloud Storage Distributor-specific parameters such as Box or Azure Repos
settings if the new application does not need them.

Before pushing, verify that `.gitignore` and `.dockerignore` exclude:

```text
.env
node_modules
local credentials
downloaded cloud files
test output
editor-specific files
```

## 4. Test the container locally

Run the project's tests and production build first. For a Node application,
the equivalent commands are:

```powershell
npm ci
npm run check:syntax
npm run test
npm run build
docker build --tag new-webapp:local .
```

Run the image:

```powershell
docker run --rm -p 3000:3000 new-webapp:local
```

Confirm that these load:

```text
http://localhost:3000
http://localhost:3000/api/health
```

Stop the local container with `Ctrl+C`.

## 5. Create an isolated Azure resource group

The `Microsoft.App` resource provider is already registered for the Azure
subscription, so it normally does not need to be registered again.

Choose new names:

```powershell
$newLocation = "uksouth"
$newResourceGroup = "new-webapp-rg"
$newContainerApp = "globally-unique-new-webapp-name"
```

Create the resource group:

```powershell
az account set --subscription "<subscription-id>"

az group create `
  --name $newResourceGroup `
  --location $newLocation
```

Using a separate resource group makes permissions, troubleshooting and future
deletion independent from the existing application.

## 6. Create the GitHub deployment identity

The GitHub workflow needs permission to create and update resources. This is
the deployment identity, not the identity used by the running container.

The recommended approach is a separate Microsoft Entra application:

1. Open **Microsoft Entra admin center**.
2. Open **App registrations**.
3. Select **New registration**.
4. Give it an identifiable name such as `new-webapp-github`.
5. Keep it single-tenant.
6. Leave the redirect URI empty.
7. Record:
   - **Application (client) ID**
   - **Directory (tenant) ID**
8. Open **Certificates & secrets -> Federated credentials**.
9. Select **GitHub Actions deploying Azure resources**.
10. Enter the new GitHub organization and repository.
11. Select **Environment** as the entity type.
12. Enter `production` as the GitHub environment.
13. Save the credential.

The resulting trust is specific to:

```text
repo:<github-owner>/<new-repository>:environment:production
```

No Azure client secret is required.

Alternatively, the existing Entra deployment application can be reused by
adding another repository-specific federated credential. A separate
application provides better isolation and is recommended.

## 7. Grant deployment access

Open the new Azure resource group:

```text
Azure portal
    -> Resource groups
    -> new resource group
    -> Access control (IAM)
    -> Add role assignment
```

Assign:

| Setting | Value |
| --- | --- |
| Role | `Contributor` |
| Assign access to | User, group or service principal |
| Member | The new Entra deployment application |

Scope the role to the new resource group, not the whole subscription.

## 8. Configure the GitHub production environment

In the new repository, open:

```text
Settings -> Environments -> New environment
```

Create an environment named exactly:

```text
production
```

Add these **environment variables**:

| Variable | Purpose |
| --- | --- |
| `AZURE_CLIENT_ID` | Entra deployment application client ID |
| `AZURE_TENANT_ID` | Microsoft Entra tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Target Azure subscription |
| `AZURE_RESOURCE_GROUP` | New resource group name |
| `AZURE_LOCATION` | For example, `uksouth` |
| `AZURE_CONTAINER_APP_NAME` | Globally unique new app name |

Add any credentials under **Environment secrets**, not variables. Use only the
raw secret value; do not include the variable name, quotation marks or an
equals sign.

Examples of optional secrets include:

```text
DATABASE_PASSWORD
EXTERNAL_API_KEY
BOX_CLIENT_SECRET
```

Never copy the existing application's secrets unless the new application
genuinely needs access to the same external service.

## 9. Publish the container image

The workflow publishes the image to GitHub Container Registry:

```text
ghcr.io/<github-owner>/<new-repository>:<commit-sha>
ghcr.io/<github-owner>/<new-repository>:latest
```

For the simplest setup:

1. allow the workflow to publish the package once;
2. open the package settings in GitHub;
3. change the package visibility to **Public**;
4. rerun the deployment if the first image pull failed.

If the image must remain private, create a read-only package token and store
the pull username and token as GitHub environment secrets. Never put a package
token in Bicep source code.

## 10. Run the first deployment

Commit and push the new repository:

```powershell
git status
git add .
git status
git commit -m "Add Azure Container Apps deployment"
git push origin main
```

The expected workflow sequence is:

1. **CI** starts.
2. Syntax checks, tests, application build, container build and Bicep
   validation pass.
3. **Deploy to Azure Container Apps** starts automatically.
4. The exact tested commit is packaged with an immutable SHA tag.
5. GitHub signs into Azure using OIDC.
6. Bicep creates the managed environment and Container App.
7. Azure exposes the public HTTPS URL.
8. The workflow verifies the health endpoint.

The application URL appears in the workflow output and on the Container App's
Azure portal overview page.

## 11. Configure the runtime managed identity when needed

The Container App can have a system-assigned managed identity. This is
different from the GitHub deployment identity.

Use it only if the running application must access an Azure-protected service:

1. deploy the Container App once;
2. open **Container App -> Identity**;
3. confirm **System assigned** is enabled;
4. copy its principal/object ID;
5. grant that identity the minimum required permission on the target service.

Examples include:

- Azure DevOps repository permissions;
- Key Vault secret access;
- Azure Storage data access;
- access to another Azure resource.

An Azure subscription role does not automatically grant Azure DevOps
repository permissions. Those must be configured separately in Azure DevOps.

## 12. Verify the new application

Verify:

```text
https://<new-container-app-domain>/api/health
```

Then test:

- the public frontend;
- authentication and logout;
- authorised and unauthorised routes;
- uploads and downloads, if applicable;
- connected external services;
- scale-to-zero wake-up behaviour;
- application logs and failed-request handling.

Inspect the deployed image:

```powershell
az resource show `
  --resource-group $newResourceGroup `
  --name $newContainerApp `
  --resource-type "Microsoft.App/containerApps" `
  --api-version "2025-07-01" `
  --query "{Revision:properties.latestReadyRevisionName,Image:properties.template.containers[0].image,URL:properties.configuration.ingress.fqdn}" `
  --output table
```

The image tag should match:

```powershell
git rev-parse HEAD
```

## 13. Deploy future updates

For each later update:

```powershell
git pull --ff-only origin main

# Make and test the changes.
npm run check:syntax
npm run test
npm run build

git status
git add .
git status
git commit -m "Describe the update"
git pull --rebase origin main
git push origin main
```

A successful push to `main` automatically:

1. runs CI;
2. creates a new immutable image;
3. updates the Container App;
4. verifies `/api/health`.

The GitHub production variables and secrets are reapplied during every
deployment.

## 14. Scaling behaviour

The current template uses:

```text
Minimum replicas: 0
Maximum replicas: 1
```

At zero replicas, the public URL remains available. The next request starts a
new replica and may experience a short cold-start delay. Azure scales the
application down again after it becomes idle.

Files and durable application data must therefore live in external storage.
In-memory sessions are lost after scale-to-zero or a new deployment.

Use a shared session store before allowing multiple replicas if the
application relies on server-side login sessions.

## 15. Important safety checklist

Before deploying another repository, confirm:

- [ ] The new resource group is not `cloud-storage-distributor-rg`.
- [ ] The new Container App name is not `adam-cloud-storage-app-2026`.
- [ ] The federated credential names the new GitHub repository.
- [ ] The deployment identity is scoped only to the new resource group.
- [ ] The GitHub environment is named `production`.
- [ ] Secrets are stored as GitHub environment secrets.
- [ ] `.env` is excluded from Git and Docker.
- [ ] The container listens on the configured port and `0.0.0.0`.
- [ ] The health endpoint does not require login.
- [ ] The GHCR package is deliberately public or has pull credentials.
- [ ] Persistent data is stored outside the container.
- [ ] CI passes before production deployment.

## 16. Common problems

| Problem | Likely cause |
| --- | --- |
| GitHub OIDC login fails | Federated credential references the wrong repository or environment |
| Deployment is unauthorized | Entra deployment application lacks Contributor on the new resource group |
| Image cannot be pulled | GHCR package is private and no pull credentials are configured |
| Health verification fails | Wrong target port, server bound to localhost, or health route requires authentication |
| Configuration is missing | Secret was added as a variable, placed in the wrong environment, or misspelled |
| External Azure service returns 403 | Container runtime identity lacks service-specific permissions |
| Users are logged out periodically | In-memory sessions were cleared by scale-to-zero or a new revision |
| Azure CLI reports connection reset | Retry or use the generic `az resource` command; the running application is unaffected |

## Related project guide

For the original Cloud Storage Distributor deployment, including its Box and
Azure DevOps configuration, see:

```text
docs/AZURE_CONTAINER_APPS.md
```
