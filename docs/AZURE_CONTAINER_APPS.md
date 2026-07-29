# Azure Container Apps deployment

The Docker image, managed-identity authentication, Bicep infrastructure, and
GitHub deployment workflow are already in the repository. These instructions
begin at step 3 because containerisation and the Azure authentication refactor
are complete.

## Step 3: verify and commit the project changes

From the `CloudStorageDistribuitor` application directory, run:

```powershell
npm ci
npm run check:syntax
npm run test:unit
npm run test:integration
npm run build
docker build --tag cloud-storage-distributor:local .
```

Review the pending files, then commit and push them:

```powershell
git status
git add .
git commit -m "Add managed identity Container Apps deployment"
git push origin main
```

Do not commit `.env`, PATs, Box credentials, GitHub tokens, or exported Azure
deployment credentials.

Before making the application public, change any password that has appeared in
a PDF, commit, screenshot, chat, or other shared location. The image contains
the server code and salted password hashes, even though it contains no
plaintext passwords or `.env` file.

## Step 4: install and prepare Azure CLI

On Windows, install Azure CLI:

```powershell
winget install --exact --id Microsoft.AzureCLI
```

Close and reopen PowerShell, then sign in:

```powershell
az login
az account list --output table
```

Select the intended subscription and register Container Apps:

```powershell
$deploymentSubscriptionId = "<subscription-id>"
az account set --subscription $deploymentSubscriptionId
az provider register --namespace Microsoft.App
```

The template disables Log Analytics application-log storage to avoid an
unexpected logging bill. Platform status and revision information remain
available in the portal, but historical application logs are not retained.

## Step 5: create the Azure resource group

Choose stable names. The Container App name must be globally unique and should
contain only lowercase letters, numbers, and hyphens.

```powershell
$deploymentLocation = "uksouth"
$deploymentResourceGroup = "cloud-storage-distributor-rg"
$deploymentContainerApp = "your-unique-cloud-storage-app"

az group create `
  --name $deploymentResourceGroup `
  --location $deploymentLocation
```

The Bicep template creates the Container Apps environment and Container App
inside this resource group. It configures:

- external HTTPS ingress on container port 3000;
- a system-assigned managed identity;
- managed-identity Azure DevOps authentication;
- startup, readiness, and liveness probes against `/api/health`;
- zero minimum replicas and one maximum replica;
- 0.5 vCPU and 1 GiB memory;
- encrypted Container App secret references for Box and private GHCR values.

The single-replica limit is intentional because login sessions currently live
in process memory. Scaling to zero or deploying a new revision clears those
sessions, so users must sign in again after a cold restart.

## Step 6: create the GitHub deployment identity

This identity is used only by GitHub Actions to deploy Azure resources. It is
different from the Container App identity that accesses Azure DevOps.

1. Open the **Microsoft Entra admin center**.
2. Open **App registrations** and select **New registration**.
3. Name it `cloud-storage-distributor-github`.
4. Keep it single-tenant and leave the redirect URI empty.
5. Record its **Application (client) ID** and **Directory (tenant) ID**.
6. Open **Certificates & secrets → Federated credentials**.
7. Select **Add credential → GitHub Actions deploying Azure resources**.
8. Enter:
   - Organization: `acamobell708-dev`
   - Repository: `CloudStorageDistribuitor`
   - Entity type: `Environment`
   - Environment: `production`
9. Save the credential. No client secret is required.

Grant the application permission over only the deployment resource group:

1. Open the resource group in the Azure portal.
2. Open **Access control (IAM) → Add role assignment**.
3. Select **Contributor**.
4. Assign access to **User, group, or service principal**.
5. Select `cloud-storage-distributor-github`.

Record the Azure subscription ID as well as the application and tenant IDs.

## Step 7: configure the GitHub production environment

In GitHub, open:

**Repository → Settings → Environments → New environment**

Create an environment named exactly `production`. Optionally add yourself as a
required reviewer so deployments wait for approval.

Add these environment variables:

| Variable | Value |
| --- | --- |
| `AZURE_CLIENT_ID` | Deployment app registration client ID |
| `AZURE_TENANT_ID` | Microsoft Entra tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `AZURE_RESOURCE_GROUP` | `cloud-storage-distributor-rg` |
| `AZURE_LOCATION` | `uksouth`, or your selected region |
| `AZURE_CONTAINER_APP_NAME` | Your globally unique lowercase app name |
| `AZURE_GIT_REMOTE` | Azure Repos HTTPS URL without a PAT |
| `AZURE_GIT_BRANCH` | `main` |

Do not create `AZURE_DEVOPS_PAT` or `AZURE_PURGE_PAT` GitHub secrets. The
deployed application obtains short-lived Azure DevOps tokens from its managed
identity.

If Box should be available, add all four environment secrets:

- `BOX_CLIENT_ID`
- `BOX_CLIENT_SECRET`
- `BOX_ENTERPRISE_ID`
- `BOX_FOLDER_ID`

If Box is not required yet, leave all four absent. A partial Box configuration
is rejected by the workflow.

## Step 8: choose public or private GHCR image access

The workflow publishes images to:

```text
ghcr.io/acamobell708-dev/cloudstoragedistribuitor:<commit-sha>
```

### Private image

This avoids exposing the image layers, but GitHub package storage and transfer
quotas apply.

1. In GitHub, create a classic personal access token with only
   `read:packages`.
2. Add these secrets to the `production` environment:
   - `GHCR_PULL_USERNAME`: your GitHub username.
   - `GHCR_PULL_TOKEN`: the read-only package token.

The Bicep deployment stores the token as a Container App secret. Rotate it
before its configured expiry.

### Public image

This needs no registry token and is the lowest-maintenance free route. Leave
both GHCR pull secrets absent.

