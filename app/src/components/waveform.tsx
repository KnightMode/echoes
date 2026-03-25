"use client";

import { motion } from "framer-motion";

const WAVE_BARS = Array.from({ length: 24 }, (_, i) => ({
  key: i,
  peakHeight: 10 + ((i * 7) % 15),
  duration: 0.85 + ((i % 5) * 0.08),
  delay: i * 0.05,
}));

const STATIC_BARS = Array.from({ length: 40 }, (_, i) => ({
  key: i,
  height: Math.max(
    2,
    8 + Math.sin(i * 0.5) * 12 + Math.sin(i * 0.3) * 8 + ((i * 11) % 6)
  ),
}));

export function Waveform({ animate = false }: { animate?: boolean }) {
  return (
    <div className="flex items-center gap-[2px] h-8">
      {WAVE_BARS.map((bar) => (
        <motion.div
          key={bar.key}
          className="w-[2px] rounded-full bg-primary/60"
          initial={{ height: 4 }}
          animate={
            animate
              ? {
                  height: [4, bar.peakHeight, 4],
                }
              : { height: 4 }
          }
          transition={{
            duration: bar.duration,
            repeat: animate ? Infinity : 0,
            ease: "easeInOut",
            delay: bar.delay,
          }}
        />
      ))}
    </div>
  );
}

export function WaveformStatic() {
  return (
    <div className="flex items-end gap-[1.5px] h-10 opacity-40">
      {STATIC_BARS.map((bar) => (
        <div
          key={bar.key}
          className="w-[2px] rounded-full bg-primary/50"
          style={{ height: `${bar.height}px` }}
        />
      ))}
    </div>
  );
}
