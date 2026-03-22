import {estimate} from './main.js';
import {describe, it, expect, vi, beforeEach} from 'vitest';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {'Content-Type': 'application/json'}
  });
}

function errorResponse(status: number, statusText: string): Response {
  return new Response(null, {status, statusText});
}

function npmSearchResult(names: string[], total?: number) {
  return {
    total: total ?? names.length,
    objects: names.map((name) => ({package: {name}}))
  };
}

function tideliftResult(entries: Array<{name: string; lifted: boolean}>) {
  return entries.map((e) => ({...e, platform: 'npm'}));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('estimate', () => {
  it('returns correct estimate for a user with lifted packages', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('registry.npmjs.org')) {
        return jsonResponse(npmSearchResult(['pkg-a', 'pkg-b', 'pkg-c']));
      }

      return jsonResponse(
        tideliftResult([
          {name: 'pkg-a', lifted: true},
          {name: 'pkg-b', lifted: false},
          {name: 'pkg-c', lifted: true}
        ])
      );
    });

    const result = await estimate('testuser');

    expect(result).toEqual({
      username: 'testuser',
      packageCount: 3,
      liftedPackageCount: 2,
      monthlyDollars: 100
    });
  });

  it('returns zero when no packages are lifted', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('registry.npmjs.org')) {
        return jsonResponse(npmSearchResult(['pkg-a']));
      }

      return jsonResponse(tideliftResult([{name: 'pkg-a', lifted: false}]));
    });

    const result = await estimate('testuser');

    expect(result).toEqual({
      username: 'testuser',
      packageCount: 1,
      liftedPackageCount: 0,
      monthlyDollars: 0
    });
  });

  it('returns zero when user has no packages', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return jsonResponse(npmSearchResult([]));
    });

    const result = await estimate('nobody');

    expect(result).toEqual({
      username: 'nobody',
      packageCount: 0,
      liftedPackageCount: 0,
      monthlyDollars: 0
    });
  });

  it('paginates npm registry results', async () => {
    let npmCallCount = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('registry.npmjs.org')) {
        npmCallCount++;
        if (npmCallCount === 1) {
          return jsonResponse(npmSearchResult(['pkg-a', 'pkg-b'], 3));
        }
        return jsonResponse(npmSearchResult(['pkg-c'], 3));
      }

      return jsonResponse(
        tideliftResult([
          {name: 'pkg-a', lifted: true},
          {name: 'pkg-b', lifted: true},
          {name: 'pkg-c', lifted: true}
        ])
      );
    });

    const result = await estimate('testuser');

    expect(npmCallCount).toBe(2);
    expect(result.packageCount).toBe(3);
    expect(result.liftedPackageCount).toBe(3);
    expect(result.monthlyDollars).toBe(150);
  });

  it('throws on npm registry error', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return errorResponse(500, 'Internal Server Error');
    });

    await expect(estimate('testuser')).rejects.toThrow(
      'npm registry request failed'
    );
  });

  it('throws on tidelift API error', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('registry.npmjs.org')) {
        return jsonResponse(npmSearchResult(['pkg-a']));
      }

      return errorResponse(403, 'Forbidden');
    });

    await expect(estimate('testuser')).rejects.toThrow(
      'Tidelift API request failed'
    );
  });
});
