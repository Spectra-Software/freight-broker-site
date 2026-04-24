"use client";

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 bg-[#05060A]">
      {/* subtle gradient depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#070A14] via-[#05060A] to-black" />

      {/* noise overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')",
        }}
      />

      {/* grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      {/* soft glow accents - indigo/cyan */}
      <div className="absolute top-[-200px] left-[-200px] h-[600px] w-[600px] rounded-full bg-indigo-500/10 blur-[140px] animate-blob1" />
      <div className="absolute bottom-[-200px] right-[-200px] h-[600px] w-[600px] rounded-full bg-cyan-500/10 blur-[140px] animate-blob2" />
      <div className="absolute top-[40%] right-[20%] h-[400px] w-[400px] rounded-full bg-violet-500/[0.06] blur-[140px] animate-blob3" />
    </div>
  );
}