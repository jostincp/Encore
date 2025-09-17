# Encore Platform - Suite de Pruebas

Suite completa de pruebas automatizadas para garantizar la calidad, estabilidad y rendimiento de la plataforma Encore.

## 🏗️ Arquitectura de Tests

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Tests Unitarios │   │ Tests de Integra │   │   Tests E2E      │
│    (Jest)         │   │   ción (Supertest│   │ (Playwright)     │
│                   │   │       )         │   │                  │
│ • Modelos         │   │ • APIs completas │   │ • Flujos usuario │
│ • Utilidades      │   │ • Base de datos  │   │ • Navegador      │
│ • Lógica negocio  │   │ • Servicios      │   │ • UI/UX          │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    Tests de Rendimiento │
                    │    Tests de Accesibilidad│
                    │    Tests de Seguridad    │
                    └─────────────────────────┘
```

## 📋 Tipos de Pruebas

### 🧪 **Tests Unitarios** (Jest)
Pruebas de componentes individuales en aislamiento:
- **Modelos de datos** y validaciones
- **Utilidades y helpers**
- **Lógica de negocio** pura
- **Funciones de transformación**

### 🔗 **Tests de Integración** (Supertest)
Pruebas de interacción entre componentes:
- **APIs completas** con base de datos real
- **Flujos de autenticación** end-to-end
- **Integración entre servicios**
- **Validación de contratos** de API

### 🌐 **Tests End-to-End** (Playwright)
Pruebas desde la perspectiva del usuario:
- **Flujos completos** de usuario
- **Interfaz de usuario** y UX
- **Navegación y routing**
- **Funcionalidades críticas**

### ⚡ **Tests de Performance**
Pruebas de velocidad y escalabilidad:
- **Tiempos de carga** de páginas
- **Tiempos de respuesta** de APIs
- **Uso de memoria** y CPU
- **Simulación de carga**

### ♿ **Tests de Accesibilidad**
Pruebas de cumplimiento de estándares:
- **WCAG 2.1** compliance
- **Navegación por teclado**
- **Lectores de pantalla**
- **Contraste de colores**

### 🔒 **Tests de Seguridad**
Pruebas de vulnerabilidades:
- **XSS prevention**
- **CSRF protection**
- **Input sanitization**
- **Authentication bypass**

## 🚀 Inicio Rápido

### 1. Instalar Dependencias

```bash
# Instalar dependencias del proyecto
npm install

# Instalar dependencias de tests
cd tests
npm install

# Instalar navegadores de Playwright
npx playwright install
```

### 2. Ejecutar Tests

```bash
# Ejecutar todos los tests
./tests/run-tests.sh all

# Ejecutar tests unitarios
./tests/run-tests.sh unit

# Ejecutar tests con cobertura
./tests/run-tests.sh all true

# Ejecutar tests específicos
./tests/run-tests.sh e2e
./tests/run-tests.sh performance
./tests/run-tests.sh accessibility
```

### 3. Ver Reportes

```bash
# Abrir reporte de cobertura
open tests/reports/lcov-report/index.html

# Abrir reporte de Playwright
open tests/test-results/index.html

# Ver reporte de JUnit (para CI)
cat tests/reports/junit.xml
```

## ⚙️ Configuración Detallada

### Jest Configuration

#### Archivo: `tests/jest.config.js`

```javascript
module.exports = {
  // Configuración de módulos
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/frontend/src/$1',
    '^@encore/(.*)$': '<rootDir>/backend/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1'
  },

  // Cobertura
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Reportes
  reporters: [
    'default',
    ['jest-junit', { outputFile: 'reports/junit.xml' }],
    ['jest-html-reporter', { outputPath: 'reports/test-report.html' }]
  ]
}
```

### Playwright Configuration

#### Archivo: `tests/playwright.config.ts`

```typescript
export default defineConfig({
  // Proyectos de test
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
    { name: 'Mobile Chrome', use: devices['Pixel 5'] }
  ],

  // Configuración de servidor
  webServer: [
    {
      command: 'npm run dev',
      port: 3000,
      timeout: 120000
    }
  ],

  // Reportes
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'reports/junit.xml' }]
  ]
})
```

## 📝 Escribiendo Tests

### Tests Unitarios

#### Ejemplo: Test de utilidad

```typescript
// tests/unit/utils/formatPrice.test.ts
import { formatPrice } from '../../../shared/utils/format';

describe('formatPrice', () => {
  it('should format price in EUR correctly', () => {
    expect(formatPrice(29.99)).toBe('29,99 €');
    expect(formatPrice(1000)).toBe('1.000,00 €');
  });

  it('should handle zero and negative values', () => {
    expect(formatPrice(0)).toBe('0,00 €');
    expect(formatPrice(-50)).toBe('-50,00 €');
  });
});
```

#### Ejemplo: Test de modelo

```typescript
// tests/unit/models/User.test.ts
import { User } from '../../../backend/auth-service/src/models/User';

