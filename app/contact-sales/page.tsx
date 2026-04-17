import { Suspense } from "react";
import ContactSalesPage from "./ContactSalesPage";

export default function Page() {
  return (
    <Suspense fallback={<div className="text-white p-10">Loading...</div>}>
      <ContactSalesPage />
    </Suspense>
  );
}