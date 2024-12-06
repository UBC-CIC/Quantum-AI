const postgres = require("postgres");
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

// Create a Secrets Manager client
const secretsManager = new SecretsManagerClient();

async function initializeConnection(SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT) {
  try {
    // Retrieve the secret from AWS Secrets Manager
    const getSecretValueCommand = new GetSecretValueCommand({ SecretId: SM_DB_CREDENTIALS });
    const secretResponse = await secretsManager.send(getSecretValueCommand);

    const credentials = JSON.parse(secretResponse.SecretString);

    const connectionConfig = {
      host: RDS_PROXY_ENDPOINT,
      port: credentials.port,
      username: credentials.username,
      password: credentials.password,
      database: credentials.dbname,
      ssl: false,
    };

    // Create the PostgreSQL connection
    global.sqlConnection = postgres(connectionConfig);
    
    
  } catch (error) {
    console.error("Error initializing database connection:", error);
    throw new Error("Failed to initialize database connection");
  }
}

module.exports = { initializeConnection };
