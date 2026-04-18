"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function CreateAccountClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token");

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

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
      } catch {
        setError("Failed to validate invite");
      } finally {
        setValidating(false);
      }
    }

    validateToken();
  }, [token]);

  async function handleSubmit() {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, company, phone }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Something went wrong");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white">
        Validating invite...
      </div>
    );
  }

  if (error && !email) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white">
        <div className="text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <button onClick={() => router.push("/")} className="bg-blue-500 px-4 py-2 rounded-xl">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center text-white p-6">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold">Create Account</h1>

        {email && <p className="text-sm text-gray-400">{email}</p>}

        <input className="w-full p-3 bg-black/30 rounded-xl" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="w-full p-3 bg-black/30 rounded-xl" placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
        <input className="w-full p-3 bg-black/30 rounded-xl" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button onClick={handleSubmit} disabled={loading} className="w-full bg-emerald-500 py-3 rounded-xl">
          {loading ? "Creating..." : "Complete Setup"}
        </button>
      </div>
    </div>
  );
}