describe('User Model', () => {
  beforeEach(async () => {
    await User.destroy({ where: {}, force: true });
  });

  it('should create user successfully', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'hashedPassword',
      firstName: 'John',
      lastName: 'Doe'
    };

    const user = await User.create(userData);

    expect(user.email).toBe(userData.email);
    expect(user.firstName).toBe(userData.firstName);
    expect(user.isActive).toBe(true);
  });

  it('should validate email format', async () => {
    await expect(
      User.create({ email: 'invalid-email' })
    ).rejects.toThrow();
  });
});
```

### Tests de Integración

#### Ejemplo: Test de API

```javascript
// tests/integration/auth-service/auth-api.test.js
const request = require('supertest');
const { createApp } = require('../../../backend/auth-service/src/app');

describe('Auth API Integration', () => {
  let app;

  beforeAll(async () => {
    app = createApp();
  });

  it('should register user successfully', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'ValidPass123!',
        firstName: 'John',
        lastName: 'Doe'
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.tokens).toBeDefined();
  });

  it('should handle rate limiting', async () => {
    // Simular múltiples requests
    for (let i = 0; i < 6; i++) {
      await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'wrongpassword'
      });
    }

    // Último request debería ser rate limited
    await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'wrongpassword'
      })
      .expect(429);
  });
});
```

### Tests E2E

#### Ejemplo: Flujo de autenticación

```typescript
// tests/e2e/auth-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('/login');

    // Llenar formulario
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Verificar redirección
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Verificar contenido
    await expect(page.locator('text=Welcome')).toBeVisible();
  });

  test('should handle invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Verificar mensaje de error
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });
});
```

### Tests de Performance

#### Ejemplo: Medición de tiempos

```typescript
// tests/e2e/performance.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('should load login page quickly', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000); // < 3 segundos

    // Medir Core Web Vitals
    const metrics = await page.evaluate(() => {
      // Usar Performance API
      const perfEntries = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: perfEntries.domContentLoadedEventEnd - perfEntries.domContentLoadedEventStart,
        loadComplete: perfEntries.loadEventEnd - perfEntries.loadEventStart
      };
    });

    expect(metrics.domContentLoaded).toBeLessThan(2000);
    expect(metrics.loadComplete).toBeLessThan(3000);
  });
});
```

### Tests de Accesibilidad

#### Ejemplo: Verificación de accesibilidad

```typescript
// tests/e2e/accessibility.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test('should have no accessibility violations', async ({ page }) => {
    await page.goto('/login');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
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
});
```

## 📊 Cobertura de Código

### Configuración de Umbrales

```javascript
// jest.config.js
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80
  },
  './backend/*/src/': {
    branches: 85,
    functions: 85,
    lines: 85,
    statements: 85
  },
  './frontend/src/': {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70
  }
}
```

### Reportes de Cobertura

```bash
# Ver reporte HTML
open tests/reports/lcov-report/index.html

# Ver resumen en terminal
npm run test:coverage
```

### Mejores Prácticas de Cobertura

1. **Enfocarse en lógica crítica** - No perseguir 100% cobertura
2. **Testear caminos alternos** - Branches, errores, edge cases
3. **Mockear dependencias externas** - APIs, bases de datos
4. **Integration tests** para flujos completos
5. **E2E tests** para funcionalidades críticas

## 🔄 CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm install

    - name: Install test dependencies
      run: |
        cd tests
        npm install
        npx playwright install

    - name: Run tests
      run: ./tests/run-tests.sh all true

    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./tests/reports/coverage/lcov.info

    - name: Upload test results
      uses: actions/upload-artifact@v3
      with:
        name: test-results
        path: tests/reports/
```

### Jenkins Pipeline

```groovy
// Jenkinsfile
pipeline {
    agent any

    stages {
        stage('Test') {
            steps {
                sh 'npm install'
                sh 'cd tests && npm install'
                sh 'npx playwright install'
                sh './tests/run-tests.sh all true'
            }

            post {
                always {
                    publishCoverage adapters: [
                        istanbulCoberturaAdapter('tests/reports/coverage/cobertura-coverage.xml')
                    ]
                    junit 'tests/reports/junit.xml'
                }
            }
        }
    }
}
```

## 🐛 Debugging Tests

### Debug Tests Unitarios

```bash
# Ejecutar test específico
npm run test:unit -- --testNamePattern="should create user"

# Debug con Node inspector
npm run test:unit -- --inspect-brk

# Ver logs detallados
npm run test:unit -- --verbose
```

### Debug Tests E2E

