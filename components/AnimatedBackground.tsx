"use client";

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-slate-950 to-black" />

      {/* Glow blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[120px] animate-blob1" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[120px] animate-blob2" />
      <div className="absolute top-[30%] left-[40%] w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[120px] animate-blob3" />
    </div>
  );
}