export interface Estimation {
  kind: 'user' | 'package';
  name: string;
  monthlyDollars: number;
  packageCount: number;
  liftedPackageCount: number;
}

interface NpmSearchResponse {
  total: number;
  objects: Array<{
    package: {
      name: string;
    };
  }>;
}

interface TideliftEstimate {
  name: string;
  platform: string;
  lifted: boolean;
}

const npmSearchPageSize = 250;
const tideliftBatchSize = 20;
const dollarsPerLiftedPackage = 50;

interface NpmManifest {
  maintainers?: Array<{name: string}>;
  dependencies?: Record<string, string>;
}

async function fetchAllPackages(username: string): Promise<string[]> {
  const packages: string[] = [];
  let from = 0;

  while (true) {
    const url = `https://registry.npmjs.org/-/v1/search?text=maintainer:${encodeURIComponent(username)}&size=${npmSearchPageSize}&from=${from}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `npm registry request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as NpmSearchResponse;

    for (const obj of data.objects) {
      packages.push(obj.package.name);
    }

    if (packages.length >= data.total || data.objects.length === 0) {
      break;
    }

    from += data.objects.length;
  }

  return packages;
}

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function fetchLiftedPackages(names: string[]): Promise<Set<string>> {
  const lifted = new Set<string>();
  const batches = chunk(names, tideliftBatchSize);

  for (const batch of batches) {
    const response = await fetch(
      'https://tidelift.com/api/depci/estimate/bulk_estimates',
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          packages: batch.map((name) => ({platform: 'npm', name}))
        })
      }
    );

    if (!response.ok) {
      throw new Error(
        `Tidelift API request failed: ${response.status} ${response.statusText}`
      );
    }

    const estimates = (await response.json()) as TideliftEstimate[];

    for (const est of estimates) {
      if (est.lifted) {
        lifted.add(est.name);
      }
    }
  }

  return lifted;
}

async function fetchManifest(name: string): Promise<NpmManifest | null> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/latest`;
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as NpmManifest;
}

async function resolveAuthorDependencies(
  name: string,
  maintainerNames: Set<string>
): Promise<string[]> {
  const seen = new Set<string>();
  const queue = [name];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current || seen.has(current)) {
      continue;
    }

    const manifest = await fetchManifest(current);
    if (!manifest) {
      continue;
    }

    const isSameAuthor =
      current === name ||
      (manifest.maintainers?.some((m) => maintainerNames.has(m.name)) ?? false);

    if (!isSameAuthor) {
      continue;
    }

    seen.add(current);

    if (manifest.dependencies) {
      for (const dep of Object.keys(manifest.dependencies)) {
        if (!seen.has(dep)) {
          queue.push(dep);
        }
      }
    }
  }

  return [...seen];
}

async function estimatePackage(
  name: string,
  manifest: NpmManifest
): Promise<Estimation> {
  const maintainerNames = new Set(
    manifest.maintainers?.map((m) => m.name) ?? []
  );
  const allDeps = await resolveAuthorDependencies(name, maintainerNames);
  const liftedNames = await fetchLiftedPackages(allDeps);

  return {
    kind: 'package',
    name,
    monthlyDollars: liftedNames.size * dollarsPerLiftedPackage,
    packageCount: allDeps.length,
    liftedPackageCount: liftedNames.size
  };
}

async function estimateUser(username: string): Promise<Estimation> {
  const packages = await fetchAllPackages(username);
  const liftedNames = await fetchLiftedPackages(packages);

  return {
    kind: 'user',
    name: username,
    monthlyDollars: liftedNames.size * dollarsPerLiftedPackage,
    packageCount: packages.length,
    liftedPackageCount: liftedNames.size
  };
}

export async function estimate(
  name: string,
  options?: {package?: boolean}
): Promise<Estimation> {
  if (options?.package) {
    const manifest = await fetchManifest(name);
    if (!manifest) {
      throw new Error(`Package not found: ${name}`);
    }
    return estimatePackage(name, manifest);
  }
  return estimateUser(name);
}
