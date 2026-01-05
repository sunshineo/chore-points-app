import { redirect } from "next/navigation";
import { getSession } from "@/lib/permissions";
import Link from "next/link";

export default async function Home() {
  const session = await getSession();

  // If logged in, redirect to dashboard
  if (session?.user) {
    redirect("/dashboard");
  }

  // Landing page for non-authenticated users
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Chore Points
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Make household chores fun with points and rewards!
        </p>
        <div className="space-x-4">
          <Link
            href="/signup"
            className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-white text-blue-600 font-medium rounded-lg border-2 border-blue-600 hover:bg-blue-50 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
