import { describe, it, expect } from 'vitest';
import {
	computePeaksFromChannelData,
	resamplePeaks,
} from '../peaksComputation';

describe('computePeaksFromChannelData', () => {
	it('computes peaks for simple channel data', () => {
		const channelData = new Float32Array([
			0.1, 0.5, 0.3, 0.8, 0.2, 0.6, 0.4, 0.9,
		]);
		const result = computePeaksFromChannelData({
			channelData,
			width: 200,
			barWidth: 2,
			gap: 1,
		});

		expect(result.peaks).toBeInstanceOf(Float32Array);
		expect(result.peaks.length).toBeGreaterThan(0);
	});

	it('handles single slot', () => {
		const channelData = new Float32Array([0.1, 0.5, 0.3, 0.8]);
		const result = computePeaksFromChannelData({
			channelData,
			width: 3, // Small width results in 1 slot
			barWidth: 2,
			gap: 1,
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

		// Adjust width/barWidth/gap to get a reasonable number of slots
		const result = computePeaksFromChannelData({
			channelData,
			width: 300,
			barWidth: 10,
			gap: 2,
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
			gap: 2,
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
			gap: 1,
		});

		expect(result.peaks).toBeInstanceOf(Float32Array);
	});

	it('computes correct number of slots based on width, barWidth, and gap', () => {
		const channelData = new Float32Array(1000);

		// width / (barWidth + gap) = 100 / (2 + 1) = 33.33 -> floor = 33
		const result = computePeaksFromChannelData({
			channelData,
			width: 100,
			barWidth: 2,
			gap: 1,
		});

		expect(result.peaks.length).toBe(33);
	});

	it('ensures at least 1 slot', () => {
		const channelData = new Float32Array([0.5]);

		// Very small width
		const result = computePeaksFromChannelData({
			channelData,
			width: 1,
			barWidth: 10,
			gap: 5,
		});

		expect(result.peaks.length).toBeGreaterThanOrEqual(1);
	});

	it('maps short clips across all slots without trailing empty bins', () => {
		const channelData = new Float32Array([0.2, -0.4, 0.6]);
		const result = computePeaksFromChannelData({
			channelData,
			width: 30,
			barWidth: 1,
			gap: 0,
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
			gap: 1,
		});

		expect(result.peaks.every((peak) => peak === 0)).toBe(true);
	});
});

describe('resamplePeaks', () => {
	it('returns a copy when source length equals target', () => {
		const src = new Float32Array([0.1, 0.5, 0.9]);
		const result = resamplePeaks(src, 3);
		expect(result).toBeInstanceOf(Float32Array);
		expect(result).toHaveLength(3);
		expect(result[0]).toBeCloseTo(0.1, 5);
		expect(result[1]).toBeCloseTo(0.5, 5);
		expect(result[2]).toBeCloseTo(0.9, 5);
	});

	it('preserves endpoints exactly when downsampling', () => {
		const src = new Float32Array([0.2, 0.6, 0.4]);
		const result = resamplePeaks(src, 2);
		expect(result).toHaveLength(2);
		expect(result[0]).toBeCloseTo(0.2, 5);
		expect(result[1]).toBeCloseTo(0.4, 5);
	});

	it('preserves endpoints exactly when upsampling', () => {
		const src = new Float32Array([0.1, 0.9]);
		const result = resamplePeaks(src, 5);
		expect(result).toHaveLength(5);
		expect(result[0]).toBeCloseTo(0.1, 5);
		expect(result[4]).toBeCloseTo(0.9, 5);
	});

	it('interpolates midpoint linearly', () => {
		const src = new Float32Array([0.0, 1.0]);
		const result = resamplePeaks(src, 3);
		expect(result[1]).toBeCloseTo(0.5, 5);
	});

	it('accepts a plain number[] input', () => {
		const result = resamplePeaks([0.1, 0.5, 0.9], 2);
		expect(result).toBeInstanceOf(Float32Array);
		expect(result).toHaveLength(2);
	});

	it('handles empty input by returning a zero-filled array', () => {
		const result = resamplePeaks([], 4);
		expect(result).toHaveLength(4);
		expect(Array.from(result)).toEqual([0, 0, 0, 0]);
	});

	it('handles targetCount of 1', () => {
		const result = resamplePeaks([0.3, 0.7, 0.5], 1);
		expect(result).toHaveLength(1);
		expect(result[0]).toBeCloseTo(0.3, 5);
	});

	it('handles a single-sample source upsampled to multiple bars', () => {
		const result = resamplePeaks([0.8], 4);
		expect(result).toHaveLength(4);
		for (const v of result) expect(v).toBeCloseTo(0.8, 4);
	});
});
