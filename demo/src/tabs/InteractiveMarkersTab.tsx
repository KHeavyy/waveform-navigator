import React, { useState } from 'react';
import WaveformNavigator from '../../../src';
import type { Marker, MarkerRenderProps } from '../../../src';

const DEMO_AUDIO_PATH = `${import.meta.env.BASE_URL}media/Demo.mp3`;

const commentMarkerMarkup = ({
	ctx,
	x,
	height,
	hovered,
}: MarkerRenderProps) => {
	const radius = hovered ? 10 : 8;
	ctx.fillStyle = hovered ? '#1d4ed8' : '#2b6ef6';
	ctx.beginPath();
	ctx.arc(x, 16, radius, 0, Math.PI * 2);
	ctx.fill();

	// Tail pointing down toward the waveform
	ctx.beginPath();
	ctx.moveTo(x - 4, 22);
	ctx.lineTo(x + 4, 22);
	ctx.lineTo(x, 28);
	ctx.closePath();
	ctx.fill();

	ctx.fillStyle = hovered ? '#1d4ed8' : '#93c5fd';
	ctx.fillRect(x - 1, 28, 2, height - 28);
};

/** Hit the bubble near the top, or a narrow column down the stem. */
const commentHitTest: NonNullable<Marker['hitTest']> = ({
	x,
	y,
	markerX,
}) => {
	const dx = x - markerX;
	const dy = y - 16;
	return Math.sqrt(dx * dx + dy * dy) <= 14 || Math.abs(dx) <= 6;
};

type EventLog = { label: string; detail: string };

