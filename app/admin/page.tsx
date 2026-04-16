"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 🔐 ADMIN GUARD (STEP 4)
  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user?.email) {
      router.replace("/");
      return;
    }

    if (session.user.role !== "ADMIN") {
      router.replace("/dashboard");
      return;
    }

    loadApplications();
  }, [session, status]);

  const loadApplications = async () => {
    try {
      const res = await fetch("/api/applications");
      const data = await res.json();

      setApps(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const approve = async (id: string) => {
    await fetch("/api/applications/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    loadApplications();
  };

  const deny = async (id: string) => {
    await fetch("/api/applications/deny", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    loadApplications();
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-black">
        Loading admin panel...
      </div>
    );
  }

  return (
    <div className="p-8 text-white">
      <h1 className="text-2xl font-bold mb-6">Admin Panel</h1>

      <div className="space-y-4">
        {apps.map((app: any) => (
          <div
            key={app.id}
            className="p-4 rounded-xl bg-white/5 border border-white/10"
          >
            <p className="font-semibold">
              {app.firstName} {app.lastName}
            </p>

            <p className="text-sm text-gray-300">{app.email}</p>

            {/* STEP 5 (you asked earlier) */}
            <p className="text-sm text-yellow-400">
              Status: {app.status}
            </p>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => approve(app.id)}
                className="px-3 py-1 bg-green-500 rounded"
              >
                Approve
              </button>

              <button
                onClick={() => deny(app.id)}
                className="px-3 py-1 bg-red-500 rounded"
              >
                Deny
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}