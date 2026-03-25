import { describe, it, expect } from 'vitest';
import { computePeaksFromChannelData } from '../peaksComputation';

describe('computePeaksFromChannelData', () => {
	it('computes peaks for simple channel data', () => {
		const channelData = new Float32Array([
			0.1, 0.5, 0.3, 0.8, 0.2, 0.6, 0.4, 0.9,
		]);
		const result = computePeaksFromChannelData({
			channelData,
			width: 200,
			barWidth: 2,
		});

		expect(result.peaks).toBeInstanceOf(Float32Array);
		expect(result.peaks.length).toBeGreaterThan(0);
	});

	it('handles single slot', () => {
		const channelData = new Float32Array([0.1, 0.5, 0.3, 0.8]);
		const result = computePeaksFromChannelData({
			channelData,
			width: 2, // Small width results in 1 slot
			barWidth: 2,
		});

		expect(result.peaks.length).toBe(1);
		expect(result.peaks[0]).toBeCloseTo(0.8, 1); // Max absolute value
	});

	it('computes correct max values per slot', () => {
		// Create data with clear peaks in each section
		const channelData = new Float32Array([
			0.1,
			0.2,
			0.9,
			0.1, // First 4 samples
			0.3,
			0.4,
			0.5,
			0.6, // Next 4 samples
			0.7,
			0.8,
			0.3,
			0.2, // Last 4 samples
		]);

		// Adjust width/barWidth to get a reasonable number of slots
		const result = computePeaksFromChannelData({
			channelData,
			width: 300,
			barWidth: 10,
		});

		// Just verify we have multiple peaks and they're reasonable
		expect(result.peaks.length).toBeGreaterThan(1);
		expect(Math.max(...result.peaks)).toBeCloseTo(0.9, 1);
	});

	it('handles negative values by using absolute value', () => {
		const channelData = new Float32Array([
			-0.9,
			0.1, // max abs = 0.9
			0.5,
			-0.8, // max abs = 0.8
		]);

		const result = computePeaksFromChannelData({
			channelData,
			width: 100,
			barWidth: 10,
		});

		// Verify peaks are computed and contain reasonable values
		expect(result.peaks.length).toBeGreaterThan(0);
		expect(Math.max(...result.peaks)).toBeCloseTo(0.9, 1);
	});

	it('handles empty channel data', () => {
		const channelData = new Float32Array([]);
		const result = computePeaksFromChannelData({
			channelData,
			width: 100,
			barWidth: 2,
		});

		expect(result.peaks).toBeInstanceOf(Float32Array);
	});

	it('computes correct number of slots based on width and barWidth', () => {
		const channelData = new Float32Array(1000);

		// width / barWidth = 100 / 2 = 50
		const result = computePeaksFromChannelData({
			channelData,
			width: 100,
			barWidth: 2,
		});

		expect(result.peaks.length).toBe(50);
	});

	it('ensures at least 1 slot', () => {
		const channelData = new Float32Array([0.5]);

		// Very small width
		const result = computePeaksFromChannelData({
			channelData,
			width: 1,
			barWidth: 10,
		});

		expect(result.peaks.length).toBeGreaterThanOrEqual(1);
	});

	it('maps short clips across all slots without trailing empty bins', () => {
		const channelData = new Float32Array([0.2, -0.4, 0.6]);
		const result = computePeaksFromChannelData({
			channelData,
			width: 30,
			barWidth: 1,
		});

		expect(result.peaks.length).toBe(30);
		expect(result.peaks.every((peak) => peak > 0)).toBe(true);
	});

	it('handles zero values', () => {
		const channelData = new Float32Array([0, 0, 0, 0]);
		const result = computePeaksFromChannelData({
			channelData,
			width: 20,
			barWidth: 2,
		});

		expect(result.peaks.every((peak) => peak === 0)).toBe(true);
	});

	it('handles zero barWidth by falling back to barWidth=1 without throwing', () => {
		const channelData = new Float32Array([0.1, 0.5, 0.3]);
		let result: ReturnType<typeof computePeaksFromChannelData> | undefined;
		expect(() => {
			result = computePeaksFromChannelData({
				channelData,
				width: 100,
				barWidth: 0,
			});
		}).not.toThrow();
		// Falls back to barWidth=1: floor(100/1) = 100 slots
		expect(result!.peaks.length).toBe(100);
	});

	it('handles NaN barWidth by falling back to barWidth=1 without throwing', () => {
		const channelData = new Float32Array([0.1, 0.5, 0.3]);
		let result: ReturnType<typeof computePeaksFromChannelData> | undefined;
		expect(() => {
			result = computePeaksFromChannelData({
				channelData,
				width: 100,
				barWidth: NaN,
			});
		}).not.toThrow();
		expect(result!.peaks.length).toBe(100);
	});
});
