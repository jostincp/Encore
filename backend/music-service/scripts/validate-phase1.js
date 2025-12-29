#!/usr/bin/env node
/**
 * Phase 1 Validation Script
 * Validates all Phase 1 requirements are met
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const VALIDATION_CRITERIA = {
    cacheHitRate: 70, // minimum 70%
    p95Latency: 500, // maximum 500ms
    quotaUsage: 50, // maximum 50% of daily quota
    searchesPerDay: 300, // minimum 300 searches/day
    uptime: 99.5 // minimum 99.5%
};

async function validatePhase1() {
    console.log('\n🔍 Phase 1 Validation Script');
    console.log('='.repeat(60));
    console.log(`Started: ${new Date().toISOString()}\n`);

    const results = {
        passed: [],
        failed: [],
        warnings: []
    };

    try {
        // 1. Run unit tests
        console.log('📝 Running unit tests...');
        try {
            const { stdout } = await execPromise('npm run test:unit');
            console.log('✅ Unit tests passed');
            results.passed.push('Unit tests');
        } catch (error) {
            console.log('❌ Unit tests failed');
            results.failed.push('Unit tests');
        }

        // 2. Run integration tests
        console.log('\n📝 Running integration tests...');
        try {
            const { stdout } = await execPromise('npm run test:integration');
            console.log('✅ Integration tests passed');
            results.passed.push('Integration tests');
        } catch (error) {
            console.log('❌ Integration tests failed');
            results.failed.push('Integration tests');
        }

        // 3. Run performance tests
        console.log('\n📝 Running performance tests...');
        try {
            const { stdout } = await execPromise('npm run test:performance');
            console.log('✅ Performance tests passed');
            results.passed.push('Performance tests');
        } catch (error) {
            console.log('❌ Performance tests failed');
            results.failed.push('Performance tests');
        }

        // 4. Check cache hit rate (would need actual metrics)
        console.log('\n📊 Checking cache hit rate...');
        console.log(`Target: ≥ ${VALIDATION_CRITERIA.cacheHitRate}%`);
        console.log('⚠️  Manual verification required');
        results.warnings.push('Cache hit rate - manual verification needed');

        // 5. Check P95 latency (would need actual metrics)
        console.log('\n⏱️  Checking P95 latency...');
        console.log(`Target: < ${VALIDATION_CRITERIA.p95Latency}ms`);
        console.log('⚠️  Manual verification required');
        results.warnings.push('P95 latency - manual verification needed');

        // 6. Check quota usage (would need actual metrics)
        console.log('\n📈 Checking quota usage...');
        console.log(`Target: < ${VALIDATION_CRITERIA.quotaUsage}% daily`);
        console.log('⚠️  Manual verification required');
        results.warnings.push('Quota usage - manual verification needed');

        // 7. Generate summary report
        console.log('\n' + '='.repeat(60));
        console.log('📋 VALIDATION SUMMARY');
        console.log('='.repeat(60));

        console.log(`\n✅ Passed (${results.passed.length}):`);
        results.passed.forEach(item => console.log(`   - ${item}`));

        if (results.failed.length > 0) {
            console.log(`\n❌ Failed (${results.failed.length}):`);
            results.failed.forEach(item => console.log(`   - ${item}`));
        }

        if (results.warnings.length > 0) {
            console.log(`\n⚠️  Warnings (${results.warnings.length}):`);
            results.warnings.forEach(item => console.log(`   - ${item}`));
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 PHASE 1 VALIDATION CRITERIA');
        console.log('='.repeat(60));
        console.log(`Cache Hit Rate:        ≥ ${VALIDATION_CRITERIA.cacheHitRate}%`);
        console.log(`P95 Latency:           < ${VALIDATION_CRITERIA.p95Latency}ms`);
        console.log(`Quota Usage:           < ${VALIDATION_CRITERIA.quotaUsage}% daily`);
        console.log(`Searches/Day:          > ${VALIDATION_CRITERIA.searchesPerDay}`);
        console.log(`Uptime:                > ${VALIDATION_CRITERIA.uptime}%`);

        console.log('\n' + '='.repeat(60));

        if (results.failed.length === 0) {
            console.log('✅ Phase 1 VALIDATION PASSED');
            console.log('\n💡 Next Steps:');
            console.log('   1. Monitor metrics for 7 days');
            console.log('   2. Verify all criteria are met');
            console.log('   3. If all pass → Ready for Phase 2');
            process.exit(0);
        } else {
            console.log('❌ Phase 1 VALIDATION FAILED');
            console.log('\n💡 Action Required:');
            console.log('   1. Fix failed tests');
            console.log('   2. Re-run validation');
            console.log('   3. Do not proceed to Phase 2');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n💥 Validation script error:', error);
        process.exit(1);
    }
}

// Run validation
if (require.main === module) {
    validatePhase1();
}

module.exports = { validatePhase1, VALIDATION_CRITERIA };
