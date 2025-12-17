console.log("Start Test");
try {
    console.log("Importing shared/config...");
    const { config } = require('../shared/config');
    console.log("Config loaded");

    console.log("Importing shared/utils/logger...");
    const logger = require('../shared/utils/logger');
    console.log("Logger loaded");

    console.log("Importing shared/database...");
    const db = require('../shared/database');
    console.log("Database loaded");

    console.log("Importing shared/utils/redis...");
    const redis = require('../shared/utils/redis');
    console.log("Redis loaded");

    console.log("Importing shared/security...");
    const security = require('../shared/security');
    console.log("Security loaded");

    console.log("Importing src/routes/index.ts...");
    const routes = require('./src/routes/index.ts');
    console.log("Routes loaded");

    console.log("All imports successful");
} catch (e) {
    console.error("Error during import:", e);
}
