import { SerwistProvider } from "@serwist/next/react";
import DayKioskPage from "./DayKioskPage";

export default function DayPage() {
  return (
    <SerwistProvider
      swUrl="/sw.js"
      disable={process.env.NODE_ENV !== "production"}
      cacheOnNavigation={false}
      reloadOnOnline={false}
      options={{ scope: "/day" }}
    >
      <DayKioskPage />
    </SerwistProvider>
  );
}
