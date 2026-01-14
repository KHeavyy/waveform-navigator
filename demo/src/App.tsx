import React, { useRef, useState } from 'react'
import WaveformNavigator from '../../src'

export default function App() {
	const [file, setFile] = useState<File | null>(null)
	const inputRef = useRef<HTMLInputElement | null>(null)

	return (
		<div style={{ padding: 24 }}>
			<h1>waveform-navigator demo</h1>
			<div style={{ marginBottom: 12 }}>
				<input ref={inputRef} type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
			</div>
			<div style={{ width: 900 }}>
				<WaveformNavigator audio={file} width={900} height={140} />
			</div>
		</div>
	)
}
