"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function CreateAccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token");

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");

  // optional: email display from invite
  const [email, setEmail] = useState("");

  // 1. validate token on load
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError("Missing invite token");
        setValidating(false);
        return;
      }

      try {
        const res = await fetch(`/api/invite/validate?token=${token}`);
        const data = await res.json();

        if (!data.success) {
          setError("Invalid or expired invite link");
        } else {
          setEmail(data.email);
        }
      } catch (err) {
        setError("Failed to validate invite");
      } finally {
        setValidating(false);
      }
    }

    validateToken();
  }, [token]);

  async function handleSubmit() {
    if (!token) return;

    if (!name || !company) {
      setError("Name and company are required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name,
          company,
          phone,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Something went wrong");
        return;
      }

      // success → send to dashboard or login
      router.push("/dashboard");
    } catch (err) {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        Validating invite...
      </div>
    );
  }

  if (error && !email) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="rounded-xl bg-blue-500 px-4 py-2"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-black to-slate-900 text-white p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl space-y-4">

        <h1 className="text-2xl font-bold">Create Your Account</h1>

        {email && (
          <p className="text-sm text-gray-400">
            Invited email: <span className="text-white">{email}</span>
          </p>
        )}

        <input
          className="w-full rounded-xl bg-black/30 p-3 outline-none border border-white/10"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="w-full rounded-xl bg-black/30 p-3 outline-none border border-white/10"
          placeholder="Company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />

        <input
          className="w-full rounded-xl bg-black/30 p-3 outline-none border border-white/10"
          placeholder="Phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full rounded-xl bg-emerald-500 py-3 font-semibold disabled:opacity-50"
        >
          {loading ? "Creating Account..." : "Complete Setup"}
        </button>
      </div>
    </div>
  );
}