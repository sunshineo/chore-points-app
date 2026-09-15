let context: AudioContext | undefined;

// Call during the tap, before saving asynchronously, to unlock browser audio.
export function preparePointSound(): void {
  try {
    if (!context || context.state === "closed") context = new AudioContext();
    if (context.state !== "running") void context.resume().catch(() => {});
  } catch {
    // Audio is optional; unavailable audio must not interrupt point changes.
  }
}

export function playPointSound(kind: "task" | "reward"): void {
  if (!context || context.state !== "running") return;
  try {
    const audio = context;
    const ascendingNotes = [392, 440, 523.25, 587.33, 659.25, 783.99];
    const frequencies = kind === "task" ? ascendingNotes : ascendingNotes.reverse();
    const startedAt = audio.currentTime;
    frequencies.forEach((frequency, index) => {
      const start = startedAt + index * 0.25;
      // Five quarter-second steps and a longer final note total 1.7 seconds.
      const duration = index === frequencies.length - 1 ? 0.45 : 0.24;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.1, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration - 0.02);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + duration);
    });
  } catch {
    // Keep the successful action and animation even if playback fails.
  }
}
