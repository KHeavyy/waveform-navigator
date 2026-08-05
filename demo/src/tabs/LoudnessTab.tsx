import React, { useState } from 'react';
import WaveformNavigator from '../../../src';
import type { LoudnessResult } from '../../../src';

const DEMO_AUDIO_PATH = `${import.meta.env.BASE_URL}media/Demo.mp3`;

export default function LoudnessTab() {
	const [loudness, setLoudness] = useState<LoudnessResult | null>(null);
	const [savedLufs, setSavedLufs] = useState<number | null>(() => {
		const raw = localStorage.getItem('demo_loudness_lufs');
		return raw !== null ? Number(raw) : null;
	});
	const [usePrecomputed, setUsePrecomputed] = useState(false);
	const [remountKey, setRemountKey] = useState(0);

	const displayLufs =
		loudness?.integratedLufs ??
		(usePrecomputed && savedLufs !== null ? savedLufs : null);

	return (
		<div>
			<h2>Integrated Loudness (LUFS)</h2>
			<p style={{ color: '#6b7280', marginBottom: 24 }}>
				ITU-R BS.1770 integrated loudness is measured from the same decoded buffer
				used for peaks — no extra network request. Persist the result via{' '}
				<code>onLoudnessComputed</code> and skip recomputation with{' '}
				<code>precomputedLoudness</code>.
			</p>

			<div className="demo-section" style={{ backgroundColor: '#eff6ff' }}>
				<h3 style={{ marginTop: 0 }}>Measured loudness</h3>
				<p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
					Useful for A/B level matching: apply compensating gain from the LUFS delta
					so a rough mix and a master compare fairly.
				</p>

				<div style={{ marginBottom: 12, fontSize: 28, fontWeight: 600 }}>
					{displayLufs === null
						? '…'
						: !Number.isFinite(displayLufs)
							? '−∞ LUFS'
							: `${displayLufs.toFixed(2)} LUFS`}
				</div>

				{loudness && (
					<p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
						{loudness.sampleRate} Hz · {loudness.channels} channel
						{loudness.channels === 1 ? '' : 's'}
					</p>
				)}

				{savedLufs !== null && Number.isFinite(savedLufs) && (
					<label
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 8,
							fontSize: 13,
							marginBottom: 12,
						}}
					>
						<input
							type="checkbox"
							checked={usePrecomputed}
							onChange={(e) => {
								setUsePrecomputed(e.target.checked);
								setLoudness(null);
								setRemountKey((k) => k + 1);
							}}
						/>
						Use <code>precomputedLoudness</code> ({savedLufs.toFixed(2)} LUFS) — skips
						measurement
					</label>
				)}

				<p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
					Note: mono and dual-mono stereo of the same content measure ~3 LU apart
					(correct per BS.1770). When <code>precomputedPeaks</code> skips decode,
					loudness cannot be measured either — persist both together.
				</p>
			</div>

			<div style={{ marginTop: 24 }}>
				<WaveformNavigator
					key={remountKey}
					audio={DEMO_AUDIO_PATH}
					height={100}
					precomputedLoudness={
						usePrecomputed && savedLufs !== null ? savedLufs : undefined
					}
					onLoudnessComputed={(result) => {
						setLoudness(result);
						if (Number.isFinite(result.integratedLufs)) {
							setSavedLufs(result.integratedLufs);
							localStorage.setItem(
								'demo_loudness_lufs',
								String(result.integratedLufs)
							);
						}
					}}
					onPeaksComputed={() => {
						/* peaks still compute; loudness follows */
					}}
				/>
			</div>
		</div>
	);
}
