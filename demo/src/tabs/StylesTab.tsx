import React, { useState } from 'react';
import WaveformNavigator from '../../../src';
import type { WaveformNavigatorStyles } from '../../../src';

const DEMO_AUDIO_PATH = '/media/Demo.mp3';

const DEFAULT_STYLES: WaveformNavigatorStyles = {
	barColor: '#2b6ef6',
	progressColor: '#0747a6',
	backgroundColor: 'transparent',
	playheadColor: '#ff4d4f',
	playButtonColor: '#111827',
	playIconColor: '#fff',
	rewindButtonColor: '#fff',
	rewindIconColor: '#111827',
	forwardButtonColor: '#fff',
	forwardIconColor: '#111827',
	volumeSliderFillColor: '#111827',
	volumeIconColor: '#374151',
};

interface ColorFieldProps {
	label: string;
	value: string;
	onChange: (v: string) => void;
}

function ColorField({ label, value, onChange }: ColorFieldProps) {
	return (
		<div>
			<label
				style={{
					display: 'block',
					fontSize: 11,
					marginBottom: 4,
					color: '#6b7280',
				}}
			>
				{label}
			</label>
			<input
				type="color"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				style={{
					width: '100%',
					height: 32,
					cursor: 'pointer',
					border: '1px solid #e5e7eb',
					borderRadius: 4,
				}}
			/>
		</div>
	);
}

export default function StylesTab() {
	const [styles, setStyles] = useState<WaveformNavigatorStyles>(DEFAULT_STYLES);

	const set = (key: keyof WaveformNavigatorStyles) => (value: string) =>
		setStyles((prev) => ({ ...prev, [key]: value }));

	return (
		<div>
			<h2>Style Customisation</h2>
			<p style={{ color: '#6b7280', marginBottom: 24 }}>
				All colours are controlled via the <code>styles</code> prop. Use the pickers
				below to adjust each token live.
			</p>

			<div className="demo-section" style={{ backgroundColor: '#f9fafb' }}>
				<h3 style={{ marginTop: 0 }}>Waveform colours</h3>
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
						gap: 12,
					}}
				>
					<ColorField
						label="Bar"
						value={styles.barColor ?? '#2b6ef6'}
						onChange={set('barColor')}
					/>
					<ColorField
						label="Progress"
						value={styles.progressColor ?? '#0747a6'}
						onChange={set('progressColor')}
					/>
					<ColorField
						label="Background"
						value={
							styles.backgroundColor && styles.backgroundColor !== 'transparent'
								? styles.backgroundColor
								: '#ffffff'
						}
						onChange={set('backgroundColor')}
					/>
					<ColorField
						label="Playhead"
						value={styles.playheadColor ?? '#ff4d4f'}
						onChange={set('playheadColor')}
					/>
				</div>
			</div>

			<div
				className="demo-section"
				style={{ backgroundColor: '#f9fafb', marginTop: 16 }}
			>
				<h3 style={{ marginTop: 0 }}>Control button colours</h3>
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
						gap: 12,
					}}
				>
					<ColorField
						label="Play button"
						value={styles.playButtonColor ?? '#111827'}
						onChange={set('playButtonColor')}
					/>
					<ColorField
						label="Play icon"
						value={styles.playIconColor ?? '#fff'}
						onChange={set('playIconColor')}
					/>
					<ColorField
						label="Rewind button"
						value={styles.rewindButtonColor ?? '#fff'}
						onChange={set('rewindButtonColor')}
					/>
					<ColorField
						label="Rewind icon"
						value={styles.rewindIconColor ?? '#111827'}
						onChange={set('rewindIconColor')}
					/>
					<ColorField
						label="Forward button"
						value={styles.forwardButtonColor ?? '#fff'}
						onChange={set('forwardButtonColor')}
					/>
					<ColorField
						label="Forward icon"
						value={styles.forwardIconColor ?? '#111827'}
						onChange={set('forwardIconColor')}
					/>
				</div>
			</div>

			<div
				className="demo-section"
				style={{ backgroundColor: '#f9fafb', marginTop: 16 }}
			>
				<h3 style={{ marginTop: 0 }}>Volume colours</h3>
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
						gap: 12,
					}}
				>
					<ColorField
						label="Slider fill"
						value={styles.volumeSliderFillColor ?? '#111827'}
						onChange={set('volumeSliderFillColor')}
					/>
					<ColorField
						label="Volume icon"
						value={styles.volumeIconColor ?? '#374151'}
						onChange={set('volumeIconColor')}
					/>
				</div>
			</div>

			<p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
				💡 The volume icon changes dynamically based on volume level. Click the icon
				to toggle mute/unmute.
			</p>

			<div style={{ marginTop: 24 }}>
				<WaveformNavigator
					audio={DEMO_AUDIO_PATH}
					height={140}
					styles={styles}
					onPeaksComputed={() => {
						(window as any).__waveformReady = true;
					}}
				/>
			</div>
		</div>
	);
}
