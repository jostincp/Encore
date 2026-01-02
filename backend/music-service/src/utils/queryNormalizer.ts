/**
 * Normaliza queries de búsqueda para uso como keys de Redis
 * 
 * Transformaciones aplicadas:
 * - Convierte a minúsculas
 * - Elimina acentos (é → e, ñ → n)
 * - Elimina caracteres especiales (!?.,🔥)
 * - Reemplaza espacios múltiples con guión bajo
 * 
 * @example
 * normalizeQuery('Maluma Éxitos!') // → 'maluma_exitos'
 * normalizeQuery('J. Balvin 🔥')   // → 'j_balvin'
 * normalizeQuery('Feid  Nuevas')   // → 'feid_nuevas'
 */
export function normalizeQuery(q: string): string {
    return q
        .toLowerCase()
        .normalize('NFD')                    // Descomponer acentos (é → e + ́)
        .replace(/[\u0300-\u036f]/g, '')     // Eliminar marcas diacríticas
        .replace(/[^a-z0-9\s]/g, '')         // Solo letras, números y espacios
        .trim()
        .replace(/\s+/g, '_');               // Espacios → guiones bajos
}

// Tests de validación (ejecutar con: npx ts-node src/utils/queryNormalizer.ts)
if (require.main === module) {
    const tests = [
        { input: 'Maluma Éxitos!', expected: 'maluma_exitos' },
        { input: 'J. Balvin 🔥', expected: 'j_balvin' },
        { input: 'Feid  Nuevas', expected: 'feid_nuevas' },
        { input: 'Karol G', expected: 'karol_g' },
        { input: 'REGGAETON 2026!!!', expected: 'reggaeton_2026' },
    ];

    console.log('🧪 Ejecutando tests de normalización...\n');

    let passed = 0;
    let failed = 0;

    tests.forEach(({ input, expected }) => {
        const result = normalizeQuery(input);
        const status = result === expected ? '✅' : '❌';

        if (result === expected) {
            passed++;
        } else {
            failed++;
        }

        console.log(`${status} '${input}' → '${result}' ${result !== expected ? `(esperado: '${expected}')` : ''}`);
    });

    console.log(`\n📊 Resultados: ${passed} pasados, ${failed} fallidos`);
    process.exit(failed > 0 ? 1 : 0);
}
