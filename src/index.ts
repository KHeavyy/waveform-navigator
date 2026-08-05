export { default } from './WaveformNavigator';
export { WaveformNavigator } from './WaveformNavigator';
export type {
	WaveformNavigatorProps,
	WaveformNavigatorHandle,
	WaveformNavigatorStyles,
	Marker,
	MarkerHitTestArgs,
	MarkerRenderProps,
	RenderButtonsProps,
	LoudnessResult,
} from './WaveformNavigator';
export type {
	WaveformControlsProps,
	WaveformControlsStyles,
} from './components/WaveformControls';
export { WaveformControls } from './components/WaveformControls';
export {
	computeIntegratedLoudness,
	computeKWeightingCoefficients,
} from './utils/loudnessComputation';
