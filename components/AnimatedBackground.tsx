"use client";

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 bg-[#05060A]">
      
      {/* subtle gradient depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#070A12] via-[#05060A] to-black" />

      {/* noise overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')",
        }}
      />

      {/* grid (very subtle like SaaS sites) */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* soft glow accents (VERY controlled) */}
      <div className="absolute top-[-200px] left-[-200px] h-[600px] w-[600px] rounded-full bg-blue-500/10 blur-[140px]" />
      <div className="absolute bottom-[-200px] right-[-200px] h-[600px] w-[600px] rounded-full bg-cyan-500/10 blur-[140px]" />
    </div>
  );
}