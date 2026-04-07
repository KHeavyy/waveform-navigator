import React, { useState } from 'react';
import WaveformNavigator from '../../../src';

const DEMO_AUDIO_PATH = '/media/Demo.mp3';

export default function ResponsiveTab() {
	const [responsiveEnabled, setResponsiveEnabled] = useState(true);
	const [containerWidth, setContainerWidth] = useState(900);

	return (
		<div>
			<h2>Responsive Layout</h2>
			<p style={{ color: '#6b7280', marginBottom: 24 }}>
				The <code>responsive</code> prop (default: <code>true</code>) makes the
				waveform fill its container automatically using a{' '}
				<code>ResizeObserver</code>. Disable it to supply a fixed <code>width</code>{' '}
				instead.
			</p>

			<div className="demo-section" style={{ backgroundColor: '#e8f8e8' }}>
				<h3 style={{ marginTop: 0 }}>Controls</h3>

				<label className="demo-checkbox">
					<input
						type="checkbox"
						checked={responsiveEnabled}
						onChange={(e) => setResponsiveEnabled(e.target.checked)}
					/>
					Enable responsive mode
				</label>

				<div style={{ marginTop: 16 }}>
					<label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
						Container width: <strong>{containerWidth}px</strong>
					</label>
					<input
						type="range"
						min={240}
						max={1200}
						value={containerWidth}
						onChange={(e) => setContainerWidth(Number(e.target.value))}
						style={{ width: '100%', maxWidth: 400 }}
					/>
				</div>

				<p
					style={{ fontSize: 12, color: '#6b7280', marginTop: 12, marginBottom: 0 }}
				>
					{responsiveEnabled
						? '✅ Waveform fills container — drag the slider to see it reflow'
						: `⚠️ Fixed width: ${containerWidth}px (responsive=false + width prop)`}
				</p>
			</div>

			<div
				style={{
					marginTop: 24,
					width: containerWidth,
					maxWidth: '100%',
					transition: 'width 0.2s',
					overflow: 'hidden',
				}}
			>
				<WaveformNavigator
					audio={DEMO_AUDIO_PATH}
					height={140}
					responsive={responsiveEnabled}
					width={responsiveEnabled ? undefined : containerWidth}
					onPeaksComputed={() => {
						(window as any).__waveformReady = true;
					}}
				/>
			</div>
		</div>
	);
}
