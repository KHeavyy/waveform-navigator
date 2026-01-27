/**
 * Formats a time value in seconds to MM:SS format
 * @param t Time in seconds
 * @returns Formatted time string (e.g., "1:23", "12:45")
 */
export function formatTime(time: number): string {
	if (!time || !isFinite(time)) return '0:00';
	const s = Math.floor(time % 60)
		.toString()
		.padStart(2, '0');
	const m = Math.floor(time / 60);
	return `${m}:${s}`;
}
