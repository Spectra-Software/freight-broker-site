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
      </div>
    </div>
  );
}