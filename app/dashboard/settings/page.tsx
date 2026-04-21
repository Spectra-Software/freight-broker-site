"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type UserSettings = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  company: string | null;
  phone: string | null;
  role: string;
  plan: string;
  preferGmailSignature: boolean | null;
  isOnboarded: boolean;
  createdAt: string;
};

export default function Settings() {
  const { data: session } = useSession();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [preferGmailSig, setPreferGmailSig] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/user/settings");
        if (!res.ok) throw new Error("Failed to load settings");
        const data: UserSettings = await res.json();
        setSettings(data);
        setName(data.name ?? "");
        setCompany(data.company ?? "");
        setPhone(data.phone ?? "");
        setPreferGmailSig(data.preferGmailSignature ?? false);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || null,
          company: company || null,
          phone: phone || null,
          preferGmailSignature: preferGmailSig,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      const updated: UserSettings = await res.json();
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-6rem)] items-center justify-center">
        <p className="text-gray-400">Loading settings...</p>
      </div>
    );
  }

  const planLabel: Record<string, string> = {
    BASIC: "Basic",
    PRO: "Pro",
    ENTERPRISE: "Enterprise",
  };

  const roleLabel: Record<string, string> = {
    USER: "User",
    ADMIN: "Admin",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Account Settings</h1>
        <p className="mt-2 text-sm text-gray-400">
          Manage your profile and preferences.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl lg:col-span-2">
          <h2 className="text-lg font-semibold text-white">Profile</h2>
          <p className="mt-1 text-sm text-gray-400">Your personal information.</p>

          <div className="mt-6 space-y-5">
            <div>
              <label className="text-xs font-medium text-gray-400">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-blue-500/50"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400">Email</label>
              <input
                type="email"
                value={settings?.email ?? ""}
                disabled
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-400 outline-none cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500">Email cannot be changed here.</p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-gray-400">Company</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-blue-500/50"
                  placeholder="Your company"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-blue-500/50"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>

            {saved && (
              <span className="text-sm font-medium text-green-400">Saved!</span>
            )}

            {error && (
              <span className="text-sm text-rose-400">{error}</span>
            )}
          </div>
        </div>

        {/* Account Info Card */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <h2 className="text-lg font-semibold text-white">Account</h2>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs text-gray-400">Plan</p>
                <span className="mt-1 inline-block rounded-full bg-blue-500/20 px-3 py-1 text-sm font-semibold text-blue-400">
                  {planLabel[settings?.plan ?? "BASIC"] ?? settings?.plan}
                </span>
              </div>

              <div>
                <p className="text-xs text-gray-400">Role</p>
                <span className="mt-1 inline-block rounded-full bg-purple-500/20 px-3 py-1 text-sm font-semibold text-purple-400">
                  {roleLabel[settings?.role ?? "USER"] ?? settings?.role}
                </span>
              </div>

              <div>
                <p className="text-xs text-gray-400">Member Since</p>
                <p className="mt-1 text-sm text-white">
                  {settings?.createdAt
                    ? new Date(settings.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Preferences Card */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <h2 className="text-lg font-semibold text-white">Preferences</h2>

            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">Gmail Signature</p>
                  <p className="text-xs text-gray-400">Append Gmail signature on send</p>
                </div>
                <button
                  onClick={() => setPreferGmailSig(!preferGmailSig)}
                  className={`relative h-6 w-11 rounded-full transition ${
                    preferGmailSig ? "bg-blue-600" : "bg-white/20"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      preferGmailSig ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Gmail Connection Card */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <h2 className="text-lg font-semibold text-white">Gmail</h2>

            <div className="mt-4">
              {session ? (
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                  <p className="text-sm text-gray-300">Connected</p>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <p className="text-sm text-gray-300">Not connected</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}