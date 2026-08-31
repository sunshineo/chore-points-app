import Image from "next/image";

export type Celebration = {
  emoji: string;
  imageSrc?: string;
  value: number;
};

export type CelebrationOverlayProps = { celebration: Celebration | null };

function RainParticle({
  emoji,
  imageSrc,
  index,
}: {
  emoji: string;
  imageSrc?: string;
  index: number;
}) {
  const left = (index * 37 + 11) % 100;
  const delay = ((index * 17) % 80) / 100;
  const duration = 1.5 + ((index * 29) % 100) / 100;
  const size = 20 + ((index * 31) % 20);

  return (
    <span
      className="absolute pointer-events-none app-gem-rain"
      style={{
        left: `${left}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
        fontSize: `${size}px`,
        top: "-40px",
      }}
    >
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt=""
          width={size}
          height={size}
          unoptimized
          className="object-contain"
        />
      ) : emoji}
    </span>
  );
}

export function CelebrationOverlay({ celebration }: CelebrationOverlayProps) {
  if (!celebration) return null;

  return (
    <>
      <style>{`
        @keyframes app-gem-rain-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(500px) rotate(360deg); opacity: 0; }
        }
        @keyframes app-emoji-bounce {
          0%, 100% { transform: scale(1) translateY(0); }
          50% { transform: scale(1.08) translateY(-12px); }
        }
        @keyframes app-celebration-fade {
          0% { transform: translate(-50%, -50%) scale(0.85); opacity: 0; }
          10% { opacity: 1; }
          78% { transform: translate(-50%, -52%) scale(1.05); opacity: 1; }
          100% { transform: translate(-50%, -58%) scale(1.1); opacity: 0; }
        }
        .app-gem-rain { animation: app-gem-rain-fall 2s ease-in forwards; }
        .app-emoji-bounce { animation: app-emoji-bounce 0.7s ease-in-out; }
        .app-celebration-fade { animation: app-celebration-fade 1.8s ease-out forwards; }
      `}</style>
      <div
        className="fixed inset-0 z-30 pointer-events-none"
        style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(8px)" }}
      >
        <div className="relative h-full w-full overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            {Array.from({ length: 16 }).map((_, i) => (
              <RainParticle
                key={i}
                emoji={celebration.emoji}
                imageSrc={celebration.imageSrc}
                index={i}
              />
            ))}
          </div>
          <div className="app-celebration-fade absolute left-1/2 top-1/2 text-center">
            <div className="app-emoji-bounce" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.25)" }}>
              <span
                className={`text-8xl font-black ${celebration.value >= 0 ? "text-emerald-500" : "text-rose-500"}`}
              >
                {celebration.value > 0 ? "+" : ""}
                {celebration.value}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
