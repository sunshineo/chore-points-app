# Point sounds

The two mono PCM WAV files reproduce `web/src/app/points/pointSounds.ts`:
44,100 Hz, signed 16-bit; sine frequencies 392, 440, 523.25, 587.33,
659.25, 783.99 Hz, reversed for deductions. Notes start every 0.25 seconds;
first five last 0.24 seconds, last lasts 0.45 seconds (total 1.7 seconds).
Gain ramps linearly from 0 to 0.1 during the first 0.01 seconds, exponentially
to 0.001 at duration minus 0.02 seconds, then holds until the note ends.
Samples are rounded after multiplying by 32767. No normalization or effects.

`AVAudioPlayer` uses the ambient audio session. Playback failure never changes
an already-saved action. Undo does not play audio. Device listening, silent
switch, Bluetooth and interruption checks remain unverified without iOS hardware.