The package does not exist until the workflow publishes it once. After the
first publish:

1. Open your GitHub profile or organization **Packages** page.
2. Open the `cloudstoragedistribuitor` package.
3. Open **Package settings → Change visibility**.
4. Change it to **Public**.
5. Rerun the failed deployment workflow.

Only use this option if publishing the server image is acceptable. `.env`,
cloud files, Box secrets, and Azure credentials are excluded from the image.

## Step 9: run the first deployment

Pushing to `main` starts CI. When CI succeeds, the deployment workflow:

1. checks out the exact tested commit;
2. builds the Dockerfile;
3. publishes immutable SHA and `latest` GHCR tags;
4. signs into Azure through GitHub OIDC;
5. deploys `infra/main.bicep`;
6. waits for `/api/health` to return successfully.

You can also start it manually from:

**GitHub → Actions → Deploy to Azure Container Apps → Run workflow**

For a public package, the first deployment may fail to pull the initially
private package. Complete step 8 and rerun it. For a correctly configured
private package, the first deployment can complete immediately.

After deployment, GitHub displays the application URL as an Actions notice.
The same URL is available in:

**Azure portal → Container App → Application URL**

## Step 10: authorize the Container App in Azure DevOps

The first Bicep deployment creates the system-assigned identity.

1. Open the Container App in Azure.
2. Open **Identity → System assigned**.
3. Confirm it is enabled and copy its **Object (principal) ID**.
4. In Azure DevOps, open **Organization settings → Users → Add users**.
5. Search for the managed identity by the Container App name.
6. Give it **Basic** access and access to the storage project.
7. Open **Project settings → Repositories → the storage repository → Security**.
8. Select the managed identity and allow:
   - Read
   - Contribute
9. If the same identity will perform permanent deletion, also allow:
   - Force push (rewrite history, delete branches and tags)

The Azure DevOps organization and managed identity must belong to the same
Microsoft Entra tenant. Azure DevOps uses its own repository permission model;
an Azure subscription role does not grant repository access.

Rerun the deployment or wait for the existing app. Managed identity tokens are
requested when operations occur, so adding the Azure DevOps permissions does
not require a PAT or application code change.

## Step 11: verify the deployed application

Open:

```text
https://<container-app-domain>/api/health
```

Expected response:

```json
{"service":"cloud-storage-distributor","status":"ok"}
```

Then verify in this order:

1. Open `/login.html` and sign in.
2. Open Home and Dashboard.
3. List Azure files on Manage Files.
4. Upload a small text or image file to Azure.
5. Download it.
6. Perform a normal Azure deletion.
7. Test permanent deletion only with a disposable file and only after Force
   push permission is confirmed.
8. If configured, repeat upload, download, and deletion with Box.
9. Sign in as Guest and confirm storage actions remain blocked.

Do not test permanent deletion against important repository content.

## Step 12: understand automatic deployment and scaling

Every push to `main` now runs CI. A successful CI run automatically deploys the
same commit. Failed tests do not deploy.

The app scales to zero after Azure's idle cooldown. Its public URL remains
reachable; the next request starts a new replica and may take several seconds.
It scales back down automatically when idle.

Because sessions are in memory:

- scale-to-zero signs users out;
- a new revision signs users out;
- only one replica is permitted;
- uploaded cloud files are unaffected because they live in Box or Azure Repos.

Keeping one always-running replica would reduce sign-outs but would consume
more of the Container Apps allowance. Persistent sessions would require a
shared external session store before increasing `maxReplicas`.

## Step 13: optionally separate permanent-purge permissions

For stronger isolation, use a user-assigned identity only for history purge.

```powershell
$purgeIdentityName = "cloud-storage-purge-identity"

az identity create `
  --name $purgeIdentityName `
  --resource-group $deploymentResourceGroup `
  --location $deploymentLocation

$purgeIdentityResourceId = az identity show `
  --name $purgeIdentityName `
  --resource-group $deploymentResourceGroup `
  --query id `
  --output tsv

$purgeIdentityClientId = az identity show `
  --name $purgeIdentityName `
  --resource-group $deploymentResourceGroup `
  --query clientId `
  --output tsv
```

Give the GitHub deployment application **Managed Identity Operator** over this
identity. Then add these GitHub production variables:

- `AZURE_PURGE_IDENTITY_RESOURCE_ID`
- `AZURE_PURGE_IDENTITY_CLIENT_ID`

Add the purge identity separately to Azure DevOps. Grant it Read, Contribute,
and Force push permissions. Remove Force push from the normal system-assigned
identity. Rerun the deployment workflow.

The application will then use:

- system-assigned identity for listing, upload, download, and normal deletion;
- user-assigned identity only for owner-authorized history purge.

## Step 14: operate and troubleshoot

Useful commands:

```powershell
az containerapp show `
  --name $deploymentContainerApp `
  --resource-group $deploymentResourceGroup `
  --query properties.configuration.ingress.fqdn `
  --output tsv

az containerapp revision list `
  --name $deploymentContainerApp `
  --resource-group $deploymentResourceGroup `
  --output table
```

Common failures:

- **Image pull failure:** make GHCR public or configure both GHCR pull secrets.
- **Azure 401/403:** add the Container App identity to Azure DevOps, assign
  Basic access, and check repository permissions.
- **Permanent deletion rejected:** verify Force push and the purge repository
  safety requirements.
- **Box unavailable:** configure all four Box secrets and rerun deployment.
- **Deployment OIDC failure:** ensure the federated credential uses the
  `production` GitHub environment, not a branch subject.
- **Repeated sign-in:** expected after scale-to-zero or deployment while
  sessions remain in memory.

To roll back, open the Container App's revisions in Azure and direct traffic to
a previous healthy revision, or rerun a deployment workflow for an earlier
commit.
