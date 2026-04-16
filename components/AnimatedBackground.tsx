"use client";

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#070A12]">
      
      {/* Soft gradient base */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0B1220] via-[#070A12] to-[#05070F]" />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Soft glow accents (very subtle) */}
      <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[120px]" />
      <div className="absolute top-1/2 -right-40 h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[120px]" />
    </div>
  );
}