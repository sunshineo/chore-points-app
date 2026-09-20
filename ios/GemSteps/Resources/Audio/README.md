# Point feedback sounds

Native playback uses AVAudioPlayer with the ambient session (respects silent mode).
The former Web-generated ascending.wav and descending.wav have been removed.

Source: Kenney, **Interface Sounds 1.0**, released 2020.
https://kenney.nl/assets/interface-sounds
License: CC0; the original notice is in LICENSE-Kenney.txt.
Downloaded from the creator on 2026-09-20:
https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip

- points-earned.wav: Audio/confirmation_002.ogg, positive task/manual adjustment feedback.
- reward-complete.wav: Audio/confirmation_004.ogg, successful redemption/manual deduction feedback.

Converted to signed 16-bit PCM WAV with ffmpeg; no synthesis, pitch change, or added notes.
These are confirmation cues, not an error sound for spending points.
Undo remains silent. Sound starts when the full-screen celebration appears, after
any adjustment sheet has dismissed. Playback failure never changes a saved action.
Physical iPhone/iPad listening, silent switch and Bluetooth routing require device verification.
