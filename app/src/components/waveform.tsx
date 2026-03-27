"use client";

import { motion } from "framer-motion";

const BARS = Array.from({ length: 32 }, (_, i) => ({
  key: i,
  peak: 6 + ((i * 7) % 18),
  duration: 0.7 + ((i % 6) * 0.1),
  delay: i * 0.04,
}));

export function Waveform({ animate = false }: { animate?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-[2px] h-8">
      {BARS.map((bar) => (
        <motion.div
          key={bar.key}
          className="w-[2.5px] rounded-full bg-primary/50"
          initial={{ height: 3 }}
          animate={animate ? { height: [3, bar.peak, 3] } : { height: 3 }}
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
    <div className="flex items-end gap-[1.5px] h-10 opacity-30">
      {Array.from({ length: 40 }, (_, i) => (
        <div
          key={i}
          className="w-[2px] rounded-full bg-primary/50"
          style={{ height: `${Math.max(2, 8 + Math.sin(i * 0.5) * 12 + Math.sin(i * 0.3) * 8 + ((i * 11) % 6))}px` }}
        />
      ))}
    </div>
  );
}
