"use client";

import { signOut } from "next-auth/react";

export default function PendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white text-center p-6">
      <div>
        <h1 className="text-3xl font-bold mb-4">
          Application Under Review
        </h1>

        <p className="text-gray-400 mb-6">
          Your access request is currently being reviewed. You’ll be notified once approved.
        </p>

        <button
          onClick={() => signOut()}
          className="px-6 py-2 bg-white text-black rounded-xl"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}