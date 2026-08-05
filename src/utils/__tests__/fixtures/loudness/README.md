# Regenerating these fixtures
#
# From repo root (requires ffmpeg):
#
#   FIX=src/utils/__tests__/fixtures/loudness
#   SRC=demo/public/media/Demo.mp3
#   ffmpeg -y -i "$SRC" -t 8 -ar 44100 -ac 2 "$FIX/stereo_44100.wav"
#   ffmpeg -y -i "$SRC" -t 8 -ar 44100 -ac 1 "$FIX/mono_44100.wav"
#   ffmpeg -y -i "$SRC" -t 8 -ar 48000 -ac 2 "$FIX/stereo_48000.wav"
#   ffmpeg -y -i "$SRC" -t 8 -ar 48000 -ac 1 "$FIX/mono_48000.wav"
#   ffmpeg -y -i "$SRC" -t 8 -ar 44100 -ac 2 \
#     -af "acompressor=threshold=-20dB:ratio=8:attack=5:release=50,volume=6dB,alimiter=limit=0.95" \
#     "$FIX/limited_master.wav"
#   ffmpeg -y -i "$SRC" -t 8 -ar 44100 -ac 2 -af "volume=-12dB" "$FIX/quiet_mix.wav"
#
# Then update FFMPEG_INPUT_I in loudnessComputation.ffmpeg.test.ts from:
#   ffmpeg -i FILE -af loudnorm=print_format=json -f null -
