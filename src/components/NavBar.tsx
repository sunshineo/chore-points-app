"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavBar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Don't show navbar on login/signup pages
  if (pathname === "/login" || pathname === "/signup") {
    return null;
  }

  // Show loading state
  if (status === "loading") {
    return (
      <nav className="bg-gray-800 text-white px-4 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-xl font-bold">
            Chore Points
          </Link>
          <div className="text-sm text-gray-400">Loading...</div>
        </div>
      </nav>
    );
  }

  // Don't show user info if not logged in
  if (!session) {
    return (
      <nav className="bg-gray-800 text-white px-4 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-xl font-bold">
            Chore Points
          </Link>
          <div className="flex gap-4">
            <Link
              href="/login"
              className="text-sm hover:text-gray-300 transition"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded transition"
            >
              Sign up
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  const isParent = session.user.role === "PARENT";

  return (
    <nav className="bg-gray-800 text-white px-4 py-3">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-xl font-bold">
            Chore Points
          </Link>

          {/* Navigation links */}
          {session.user.familyId && (
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <Link
                href="/dashboard"
                className={`hover:text-gray-300 transition ${
                  pathname === "/dashboard" ? "text-blue-400" : ""
                }`}
              >
                Dashboard
              </Link>

              {isParent ? (
                <>
                  <Link
                    href="/chores"
                    className={`hover:text-gray-300 transition ${
                      pathname === "/chores" ? "text-blue-400" : ""
                    }`}
                  >
                    Chores
                  </Link>
                  <Link
                    href="/ledger"
                    className={`hover:text-gray-300 transition ${
                      pathname === "/ledger" ? "text-blue-400" : ""
                    }`}
                  >
                    Points
                  </Link>
                  <Link
                    href="/rewards"
                    className={`hover:text-gray-300 transition ${
                      pathname === "/rewards" ? "text-blue-400" : ""
                    }`}
                  >
                    Rewards
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/points"
                    className={`hover:text-gray-300 transition ${
                      pathname === "/points" ? "text-blue-400" : ""
                    }`}
                  >
                    My Points
                  </Link>
                  <Link
                    href="/redeem"
                    className={`hover:text-gray-300 transition ${
                      pathname === "/redeem" ? "text-blue-400" : ""
                    }`}
                  >
                    Redeem
                  </Link>
                </>
              )}
            </div>
          )}
        </div>

        {/* User info and logout */}
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="text-gray-400 hidden sm:inline">Logged in as </span>
            <span className="font-medium">
              {session.user.name || session.user.email}
            </span>
            <span
              className={`ml-2 text-xs px-2 py-0.5 rounded ${
                isParent
                  ? "bg-purple-600 text-purple-100"
                  : "bg-green-600 text-green-100"
              }`}
            >
              {isParent ? "Parent" : "Kid"}
            </span>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded transition"
          >
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}
