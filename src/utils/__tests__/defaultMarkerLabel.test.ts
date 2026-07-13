import { describe, expect, it } from 'vitest';
import {
	DEFAULT_MARKER_LABEL_HEIGHT,
	DEFAULT_MARKER_LABEL_Y,
	getDefaultMarkerLabelRect,
	hitTestDefaultMarkerLabel,
} from '../defaultMarkerLabel';

describe('defaultMarkerLabel', () => {
	it('centers the label on markerX and clamps to the canvas', () => {
		const mid = getDefaultMarkerLabelRect(100, 0, 200);
		expect(mid.y).toBe(DEFAULT_MARKER_LABEL_Y);
		expect(mid.height).toBe(DEFAULT_MARKER_LABEL_HEIGHT);
		expect(mid.x).toBeCloseTo(100 - mid.width / 2);

		const left = getDefaultMarkerLabelRect(2, 0, 200);
		expect(left.x).toBe(0);

		const right = getDefaultMarkerLabelRect(198, 0, 200);
		expect(right.x + right.width).toBe(200);
	});

	it('hits only the label badge, not the stem below', () => {
		const args = {
			markerX: 100,
			index: 0,
			canvasWidth: 200,
			hitPadding: 0,
		};

		expect(
			hitTestDefaultMarkerLabel({ ...args, x: 100, y: 18 })
		).toBe(true);
		expect(
			hitTestDefaultMarkerLabel({ ...args, x: 100, y: 40 })
		).toBe(false);
		expect(
			hitTestDefaultMarkerLabel({ ...args, x: 10, y: 18 })
		).toBe(false);
	});

	it('expands the hit region by hitPadding', () => {
		const rect = getDefaultMarkerLabelRect(100, 0, 200);
		expect(
			hitTestDefaultMarkerLabel({
				x: rect.x - 2,
				y: rect.y - 2,
				markerX: 100,
				index: 0,
				canvasWidth: 200,
				hitPadding: 2,
			})
		).toBe(true);
	});
});