export default function InteractiveMarkersTab() {
	const [duration, setDuration] = useState(0);
	const [defaultLog, setDefaultLog] = useState<EventLog | null>(null);
	const [defaultHover, setDefaultHover] = useState<string | null>(null);
	const [customLog, setCustomLog] = useState<EventLog | null>(null);
	const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null);
	const [selectedCommentId, setSelectedCommentId] = useState<string | null>(
		null
	);

	const defaultMarkers: Marker[] =
		duration === 0
			? []
			: [
					{ time: duration * 0.2, id: 'default-1' },
					{ time: duration * 0.5, id: 'default-2' },
					{ time: duration * 0.8, id: 'default-3' },
				];

	const customMarkers: Marker[] =
		duration === 0
			? []
			: [
					{
						time: duration * 0.25,
						id: 'comment-1',
						markup: commentMarkerMarkup,
						hitTest: commentHitTest,
					},
					{
						time: duration * 0.55,
						id: 'comment-2',
						markup: commentMarkerMarkup,
						hitTest: commentHitTest,
					},
					{
						time: duration * 0.75,
						id: 'comment-3',
						markup: commentMarkerMarkup,
						hitTest: commentHitTest,
					},
				];

	const comments: Record<string, string> = {
		'comment-1': 'Intro — nice opening motif',
		'comment-2': 'Chorus hits here',
		'comment-3': 'Bridge / breakdown',
	};

	return (
		<div>
			<h2>Interactive Markers</h2>
			<p style={{ color: '#6b7280', marginBottom: 24 }}>
				Supply <code>onMarkerClick</code> and/or <code>onMarkerHover</code> to
				make markers individually clickable and hoverable. Without those
				callbacks, markers stay decorative and clicks always seek. Below: default
				hit-testing &amp; rendering, then custom markup + <code>hitTest</code>.
			</p>

			{duration === 0 && (
				<p style={{ fontSize: 12, color: '#92400e', marginBottom: 12 }}>
					⏳ Waiting for audio to load — markers appear once duration is known.
				</p>
			)}

			{/* Default interactive */}
			<div className="demo-section" style={{ backgroundColor: '#f0f9ff' }}>
				<h3 style={{ marginTop: 0 }}>Default behaviour</h3>
				<p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
					Built-in M1 / M2 / M3 markers with the default label-badge hit region (
					<code>markerHitRadius</code> padding). Only the label is interactive — the
					stem below stays free for seeking. Click a marker to fire{' '}
					<code>onMarkerClick</code> (seek is suppressed); hover to see{' '}
					<code>onMarkerHover</code>. Click elsewhere on the waveform to seek as
					usual.
				</p>

				<div
					style={{
						fontSize: 13,
						marginBottom: 12,
						minHeight: 40,
						color: '#1e3a5f',
					}}
				>
					<div>
						<strong>Hover:</strong>{' '}
						{defaultHover ?? (
							<span style={{ color: '#6b7280' }}>none</span>
						)}
					</div>
					<div>
						<strong>Last click:</strong>{' '}
						{defaultLog ? (
							<>
								{defaultLog.label}{' '}
								<span style={{ color: '#6b7280' }}>({defaultLog.detail})</span>
							</>
						) : (
							<span style={{ color: '#6b7280' }}>none yet</span>
						)}
					</div>
				</div>

				<WaveformNavigator
					audio={DEMO_AUDIO_PATH}
					height={120}
					preload="metadata"
					markers={defaultMarkers}
					onLoaded={(dur) => setDuration(dur)}
					onMarkerClick={(marker, index) => {
						setDefaultLog({
							label: marker.id ?? `M${index + 1}`,
							detail: `${marker.time.toFixed(1)}s · index ${index}`,
						});
					}}
					onMarkerHover={(marker, index) => {
						setDefaultHover(
							marker
								? `${marker.id ?? `M${(index ?? 0) + 1}`} @ ${marker.time.toFixed(1)}s`
								: null
						);
					}}
					onPeaksComputed={() => {
						(window as any).__waveformReady = true;
					}}
				/>
			</div>

			{/* Custom interactive */}
			<div
				className="demo-section"
				style={{ backgroundColor: '#eef2ff', marginTop: 16 }}
			>
				<h3 style={{ marginTop: 0 }}>Custom behaviour</h3>
				<p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
					Comment-style markers with custom <code>markup</code> (uses the{' '}
					<code>hovered</code> flag), per-marker <code>hitTest</code>, and click
					handlers that select a comment instead of seeking.
				</p>

				<div
					style={{
						fontSize: 13,
						marginBottom: 12,
						minHeight: 56,
						color: '#312e81',
					}}
				>
					<div>
						<strong>Hover:</strong>{' '}
						{hoveredCommentId ? (
							comments[hoveredCommentId]
						) : (
							<span style={{ color: '#6b7280' }}>none</span>
						)}
					</div>
					<div>
						<strong>Selected:</strong>{' '}
						{selectedCommentId ? (
							comments[selectedCommentId]
						) : (
							<span style={{ color: '#6b7280' }}>none yet — click a bubble</span>
						)}
					</div>
					{customLog && (
						<div style={{ color: '#6b7280', marginTop: 4 }}>
							Last event: {customLog.label} ({customLog.detail})
						</div>
					)}
				</div>

				<WaveformNavigator
					audio={DEMO_AUDIO_PATH}
					height={120}
					preload="metadata"
					markers={customMarkers}
					onLoaded={(dur) => setDuration(dur)}
					onMarkerClick={(marker, index) => {
						setSelectedCommentId(marker.id ?? null);
						setCustomLog({
							label: marker.id ?? `marker-${index}`,
							detail: `${marker.time.toFixed(1)}s`,
						});
					}}
					onMarkerHover={(marker) => {
						setHoveredCommentId(marker?.id ?? null);
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
				>{`// Default interactive markers
<WaveformNavigator
  audio="/audio.mp3"
  markers={[{ time: 12 }, { time: 48 }]}
  onMarkerClick={(marker, index) => console.log(marker, index)}
  onMarkerHover={(marker) => setHovered(marker)}
/>

// Custom markup + hitTest + hovered highlight
const commentMarker = ({ ctx, x, height, hovered }: MarkerRenderProps) => {
  ctx.fillStyle = hovered ? '#1d4ed8' : '#2b6ef6';
  ctx.beginPath();
  ctx.arc(x, 16, hovered ? 10 : 8, 0, Math.PI * 2);
  ctx.fill();
};

<WaveformNavigator
  audio="/audio.mp3"
  markers={comments.map((c) => ({
    time: c.time,
    id: c.id,
    markup: commentMarker,
    hitTest: ({ x, y, markerX }) => /* custom region */,
  }))}
  onMarkerClick={(marker) => openComment(marker.id)}
  onMarkerHover={(marker) => setHoveredId(marker?.id ?? null)}
/>`}</pre>
			</div>
		</div>
	);
}
