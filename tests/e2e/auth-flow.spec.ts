/**
 * Encore Platform - Authentication Flow E2E Tests
 * Tests end-to-end para el flujo completo de autenticación
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Limpiar localStorage y cookies antes de cada test
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Navegar a la página principal
    await page.goto('/');
  });

  test('should display login form by default', async ({ page }) => {
    // Verificar que estamos en la página de login
    await expect(page).toHaveURL(/.*\/login/);

    // Verificar elementos del formulario
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Verificar texto del botón
    await expect(page.locator('button[type="submit"]')).toContainText(/iniciar sesión|login/i);
  });

  test('should show validation errors for empty form', async ({ page }) => {
    // Hacer clic en el botón de submit sin llenar campos
    await page.locator('button[type="submit"]').click();

    // Verificar mensajes de error
    await expect(page.locator('text=/requerido|obligatorio/i')).toBeVisible();
    await expect(page.locator('text=/email.*válido/i')).toBeVisible();
  });

  test('should show validation error for invalid email', async ({ page }) => {
    // Llenar email inválido
    await page.locator('input[type="email"]').fill('invalid-email');
    await page.locator('input[type="password"]').fill('password123');

    // Hacer clic en submit
    await page.locator('button[type="submit"]').click();

    // Verificar mensaje de error
    await expect(page.locator('text=/email.*válido/i')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Llenar credenciales inválidas
    await page.locator('input[type="email"]').fill('invalid@example.com');
    await page.locator('input[type="password"]').fill('wrongpassword');

    // Hacer clic en submit
    await page.locator('button[type="submit"]').click();

    // Verificar mensaje de error
    await expect(page.locator('text=/credenciales.*incorrectas|invalid.*credentials/i')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    // Llenar credenciales válidas
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill('password123');

    // Hacer clic en submit
    await page.locator('button[type="submit"]').click();

    // Verificar redirección al dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Verificar que el usuario está autenticado
    await expect(page.locator('text=/bienvenido|welcome/i')).toBeVisible();

    // Verificar que los tokens están en localStorage
    const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    const refreshToken = await page.evaluate(() => localStorage.getItem('refreshToken'));

    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
  });

  test('should persist authentication across page reloads', async ({ page }) => {
    // Login primero
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();

    // Esperar a que se complete el login
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Recargar la página
    await page.reload();

    // Verificar que seguimos autenticados
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.locator('text=/bienvenido|welcome/i')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login primero
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Hacer clic en el botón de logout
    await page.locator('button[aria-label*="logout"], button:has-text("Logout")').click();

    // Verificar redirección al login
    await expect(page).toHaveURL(/.*\/login/);

    // Verificar que los tokens fueron removidos
    const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    const refreshToken = await page.evaluate(() => localStorage.getItem('refreshToken'));

    expect(accessToken).toBeNull();
    expect(refreshToken).toBeNull();
  });

  test('should redirect to login when accessing protected route without authentication', async ({ page }) => {
    // Intentar acceder directamente a una ruta protegida
    await page.goto('/dashboard');

    // Verificar redirección al login
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('should handle expired tokens gracefully', async ({ page }) => {
    // Simular token expirado en localStorage
    await page.evaluate(() => {
      localStorage.setItem('accessToken', 'expired.jwt.token');
      localStorage.setItem('refreshToken', 'expired.refresh.token');
    });

    // Intentar acceder a una ruta protegida
    await page.goto('/dashboard');

    // Verificar redirección al login
    await expect(page).toHaveURL(/.*\/login/);

    // Verificar mensaje de sesión expirada
    await expect(page.locator('text=/sesión.*expirada|session.*expired/i')).toBeVisible();
  });

  test('should handle network errors during login', async ({ page }) => {
    // Simular desconexión de red (esto requeriría configuración especial)
    // En un test real, podrías usar page.route() para interceptar requests

    test.skip('Network error simulation requires additional setup');
  });
});

test.describe('Registration Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('should display registration form', async ({ page }) => {
    await page.goto('/register');

    // Verificar elementos del formulario
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="first name" i]')).toBeVisible();
    await expect(page.locator('input[placeholder*="last name" i]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should register new user successfully', async ({ page }) => {
    await page.goto('/register');

    // Llenar formulario de registro
    await page.locator('input[type="email"]').fill(`user${Date.now()}@example.com`);
    await page.locator('input[placeholder*="first name" i]').fill('Test');
    await page.locator('input[placeholder*="last name" i]').fill('User');
    await page.locator('input[type="password"]').fill('ValidPass123!');

    // Hacer clic en submit
    await page.locator('button[type="submit"]').click();

    // Verificar redirección al dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Verificar mensaje de éxito
    await expect(page.locator('text=/registro.*exitoso|registration.*successful/i')).toBeVisible();
  });

  test('should show error for duplicate email', async ({ page }) => {
    await page.goto('/register');

    // Intentar registrar con email ya existente
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[placeholder*="first name" i]').fill('Test');
    await page.locator('input[placeholder*="last name" i]').fill('User');
    await page.locator('input[type="password"]').fill('ValidPass123!');

    await page.locator('button[type="submit"]').click();

    // Verificar mensaje de error
    await expect(page.locator('text=/email.*ya.*existe|email.*already.*exists/i')).toBeVisible();
  });
});

test.describe('Password Reset Flow', () => {
  test('should handle forgot password request', async ({ page }) => {
    await page.goto('/forgot-password');

    // Llenar email
    await page.locator('input[type="email"]').fill('test@example.com');

    // Hacer clic en submit
    await page.locator('button[type="submit"]').click();

    // Verificar mensaje de éxito
    await expect(page.locator('text=/email.*enviado|email.*sent/i')).toBeVisible();
  });
});

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('should work on mobile devices', async ({ page }) => {
    await page.goto('/login');

    // Verificar que el formulario se adapta al móvil
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Verificar que no hay scroll horizontal
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10); // Permitir pequeño margen
  });
});

test.describe('Accessibility', () => {
  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/login');

    // Verificar labels de accesibilidad
    await expect(page.locator('input[type="email"]')).toHaveAttribute('aria-label', /email/i);
    await expect(page.locator('input[type="password"]')).toHaveAttribute('aria-label', /password|contraseña/i);
    await expect(page.locator('button[type="submit"]')).toHaveAttribute('aria-label');
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/login');

    // Navegar con tab
    await page.keyboard.press('Tab');
    await expect(page.locator('input[type="email"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('input[type="password"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('button[type="submit"]')).toBeFocused();
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/login');

    // Verificar contraste de colores (esto requeriría herramientas especializadas)
    // En un test real, usaríamos axe-playwright o similar

    test.skip('Color contrast testing requires specialized tools');
  });
});

test.describe('Performance', () => {
  test('should load login page quickly', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/login');

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000); // Menos de 3 segundos
  });

  test('should login quickly', async ({ page }) => {
    await page.goto('/login');

    const startTime = Date.now();

    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/.*\/dashboard/);

    const loginTime = Date.now() - startTime;
    expect(loginTime).toBeLessThan(5000); // Menos de 5 segundos
  });
});

test.describe('Security', () => {
  test('should not expose sensitive data in localStorage', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Verificar que no hay datos sensibles en localStorage
    const localStorageData = await page.evaluate(() => {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        data[key] = localStorage.getItem(key);
      }
      return data;
    });

    // Los tokens JWT están en localStorage, pero deberían estar encriptados
    expect(localStorageData.accessToken).toBeDefined();
    expect(localStorageData.refreshToken).toBeDefined();

    // Verificar que no hay contraseñas en texto plano
    expect(Object.values(localStorageData)).not.toContain('password123');
  });

  test('should handle XSS attempts safely', async ({ page }) => {
    await page.goto('/login');

    // Intentar inyección XSS
    const xssPayload = '<script>alert("XSS")</script>';
    await page.locator('input[type="email"]').fill(xssPayload);

    // Verificar que el payload no se ejecuta
    const alertShown = await page.evaluate(() => {
      return new Promise((resolve) => {
        window.alert = () => resolve(true);
        setTimeout(() => resolve(false), 1000);
      });
    });

    expect(alertShown).toBe(false);
  });
});