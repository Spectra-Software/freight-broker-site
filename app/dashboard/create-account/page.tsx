"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function CreateAccount() {
  const params = useSearchParams();
  const token = params.get("token");

  const [form, setForm] = useState({
    name: "",
    company: "",
    phone: "",
  });

  const handleSubmit = async () => {
    await fetch("/api/create-account", {
      method: "POST",
      body: JSON.stringify({ ...form, token }),
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050816] text-white">
      <div className="p-8 bg-white/5 rounded-2xl w-full max-w-md">
        <h1 className="text-2xl mb-4">Complete Your Account</h1>

        <input
          placeholder="Name"
          className="w-full mb-3 p-3 bg-black/30 rounded"
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <input
          placeholder="Company"
          className="w-full mb-3 p-3 bg-black/30 rounded"
          onChange={(e) => setForm({ ...form, company: e.target.value })}
        />

        <input
          placeholder="Phone"
          className="w-full mb-3 p-3 bg-black/30 rounded"
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />

        <button
          onClick={handleSubmit}
          className="w-full bg-blue-600 p-3 rounded"
        >
          Finish Setup
        </button>
      </div>
    </div>
  );
}