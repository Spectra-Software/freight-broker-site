"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export default function ApplicationModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    company: "",
    email: "",
    phone: "",
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);

    await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setLoading(false);
    setSubmitted(true);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-white/10"
      >
        <h2 className="text-xl font-bold mb-4">Request Access</h2>

        {submitted ? (
          <p className="text-green-400">
            Application submitted! We’ll review and get back to you.
          </p>
        ) : (
          <div className="space-y-3">
            <input
              placeholder="First Name"
              className="w-full p-2 rounded bg-black/40 border border-white/10"
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />

            <input
              placeholder="Last Name"
              className="w-full p-2 rounded bg-black/40 border border-white/10"
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />

            <input
              placeholder="Company"
              className="w-full p-2 rounded bg-black/40 border border-white/10"
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />

            <input
              placeholder="Email"
              className="w-full p-2 rounded bg-black/40 border border-white/10"
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />

            <input
              placeholder="Phone Number"
              className="w-full p-2 rounded bg-black/40 border border-white/10"
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 py-2 rounded font-semibold"
            >
              {loading ? "Submitting..." : "Submit Application"}
            </button>

            <button
              onClick={onClose}
              className="w-full text-gray-400 text-sm"
            >
              Cancel
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}