```bash
# Ejecutar en modo debug
npx playwright test --debug

# Ejecutar con headed browser
npx playwright test --headed

# Generar trace
npx playwright test --trace on
```

### Debug Tests de Integración

```bash
# Ver logs de la aplicación
tail -f logs/auth-service.log

# Ver estado de base de datos
docker-compose exec test-db psql -U postgres -d encore_test -c "SELECT * FROM users;"

# Ejecutar test específico
npm run test:integration -- --testNamePattern="should register user"
```

## 📈 Métricas y KPIs

### Cobertura de Código
- **Backend**: > 85% (branches, functions, lines, statements)
- **Frontend**: > 70% (branches, functions, lines, statements)
- **Shared**: > 90% (utilidades críticas)

### Tiempos de Ejecución
- **Unit Tests**: < 2 minutos
- **Integration Tests**: < 5 minutos
- **E2E Tests**: < 10 minutos
- **Full Suite**: < 15 minutos

### Calidad de Código
- **Zero bugs** en funcionalidades críticas
- **Zero security vulnerabilities**
- **Zero accessibility violations**
- **Performance budgets** cumplidos

## 🎯 Mejores Prácticas

### Estructura de Tests

```
tests/
├── unit/                    # Tests unitarios
│   ├── components/         # Componentes React
│   ├── utils/             # Utilidades
│   ├── models/            # Modelos de datos
│   └── services/          # Servicios
├── integration/           # Tests de integración
│   ├── api/              # APIs
│   └── database/         # Base de datos
├── e2e/                  # Tests end-to-end
│   ├── auth/            # Autenticación
│   ├── music/           # Música
│   └── admin/           # Administración
├── setup/               # Configuración
│   ├── jest.setup.js    # Jest setup
│   ├── global-setup.ts  # Playwright setup
│   └── test-db.js       # Base de datos de test
├── mocks/               # Mocks y fixtures
│   ├── api/            # APIs mock
│   └── data/           # Datos de test
└── utils/              # Utilidades de test
    ├── helpers.js      # Helpers
    └── factories.js    # Factories
```

### Naming Conventions

```javascript
// Tests unitarios
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with valid data', () => {
      // Test implementation
    });

    it('should throw error for invalid email', () => {
      // Test implementation
    });
  });
});

// Tests e2e
test.describe('User Registration', () => {
  test('should register new user successfully', async ({ page }) => {
    // Test implementation
  });

  test('should show validation errors', async ({ page }) => {
    // Test implementation
  });
});
```

### Patrón AAA (Arrange, Act, Assert)

```javascript
it('should create user successfully', async () => {
  // Arrange - Preparar datos y estado
  const userData = { email: 'test@example.com', name: 'Test User' };
  const mockRepo = { save: jest.fn() };

  // Act - Ejecutar la función bajo test
  const result = await userService.createUser(userData, mockRepo);

  // Assert - Verificar resultado
  expect(result.id).toBeDefined();
  expect(result.email).toBe(userData.email);
  expect(mockRepo.save).toHaveBeenCalledWith(userData);
});
```

## 🔧 Troubleshooting

### Problemas Comunes

#### Tests no pasan en CI
```bash
# Verificar variables de entorno
echo $NODE_ENV
echo $DATABASE_URL

# Ejecutar con modo verbose
npm run test:ci -- --verbose

# Verificar logs
cat tests/reports/junit.xml
```

#### Tests e2e fallan
```bash
# Verificar que la aplicación esté corriendo
curl http://localhost:3000

# Ejecutar con browser visible
npx playwright test --headed

# Ver screenshot de fallos
ls tests/test-results/
```

#### Cobertura baja
```bash
# Ver qué líneas no están cubiertas
open tests/reports/lcov-report/index.html

# Ejecutar con cobertura detallada
npm run test:coverage -- --verbose
```

#### Tests lentos
```bash
# Ejecutar en paralelo
npm run test:unit -- --maxWorkers=50%

# Ver tests más lentos
npm run test:unit -- --verbose --timers
```

## 📚 Recursos Adicionales

### Documentación Oficial
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Library](https://testing-library.com/docs/)

### Librerías de Testing
- **React Testing Library** - Tests de componentes React
- **Enzyme** - Testing utility para React
- **Axios Mock Adapter** - Mock de HTTP requests
- **Mock Service Worker** - Mock de APIs

### Herramientas de Calidad
- **ESLint** - Linting de código
- **Prettier** - Formateo de código
- **Husky** - Git hooks
- **Commitlint** - Validación de commits

---

**Nota**: Esta suite de pruebas proporciona una base sólida para garantizar la calidad y estabilidad de Encore Platform. Los tests están diseñados para ejecutarse tanto localmente como en CI/CD, proporcionando feedback rápido sobre cambios en el código.