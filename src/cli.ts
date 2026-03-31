#!/usr/bin/env node

import {parseArgs} from 'node:util';
import {styleText} from 'node:util';
import {estimate} from './main.js';

const {positionals, values} = parseArgs({
  allowPositionals: true,
  options: {
    package: {
      type: 'boolean',
      short: 'p'
    }
  }
});

const name = positionals[0];

if (!name) {
  console.error(
    styleText(
      'red',
      'Error: Please provide a username (or package name with --package).'
    )
  );
  console.error(`Usage: tidelift-estimator [--package] <name>`);
  process.exit(1);
}

console.log(styleText('dim', `Looking up ${styleText('bold', name)}...`));

const result = await estimate(name, {package: values.package ?? false});

const label =
  result.kind === 'package'
    ? `Tidelift Estimate for package ${result.name}`
    : `Tidelift Estimate for ${result.name}`;

console.log();
console.log(styleText('bold', label));
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
console.log();
console.log(
  styleText(
    'dim',
    'Note: This estimate assumes each lifted package earns $50/month,'
  )
);
console.log(
  styleText(
    'dim',
    'and that the user is the primary maintainer, i.e. the beneficiary.'
  )
);
