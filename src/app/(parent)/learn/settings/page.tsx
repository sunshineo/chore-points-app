import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/permissions";
import MathSettingsForm from "@/components/learn/MathSettingsForm";

export default async function MathSettingsPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.familyId) {
    redirect("/dashboard");
  }

  if (session.user.role !== "PARENT") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <MathSettingsForm />
        
        <div className="mt-8 p-6 bg-white rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">📝 Custom Math Questions</h3>
          <p className="text-gray-600 mb-4">
            Schedule your own math questions for specific dates. Perfect for grandparents or parents who want to create personalized practice!
          </p>
          <Link
            href="/learn/questions"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Schedule Custom Questions →
          </Link>
        </div>
      </div>
    </div>
  );
}
