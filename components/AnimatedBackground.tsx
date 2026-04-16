"use client";

import { useCallback } from "react";
import Particles from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { Engine } from "@tsparticles/engine";

export default function AnimatedBackground() {
  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine);
  }, []);

  return (
    <div className="fixed inset-0 z-0">
      {/* Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/10 to-transparent blur-3xl" />

      {/* Particles */}
      <Particles
        id="tsparticles"
        className="absolute inset-0"
        init={particlesInit}
        options={{
          background: { color: "transparent" },
          fpsLimit: 60,
          particles: {
            number: { value: 25 },
            size: { value: 2 },
            move: {
              enable: true,
              speed: 0.4,
            },
            opacity: { value: 0.3 },
          },
        }}
      />
    </div>
  );
}