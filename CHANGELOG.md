# Changelog

## 0.6.0

### Added

- **ITU-R BS.1770 integrated loudness (LUFS)** measurement from the already-decoded
  audio buffer used for peaks — no extra fetch or `decodeAudioData` call.
- New props: `onLoudnessComputed` / `precomputedLoudness`, mirroring the peaks
  persistence contract.
- Exported `LoudnessResult` type and pure helpers `computeIntegratedLoudness` /
  `computeKWeightingCoefficients`.
- Demo tab exercising loudness measurement and precomputed skip.

### Notes

- Hosts that omit `onLoudnessComputed` do zero additional work.
- `integratedLufs` is `-Infinity` for silence / sub-400 ms / no gated blocks (never `NaN`).
- Mono vs dual-mono stereo of the same content measures ~3 LU apart (correct per BS.1770).
- When `precomputedPeaks` skips decode, loudness cannot be measured either — persist both.
