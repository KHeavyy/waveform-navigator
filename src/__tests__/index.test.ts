import * as pkg from '../index';
import { vi, describe, expect, it } from 'vitest';

describe('package entry', () => {
	it('exports default and named exports', () => {
		expect(pkg).toBeDefined();
		// default should be the WaveformNavigator component or proxy
		expect(pkg.default).toBeDefined();
		expect(pkg.WaveformNavigator).toBeDefined();
	});
});
