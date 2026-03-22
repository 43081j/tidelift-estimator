#!/usr/bin/env node

import {parseArgs} from 'node:util';
import {styleText} from 'node:util';
import {estimate} from './main.js';

const {positionals} = parseArgs({
  allowPositionals: true
});

const username = positionals[0];

if (!username) {
  console.error(styleText('red', 'Error: Please provide a username.'));
  console.error(`Usage: tidelift-estimator <username>`);
  process.exit(1);
}

console.log(
  styleText('dim', `Fetching packages for ${styleText('bold', username)}...`)
);

const result = await estimate(username);

console.log();
console.log(styleText('bold', `Tidelift Estimate for ${result.username}`));
console.log(styleText('dim', '─'.repeat(process.stdout.columns)));
console.log(
  `  Packages:        ${styleText('cyan', String(result.packageCount))}`
);
console.log(
  `  Lifted packages: ${styleText('green', String(result.liftedPackageCount))}`
);
console.log(
  `  Monthly income:  ${styleText('green', styleText('bold', `$${result.monthlyDollars}`))}`
);
