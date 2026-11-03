// OrderPilot on Azure: Container Apps for the three services, Azure SQL, Azure AI Search,
// Azure OpenAI (Microsoft Foundry), Key Vault for secrets, and a user-assigned managed identity
// so the apps read secrets and pull images without passwords in config.
//
// Deploy:
//   az group create -n rg-orderpilot -l uaenorth
//   az deployment group create -g rg-orderpilot -f infra/azure/main.bicep -p infra/azure/main.parameters.json
targetScope = 'resourceGroup'

@description('Short name used as a prefix for every resource.')
param prefix string = 'orderpilot'
param location string = resourceGroup().location
@description('Container images, e.g. <acr>.azurecr.io/orderpilot-core-api:<git-sha>.')
param coreApiImage string
param aiServiceImage string
param webImage string
param acrLoginServer string
@description('Microsoft Entra ID tenant and API app registration (audience) used to validate tokens.')
param entraTenantId string
param entraAudience string
param sqlAdminLogin string = 'orderpilotadmin'
@secure()
param sqlAdminPassword string
param openAiLocation string = 'swedencentral'
param openAiModel string = 'gpt-4o-mini'

var suffix = uniqueString(resourceGroup().id)

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-id'
  location: location
}

resource logs 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${prefix}-logs'
  location: location
  properties: { sku: { name: 'PerGB2018' }, retentionInDays: 30 }
}

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-${prefix}-${take(suffix, 6)}'
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
  }
}

// Key Vault Secrets User for the app identity
resource vaultReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, identity.id, 'kv-secrets-user')
  scope: vault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource sqlServer 'Microsoft.Sql/servers@2023-05-01-preview' = {
  name: 'sql-${prefix}-${take(suffix, 6)}'
  location: location
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    minimalTlsVersion: '1.2'
  }
}

resource sqlDb 'Microsoft.Sql/servers/databases@2023-05-01-preview' = {
  parent: sqlServer
  name: 'orderpilot'
  location: location
  sku: { name: 'GP_S_Gen5_1', tier: 'GeneralPurpose' } // serverless, auto-pause
  properties: { autoPauseDelay: 60, minCapacity: json('0.5') }
}

resource sqlAllowAzure 'Microsoft.Sql/servers/firewallRules@2023-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

resource search 'Microsoft.Search/searchServices@2023-11-01' = {
  name: 'srch-${prefix}-${take(suffix, 6)}'
  location: location
  sku: { name: 'basic' }
  properties: { replicaCount: 1, partitionCount: 1 }
}

resource openAi 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' = {
  name: 'oai-${prefix}-${take(suffix, 6)}'
  location: openAiLocation
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: { customSubDomainName: 'oai-${prefix}-${take(suffix, 6)}' }
}

resource openAiDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = {
  parent: openAi
  name: openAiModel
  sku: { name: 'GlobalStandard', capacity: 20 }
  properties: { model: { format: 'OpenAI', name: openAiModel, version: '2024-07-18' } }
}

// Secrets live in Key Vault; Container Apps reference them through the managed identity.
resource secretSqlPassword 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'sql-password'
  properties: { value: sqlAdminPassword }
}
resource secretSearchKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'search-key'
  properties: { value: search.listAdminKeys().primaryKey }
}
resource secretOpenAiKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'openai-key'
  properties: { value: openAi.listKeys().key1 }
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${prefix}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

