// Playwright E2E config for GeoTrackr (full gameplay + H1 security regression).
// Le serveur Node sert le build client (client/dist) ET l'API/Socket.IO sur le même port,
// donc un seul webServer suffit. Le build doit être à jour : `npm run build` avant de lancer.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './e2e',
    timeout: 240_000,            // gameplay réel avec Street View = lent
    expect: { timeout: 25_000 },
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [['list']],
    use: {
        baseURL: 'http://localhost:3005',
        ignoreHTTPSErrors: true,
        headless: true,
        actionTimeout: 25_000,
        navigationTimeout: 30_000,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
    webServer: {
        command: 'node index.js',
        cwd: '../server',
        url: 'http://localhost:3005',
        timeout: 60_000,
        reuseExistingServer: false,
        env: {
            JWT_SECRET: 'e2e_test_secret_key_0123456789abcdef',
            ADMIN_PASSWORD: 'e2e_admin_password',
            PORT: '3005',
        },
    },
});
