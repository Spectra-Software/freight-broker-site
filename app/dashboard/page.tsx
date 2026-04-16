"use client";

import { motion } from "framer-motion";

export default function DashboardPage() {
  const cards = [
    {
      title: "AI Assistant",
      desc: "Generate emails and freight insights instantly.",
    },
    {
      title: "Carrier Lookup",
      desc: "Search MC numbers and safety records.",
    },
    {
      title: "Fuel Analytics",
      desc: "Track diesel prices and trends.",
    },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Overview</h1>

      <div className="grid md:grid-cols-3 gap-6">
        {cards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ scale: 1.05 }}
            className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl hover:border-blue-500 transition"
          >
            <h3 className="text-lg font-semibold mb-2 text-blue-400">
              {card.title}
            </h3>
            <p className="text-gray-300 text-sm">{card.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}