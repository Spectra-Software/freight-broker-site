"use client";

import { useSession } from "next-auth/react";

export default function Settings() {
  const { data: session } = useSession();

  const user = session?.user as any;

  return (
    <div className="p-8 text-white">
      <h1 className="text-3xl mb-6">Account Settings</h1>

      <div className="space-y-3">
        <p><strong>Name:</strong> {user?.name}</p>
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>Company:</strong> {user?.company}</p>
        <p><strong>Phone:</strong> {user?.phone}</p>

        <div className="mt-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={user?.preferGmailSignature ?? false}
              onChange={async (e) => {
                // Save preference via API
                try {
                  const res = await fetch('/api/user/preference', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ preferGmailSignature: e.currentTarget.checked }),
                  });
                  if (!res.ok) throw new Error('Failed to save');
                  // reload session to reflect change
                  window.location.reload();
                } catch (err) {
                  console.error(err);
                  alert('Failed to save preference');
                }
              }}
            />
            <span className="text-sm">Use my Gmail signature when sending emails</span>
          </label>
        </div>
      </div>
    </div>
  );
}