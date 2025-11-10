// Utilidad para mapear errores de autenticación a mensajes en español
export type ApiErrorPayload = {
  status?: number;
  message?: string;
  error?: string;
};

const NETWORK_ERROR_MESSAGES = [
  'Failed to fetch',
  'NetworkError',
  'TypeError: Failed to fetch',
  'Load failed',
  'fetch failed'
];

export function getLoginErrorMessage(input: ApiErrorPayload | Error | string): string {
  const raw = typeof input === 'string' ? input : (input as any)?.message || (input as any)?.error;
  const status = typeof input === 'object' && 'status' in (input as any) ? (input as any).status : undefined;
  const msg = typeof input === 'object' && 'message' in (input as any) ? (input as any).message : undefined;

  // Errores de red / CORS / servidor caído
  if ((typeof raw === 'string' && NETWORK_ERROR_MESSAGES.some(e => raw.includes(e))) || status === 0) {
    return 'Error de conexión con el servidor. Verifica tu internet y que el servicio esté disponible.';
  }

  // Bloqueo por intentos
  if (status === 429 || (typeof msg === 'string' && /Cuenta bloqueada/i.test(msg))) {
    // Extraer minutos si vienen en el mensaje
    const minutesMatch = String(msg || raw || '').match(/(\d+)\s*minutos?/i);
    const minutes = minutesMatch ? minutesMatch[1] : undefined;
    return minutes
      ? `Su cuenta está temporalmente bloqueada por múltiples intentos fallidos (${minutes} minutos).`
      : 'Su cuenta está temporalmente bloqueada por múltiples intentos fallidos.';
  }

  // Credenciales inválidas
  if (status === 401 || (typeof msg === 'string' && /Credenciales inválidas/i.test(msg))) {
    return 'Correo electrónico o contraseña incorrectos. Por favor intente nuevamente.';
  }

  // Acceso denegado por rol u permisos
  if (status === 403 || (typeof msg === 'string' && /Acceso denegado/i.test(msg))) {
    return 'Acceso denegado. Verifique que su cuenta tenga permisos para acceder.';
  }

  // Validación
  if (status === 400 || (typeof msg === 'string' && /inválid|requerid|debe/i.test(msg))) {
    return msg || 'Los datos ingresados no son válidos.';
  }

  // Errores del servidor
  if (status && status >= 500) {
    return 'Error interno del servidor. Intente más tarde.';
  }

  // Fallback genérico manteniendo español
  return (typeof msg === 'string' && msg) || (typeof raw === 'string' && raw) || 'Error al iniciar sesión.';
}

export function getLoginSuggestion(input: ApiErrorPayload | Error | string): string {
  const raw = typeof input === 'string' ? input : (input as any)?.message || (input as any)?.error;
  const status = typeof input === 'object' && 'status' in (input as any) ? (input as any).status : undefined;

  if ((typeof raw === 'string' && NETWORK_ERROR_MESSAGES.some(e => raw.includes(e))) || status === 0) {
    return 'Sugerencia: Verifique su conexión y que el servicio de autenticación esté activo.';
  }
  if (status === 401) {
    return '¿Olvidó su contraseña?';
  }
  if (status === 429) {
    return 'Espere unos minutos y vuelva a intentar.';
  }
  return '';
}