const { SecretsManagerClient, GetSecretValueCommand, UpdateSecretCommand, PutSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const crypto = require('crypto');

const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Función Lambda para rotación automática de secretos
 */
exports.handler = async (event) => {
  console.log('Evento de rotación recibido:', JSON.stringify(event, null, 2));

  const { SecretId, ClientRequestToken, Step } = event;

  try {
    switch (Step) {
      case 'createSecret':
        return await createSecret(SecretId, ClientRequestToken);
      case 'setSecret':
        return await setSecret(SecretId, ClientRequestToken);
      case 'testSecret':
        return await testSecret(SecretId, ClientRequestToken);
      case 'finishSecret':
        return await finishSecret(SecretId, ClientRequestToken);
      default:
        throw new Error(`Paso desconocido: ${Step}`);
    }
  } catch (error) {
    console.error('Error en rotación de secreto:', error);
    throw error;
  }
};

/**
 * Paso 1: Crear nuevo secreto
 */
async function createSecret(secretId, clientRequestToken) {
  console.log(`Creando nuevo secreto para ${secretId}`);

  // Obtener el secreto actual
  const currentSecret = await getCurrentSecret(secretId);

  // Generar nuevo secreto basado en el tipo
  const newSecret = generateNewSecret(secretId, currentSecret);

  // Crear versión staging del secreto
  await client.send(new PutSecretValueCommand({
    SecretId: secretId,
    ClientRequestToken: clientRequestToken,
    SecretString: JSON.stringify(newSecret),
    VersionStages: ['AWSPENDING']
  }));

  console.log('Nuevo secreto creado exitosamente');
  return { statusCode: 200, body: 'createSecret completed' };
}

/**
 * Paso 2: Configurar el nuevo secreto
 */
async function setSecret(secretId, clientRequestToken) {
  console.log(`Configurando nuevo secreto para ${secretId}`);

  // Aquí puedes añadir lógica específica para actualizar bases de datos,
  // cambiar contraseñas en servicios externos, etc.

  // Para JWT secrets, no necesitamos configuración adicional
  // Para database secrets, podrías actualizar la contraseña en RDS

  console.log('Nuevo secreto configurado exitosamente');
  return { statusCode: 200, body: 'setSecret completed' };
}

/**
 * Paso 3: Probar el nuevo secreto
 */
async function testSecret(secretId, clientRequestToken) {
  console.log(`Probando nuevo secreto para ${secretId}`);

  // Obtener el nuevo secreto
  const newSecret = await getSecretValue(secretId, 'AWSPENDING');

  // Validar que el secreto tenga el formato correcto
  if (!isValidSecret(secretId, newSecret)) {
    throw new Error('El nuevo secreto no tiene un formato válido');
  }

  // Aquí puedes añadir pruebas específicas
  // Por ejemplo, probar conexión a base de datos con nuevas credenciales

  console.log('Nuevo secreto probado exitosamente');
  return { statusCode: 200, body: 'testSecret completed' };
}

/**
 * Paso 4: Finalizar la rotación
 */
async function finishSecret(secretId, clientRequestToken) {
  console.log(`Finalizando rotación para ${secretId}`);

  // Mover AWSPENDING a AWSCURRENT
  await client.send(new UpdateSecretCommand({
    SecretId: secretId,
    VersionStage: 'AWSCURRENT',
    MoveToVersionId: clientRequestToken
  }));

  console.log('Rotación de secreto completada exitosamente');
  return { statusCode: 200, body: 'finishSecret completed' };
}

/**
 * Obtener el secreto actual
 */
async function getCurrentSecret(secretId) {
  const command = new GetSecretValueCommand({
    SecretId: secretId,
    VersionStage: 'AWSCURRENT'
  });

  const response = await client.send(command);
  return JSON.parse(response.SecretString);
}

/**
 * Obtener valor de secreto por versión
 */
async function getSecretValue(secretId, versionStage) {
  const command = new GetSecretValueCommand({
    SecretId: secretId,
    VersionStage: versionStage
  });

  const response = await client.send(command);
  return JSON.parse(response.SecretString);
}

/**
 * Generar nuevo secreto basado en el tipo
 */
function generateNewSecret(secretId, currentSecret) {
  if (secretId.includes('jwt')) {
    // Generar nuevo JWT secret
    return {
      ...currentSecret,
      secret: crypto.randomBytes(64).toString('hex'),
      rotatedAt: new Date().toISOString()
    };
  }

  if (secretId.includes('database')) {
    // Generar nueva contraseña de base de datos
    const newPassword = crypto.randomBytes(32).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    return {
      ...currentSecret,
      password: newPassword,
      rotatedAt: new Date().toISOString()
    };
  }

  if (secretId.includes('redis')) {
    // Generar nueva contraseña Redis
    const newPassword = crypto.randomBytes(32).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    return {
      ...currentSecret,
      password: newPassword,
      rotatedAt: new Date().toISOString()
    };
  }

  if (secretId.includes('api')) {
    // Para API keys, mantener el formato pero marcar como rotado
    return {
      ...currentSecret,
      rotatedAt: new Date().toISOString()
    };
  }

  // Por defecto, mantener estructura pero actualizar timestamp
  return {
    ...currentSecret,
    rotatedAt: new Date().toISOString()
  };
}

/**
 * Validar que el secreto tenga formato correcto
 */
function isValidSecret(secretId, secret) {
  if (secretId.includes('jwt')) {
    return secret.secret && secret.secret.length >= 32;
  }

  if (secretId.includes('database')) {
    return secret.url && secret.password && secret.password.length >= 8;
  }

  if (secretId.includes('redis')) {
    return secret.url && (!secret.password || secret.password.length >= 8);
  }

  // Para otros secretos, validar que tenga estructura básica
  return secret && typeof secret === 'object' && Object.keys(secret).length > 0;
}