resource coreApi 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-core-api'
  location: location
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${identity.id}': {} } }
  dependsOn: [ vaultReader ]
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: { external: true, targetPort: 8080 } // the PWA calls it with the user's Entra token
      registries: [ { server: acrLoginServer, identity: identity.id } ]
      secrets: [
        { name: 'sql-password', keyVaultUrl: '${vault.properties.vaultUri}secrets/sql-password', identity: identity.id }
        { name: 'openai-key', keyVaultUrl: '${vault.properties.vaultUri}secrets/openai-key', identity: identity.id }
      ]
    }
    template: {
      containers: [ {
        name: 'core-api'
        image: coreApiImage
        resources: { cpu: json('0.5'), memory: '1Gi' }
        env: [
          { name: 'SPRING_PROFILES_ACTIVE', value: 'azure' }
          { name: 'AZURE_SQL_URL', value: 'jdbc:sqlserver://${sqlServer.properties.fullyQualifiedDomainName}:1433;database=orderpilot;encrypt=true' }
          { name: 'AZURE_SQL_USER', value: sqlAdminLogin }
          { name: 'AZURE_SQL_PASSWORD', secretRef: 'sql-password' }
          { name: 'AUTH_MODE', value: 'entra' }
          { name: 'ENTRA_TENANT_ID', value: entraTenantId }
          { name: 'ENTRA_AUDIENCE', value: entraAudience }
          { name: 'LLM_PROVIDER', value: 'azure_openai' }
          { name: 'AZURE_OPENAI_ENDPOINT', value: openAi.properties.endpoint }
          { name: 'AZURE_OPENAI_API_KEY', secretRef: 'openai-key' }
          { name: 'AZURE_OPENAI_DEPLOYMENT', value: openAiModel }
        ]
        probes: [ { type: 'Liveness', httpGet: { path: '/api/health', port: 8080 } } ]
      } ]
      scale: { minReplicas: 1, maxReplicas: 3 }
    }
  }
}

resource aiService 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-ai-service'
  location: location
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${identity.id}': {} } }
  dependsOn: [ vaultReader ]
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: { external: true, targetPort: 8000 }
      registries: [ { server: acrLoginServer, identity: identity.id } ]
      secrets: [
        { name: 'openai-key', keyVaultUrl: '${vault.properties.vaultUri}secrets/openai-key', identity: identity.id }
        { name: 'search-key', keyVaultUrl: '${vault.properties.vaultUri}secrets/search-key', identity: identity.id }
      ]
    }
    template: {
      containers: [ {
        name: 'ai-service'
        image: aiServiceImage
        resources: { cpu: json('0.5'), memory: '1Gi' }
        env: [
          { name: 'CORE_API_URL', value: 'https://${coreApi.properties.configuration.ingress.fqdn}' }
          { name: 'AUTH_MODE', value: 'entra' }
          { name: 'ENTRA_TENANT_ID', value: entraTenantId }
          { name: 'ENTRA_AUDIENCE', value: entraAudience }
          { name: 'LLM_PROVIDER', value: 'azure_openai' }
          { name: 'AZURE_OPENAI_ENDPOINT', value: openAi.properties.endpoint }
          { name: 'AZURE_OPENAI_API_KEY', secretRef: 'openai-key' }
          { name: 'AZURE_OPENAI_DEPLOYMENT', value: openAiModel }
          { name: 'SEARCH_PROVIDER', value: 'azure_ai_search' }
          { name: 'AZURE_SEARCH_ENDPOINT', value: 'https://${search.name}.search.windows.net' }
          { name: 'AZURE_SEARCH_KEY', secretRef: 'search-key' }
          { name: 'AZURE_SEARCH_INDEX', value: 'orderpilot-knowledge' }
        ]
      } ]
      scale: {
        minReplicas: 0
        maxReplicas: 5
        rules: [ { name: 'http', http: { metadata: { concurrentRequests: '20' } } } ]
      }
    }
  }
}

resource web 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-web'
  location: location
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${identity.id}': {} } }
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: { external: true, targetPort: 3000 }
      registries: [ { server: acrLoginServer, identity: identity.id } ]
    }
    template: {
      containers: [ {
        name: 'web'
        image: webImage
        resources: { cpu: json('0.25'), memory: '0.5Gi' }
      } ]
      scale: { minReplicas: 0, maxReplicas: 3 }
    }
  }
}

output webUrl string = 'https://${web.properties.configuration.ingress.fqdn}'
output aiServiceUrl string = 'https://${aiService.properties.configuration.ingress.fqdn}'
output keyVaultName string = vault.name
