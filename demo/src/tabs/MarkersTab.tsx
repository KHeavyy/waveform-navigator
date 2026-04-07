import React, { useState } from 'react';
import WaveformNavigator from '../../../src';
import type { Marker, MarkerRenderProps } from '../../../src';

const DEMO_AUDIO_PATH = '/media/Demo.mp3';

const customMarkerMarkup = ({ ctx, x, height, index }: MarkerRenderProps) => {
	// Flag body
	ctx.fillStyle = '#ff6b6b';
	ctx.beginPath();
	ctx.moveTo(x, 10);
	ctx.lineTo(x + 15, 20);
	ctx.lineTo(x, 30);
	ctx.closePath();
	ctx.fill();

	// Pole
	ctx.fillStyle = '#d63031';
	ctx.fillRect(x - 1, 10, 2, height - 10);

	// Label
	ctx.fillStyle = '#ffffff';
	ctx.font = '11px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(`${index + 1}`, x + 7.5, 20);
};

export default function MarkersTab() {
	const [showMarkers, setShowMarkers] = useState(true);
	const [useCustomMarkers, setUseCustomMarkers] = useState(false);
	const [duration, setDuration] = useState(0);

	const markers: Marker[] =
		!showMarkers || duration === 0
			? []
			: [
					{ time: duration * 0.25 },
					{
						time: duration * 0.5,
						...(useCustomMarkers && { markup: customMarkerMarkup }),
					},
					{ time: duration * 0.75 },
				];

	return (
		<div>
			<h2>Markers</h2>
			<p style={{ color: '#6b7280', marginBottom: 24 }}>
				Pass an array of <code>Marker</code> objects to the <code>markers</code>{' '}
				prop to indicate chapters, cue points, or annotations. Each marker can
				optionally provide a custom <code>markup</code> function for bespoke
				rendering.
			</p>

			<div className="demo-section" style={{ backgroundColor: '#f9fafb' }}>
				<h3 style={{ marginTop: 0 }}>Options</h3>

				<label className="demo-checkbox">
					<input
						type="checkbox"
						checked={showMarkers}
						onChange={(e) => setShowMarkers(e.target.checked)}
					/>
					Show markers at 25%, 50%, and 75%
				</label>

				{showMarkers && (
					<label className="demo-checkbox" style={{ marginTop: 8 }}>
						<input
							type="checkbox"
							checked={useCustomMarkers}
							onChange={(e) => setUseCustomMarkers(e.target.checked)}
						/>
						Use custom flag-style rendering for the middle marker
					</label>
				)}

				{!showMarkers && (
					<p
						style={{ fontSize: 12, color: '#6b7280', marginTop: 8, marginBottom: 0 }}
					>
						Enable markers above to see them on the waveform.
					</p>
				)}
				{showMarkers && useCustomMarkers && (
					<p
						style={{ fontSize: 12, color: '#6b7280', marginTop: 8, marginBottom: 0 }}
					>
						The middle marker (M2) uses a custom red flag rendered via a{' '}
						<code>markup</code> function passed inside the marker object.
					</p>
				)}
			</div>

			{duration === 0 && (
				<p style={{ fontSize: 12, color: '#92400e', marginTop: 12 }}>
					⏳ Waiting for audio to load — markers will appear once the duration is
					known.
				</p>
			)}

			<div style={{ marginTop: 24 }}>
				<WaveformNavigator
					audio={DEMO_AUDIO_PATH}
					height={140}
					preload="metadata"
					markers={markers}
					onLoaded={(dur) => setDuration(dur)}
					onPeaksComputed={() => {
						(window as any).__waveformReady = true;
					}}
				/>
			</div>

			<div
				className="demo-section"
				style={{ marginTop: 24, backgroundColor: '#f0fdf4' }}
			>
				<h3 style={{ marginTop: 0 }}>Usage</h3>
				<pre
					style={{ margin: 0, fontSize: 13, overflowX: 'auto' }}
				>{`const markers = [
  { time: 30 },
  { time: 60, markup: ({ ctx, x, height }) => { /* custom canvas drawing */ } },
];

<WaveformNavigator
  audio="/audio.mp3"
  markers={markers}
/>`}</pre>
			</div>
		</div>
	);
}
