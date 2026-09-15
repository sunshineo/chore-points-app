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
    const frequencies = kind === "task" ? [523.25, 783.99] : [783.99, 523.25];
    frequencies.forEach((frequency, index) => {
      const start = audio.currentTime + index * 0.14;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.1, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + 0.2);
    });
  } catch {
    // Keep the successful action and animation even if playback fails.
  }
}
