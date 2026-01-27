/**
 * Formats a time value in seconds to MM:SS format
 * @param t Time in seconds
 * @returns Formatted time string (e.g., "1:23", "12:45")
 */
export function formatTime(t: number): string {
	if (!t || !isFinite(t)) return '0:00';
	const s = Math.floor(t % 60)
		.toString()
		.padStart(2, '0');
	const m = Math.floor(t / 60);
	return `${m}:${s}`;
}
