export interface Estimation {
  username: string;
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
    downloads: {
      monthly: number;
      weekly: number;
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

interface PackageInfo {
  name: string;
  weeklyDownloads: number;
}

async function fetchAllPackages(username: string): Promise<PackageInfo[]> {
  const packages: PackageInfo[] = [];
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
      packages.push({
        name: obj.package.name,
        weeklyDownloads: obj.downloads?.weekly ?? 0
      });
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

async function fetchLiftedPackages(
  packages: PackageInfo[]
): Promise<Set<string>> {
  const lifted = new Set<string>();
  const names = packages.map((p) => p.name);
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

export async function estimate(username: string): Promise<Estimation> {
  const packages = await fetchAllPackages(username);
  const liftedNames = await fetchLiftedPackages(packages);

  let monthlyDollars = 0;
  for (const pkg of packages) {
    if (liftedNames.has(pkg.name)) {
      monthlyDollars += dollarsPerLiftedPackage;
    }
  }

  return {
    username,
    monthlyDollars,
    packageCount: packages.length,
    liftedPackageCount: liftedNames.size
  };
}
