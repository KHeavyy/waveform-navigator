export { formatTime } from './formatTime';
export { syncCanvasSize } from './syncCanvasSize';
export { computePeaksFromChannelData, resamplePeaks } from './peaksComputation';
export type {
	PeaksComputationParams,
	PeaksComputationResult,
} from './peaksComputation';
export { createPeaksWorker } from './workerCreation';
export type { WorkerCreationOptions } from './workerCreation';
