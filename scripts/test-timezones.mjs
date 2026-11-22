#!/usr/bin/env node
// Lance la suite de tests sous plusieurs fuseaux horaires.
// Certains bugs de dates n'apparaissent qu'à l'est (France) ou à l'ouest de UTC.
//
// Usage : node scripts/test-timezones.mjs [arguments vitest…]
import { spawnSync } from 'node:child_process';

const TIMEZONES = ['Europe/Paris', 'America/New_York', 'UTC'];
const extraArgs = process.argv.slice(2);
let failed = false;

for (const tz of TIMEZONES) {
    console.log(`\n▶ TZ=${tz}`);
    const result = spawnSync('npx', ['vitest', 'run', ...extraArgs], {
        stdio: 'inherit',
        shell: process.platform === 'win32',
        env: { ...process.env, TZ: tz },
    });
    if (result.status !== 0) {
        failed = true;
        console.error(`✖ échec sous TZ=${tz}`);
    }
}

process.exit(failed ? 1 : 0);
