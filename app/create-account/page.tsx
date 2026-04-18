import { Suspense } from "react";
import CreateAccountClient from "./CreateAccountClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-black text-white">Loading...</div>}>
      <CreateAccountClient />
    </Suspense>
  );
}