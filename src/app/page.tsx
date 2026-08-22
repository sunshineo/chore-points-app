import { SerwistProvider } from "@serwist/next/react";
import ProtectedApp from "./ProtectedApp";

export default function Home() {
  return (
    <SerwistProvider
      swUrl="/sw.js"
      disable={process.env.NODE_ENV !== "production"}
      cacheOnNavigation={false}
      reloadOnOnline={false}
      options={{ scope: "/" }}
    >
      <ProtectedApp />
    </SerwistProvider>
  );
}
