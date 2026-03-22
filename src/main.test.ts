import {n} from './main.js';
import {describe, it, expect} from 'vitest';

describe('main', () => {
  it('exports correct names', () => {
    expect(n).toBe(303);
  });
});
