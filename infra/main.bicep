targetScope = 'resourceGroup'

@description('Azure region used by the Container Apps resources.')
param location string = resourceGroup().location

@description('Globally unique Container App name.')
@minLength(2)
@maxLength(32)
param containerAppName string

@description('Container Apps managed environment name.')
param containerAppsEnvironmentName string = '${containerAppName}-environment'

@description('Fully qualified public container image and immutable tag.')
param imageName string

@description('Azure Repos HTTPS remote used for browser storage operations.')
param azureGitRemote string

@description('Azure Repos branch used for browser storage operations.')
param azureGitBranch string = 'main'

@description('Optional resource ID of a separate user-assigned purge identity.')
param purgeManagedIdentityResourceId string = ''

@description('Optional client ID of a separate user-assigned purge identity.')
param purgeManagedIdentityClientId string = ''

@secure()
@description('Optional Box client ID. Supply all four Box values or none.')
param boxClientId string = ''

@secure()
@description('Optional Box client secret. Supply all four Box values or none.')
param boxClientSecret string = ''

@secure()
@description('Optional Box enterprise ID. Supply all four Box values or none.')
param boxEnterpriseId string = ''

@secure()
@description('Optional Box folder ID. Supply all four Box values or none.')
param boxFolderId string = ''

@description('Fallback Box account upload limit in megabytes.')
@minValue(1)
param boxMaximumUploadSizeMb int = 250

@description('Optional private registry server. Used only with both pull credentials.')
param registryServer string = 'ghcr.io'

@secure()
@description('Optional private registry username. Supply with a pull token.')
param registryUsername string = ''

@secure()
@description('Optional read-only private registry token.')
param registryPassword string = ''

var boxConfigured = !empty(boxClientId) &&
  !empty(boxClientSecret) &&
  !empty(boxEnterpriseId) &&
  !empty(boxFolderId)
var separatePurgeIdentityConfigured =
  !empty(purgeManagedIdentityResourceId) &&
  !empty(purgeManagedIdentityClientId)
var privateRegistryConfigured =
  !empty(registryUsername) &&
  !empty(registryPassword)

var boxSecrets = boxConfigured ? [
  {
    name: 'box-client-id'
    value: boxClientId
  }
  {
    name: 'box-client-secret'
    value: boxClientSecret
  }
  {
    name: 'box-enterprise-id'
    value: boxEnterpriseId
  }
  {
    name: 'box-folder-id'
    value: boxFolderId
  }
] : []

var boxEnvironmentVariables = boxConfigured ? [
  {
    name: 'BOX_CLIENT_ID'
    secretRef: 'box-client-id'
  }
  {
    name: 'BOX_CLIENT_SECRET'
    secretRef: 'box-client-secret'
  }
  {
    name: 'BOX_ENTERPRISE_ID'
    secretRef: 'box-enterprise-id'
  }
  {
    name: 'BOX_FOLDER_ID'
    secretRef: 'box-folder-id'
  }
  {
    name: 'BOX_MAX_UPLOAD_SIZE_MB'
    value: string(boxMaximumUploadSizeMb)
  }
] : []

var registrySecrets = privateRegistryConfigured ? [
  {
    name: 'registry-password'
    value: registryPassword
  }
] : []

var registryConfiguration = privateRegistryConfigured ? [
  {
    server: registryServer
    username: registryUsername
    passwordSecretRef: 'registry-password'
  }
] : []

var purgeIdentityEnvironmentVariables =
  separatePurgeIdentityConfigured ? [
    {
      name: 'AZURE_PURGE_MANAGED_IDENTITY_CLIENT_ID'
      value: purgeManagedIdentityClientId
    }
  ] : []

var applicationEnvironmentVariables = concat([
  {
    name: 'HOST'
    value: '0.0.0.0'
  }
  {
    name: 'PORT'
    value: '3000'
  }
  {
    name: 'AUTH_SECURE_COOKIE'
    value: 'true'
  }
  {
    name: 'AZURE_GIT_REMOTE'
    value: azureGitRemote
  }
  {
    name: 'AZURE_GIT_BRANCH'
    value: azureGitBranch
  }
  {
    name: 'AZURE_GIT_PUSH'
    value: 'true'
  }
  {
    name: 'AZURE_AUTH_MODE'
    value: 'managed-identity'
  }
  {
    name: 'AZURE_PURGE_AUTH_MODE'
    value: 'managed-identity'
  }
], purgeIdentityEnvironmentVariables, boxEnvironmentVariables)

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: containerAppsEnvironmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'none'
    }
  }
}

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  identity: separatePurgeIdentityConfigured ? {
    type: 'SystemAssigned,UserAssigned'
    userAssignedIdentities: {
      '${purgeManagedIdentityResourceId}': {}
    }
  } : {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: containerAppsEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        allowInsecure: false
        external: true
        targetPort: 3000
        transport: 'auto'
      }
      registries: registryConfiguration
      secrets: concat(boxSecrets, registrySecrets)
    }
    template: {
      containers: [
        {
          name: 'web'
          image: imageName
          env: applicationEnvironmentVariables
          probes: [
            {
              type: 'Startup'
              httpGet: {
                path: '/api/health'
                port: 3000
                scheme: 'HTTP'
              }
              failureThreshold: 10
              periodSeconds: 3
              timeoutSeconds: 2
            }
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/health'
                port: 3000
                scheme: 'HTTP'
              }
              initialDelaySeconds: 5
              failureThreshold: 3
              periodSeconds: 30
              timeoutSeconds: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/health'
                port: 3000
                scheme: 'HTTP'
              }
              failureThreshold: 3
              periodSeconds: 10
              timeoutSeconds: 3
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
      }
    }
  }
}

output containerAppUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output systemIdentityPrincipalId string = containerApp.identity.principalId
output systemIdentityTenantId string = containerApp.identity.tenantId
