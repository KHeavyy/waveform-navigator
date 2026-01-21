/**
 * Generate a simple test audio file for testing
 * Creates a 1-second tone at 440Hz (A4 note)
 */
const fs = require('fs');
const path = require('path');

// Simple WAV file generation
function generateWavFile(filename, duration = 1, sampleRate = 44100) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const frequency = 440; // A4 note
  
  const numSamples = sampleRate * duration;
  const dataSize = numSamples * numChannels * bitsPerSample / 8;
  const fileSize = 44 + dataSize;
  
  const buffer = Buffer.alloc(fileSize);
  let offset = 0;
  
  // WAV Header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(fileSize - 8, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;
  
  // fmt chunk
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4; // Chunk size
  buffer.writeUInt16LE(1, offset); offset += 2;  // Audio format (1 = PCM)
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, offset); offset += 4; // Byte rate
  buffer.writeUInt16LE(numChannels * bitsPerSample / 8, offset); offset += 2; // Block align
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
  
  // data chunk
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;
  
  // Generate sine wave samples
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const value = Math.sin(2 * Math.PI * frequency * t);
    const sample = Math.floor(value * 32767); // Convert to 16-bit int
    buffer.writeInt16LE(sample, offset);
    offset += 2;
  }
  
  fs.writeFileSync(filename, buffer);
  console.log(`Generated test audio file: ${filename}`);
}

// Generate test audio file
const outputPath = path.join(__dirname, 'test-audio.wav');
generateWavFile(outputPath, 2); // 2 seconds
