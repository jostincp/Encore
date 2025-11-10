import { describe, it, expect } from 'vitest';
import { getLoginErrorMessage, getLoginSuggestion } from './authErrors';

describe('authErrors utility', () => {
  it('maps network errors to Spanish message and suggestion', () => {
    const msg = getLoginErrorMessage('Failed to fetch');
    const sug = getLoginSuggestion('Failed to fetch');
    expect(msg).toMatch(/Error de conexión/);
    expect(sug).toMatch(/conexión/);
  });

  it('maps 401 to incorrect credentials', () => {
    const payload = { status: 401, message: 'Credenciales inválidas' };
    expect(getLoginErrorMessage(payload)).toMatch(/Correo electrónico o contraseña incorrectos/);
    expect(getLoginSuggestion(payload)).toBe('¿Olvidó su contraseña?');
  });

  it('maps 429 to account locked with minutes when present', () => {
    const payloadWithMinutes = { status: 429, message: 'Cuenta bloqueada por 15 minutos' };
    expect(getLoginErrorMessage(payloadWithMinutes)).toMatch(/15 minutos/);

    const payloadGeneric = { status: 429, message: 'Cuenta bloqueada' };
    expect(getLoginErrorMessage(payloadGeneric)).toMatch(/temporalmente bloqueada/);
    expect(getLoginSuggestion(payloadGeneric)).toBe('Espere unos minutos y vuelva a intentar.');
  });

  it('maps 403 to access denied', () => {
    const payload = { status: 403, message: 'Acceso denegado' };
    expect(getLoginErrorMessage(payload)).toMatch(/Acceso denegado/);
  });

  it('maps 400 to validation', () => {
    const payload = { status: 400, message: 'Email inválido' };
    expect(getLoginErrorMessage(payload)).toContain('Email inválido');
  });

  it('maps 500+ to server error', () => {
    const payload = { status: 500, message: 'Internal server error' };
    expect(getLoginErrorMessage(payload)).toMatch(/Error interno del servidor/);
  });

  it('fallback to generic Spanish', () => {
    const payload = { status: 418, message: 'Algo salió mal' };
    expect(getLoginErrorMessage(payload)).toContain('Algo salió mal');
  });
});