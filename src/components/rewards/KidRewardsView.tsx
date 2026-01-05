"use client";

import { useEffect, useState } from "react";

type Reward = {
  id: string;
  title: string;
  costPoints: number;
  imageUrl: string | null;
};

type Redemption = {
  id: string;
  status: string;
  requestedAt: string;
  resolvedAt: string | null;
  reward: { title: string; costPoints: number; imageUrl: string | null };
  resolvedBy: { name: string | null; email: string } | null;
};

type KidRewardsViewProps = {
  kidId: string;
};

export default function KidRewardsView({ kidId }: KidRewardsViewProps) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRewards();
    fetchPoints();
    fetchRedemptions();
  }, [kidId]);

  const fetchRewards = async () => {
    try {
      const response = await fetch("/api/rewards");
      const data = await response.json();
      if (response.ok) {
        setRewards(data.rewards);
      }
    } catch (error) {
      console.error("Failed to fetch rewards:", error);
    }
  };

  const fetchPoints = async () => {
    try {
      const response = await fetch(`/api/points?kidId=${kidId}`);
      const data = await response.json();
      if (response.ok) {
        setTotalPoints(data.totalPoints);
      }
    } catch (error) {
      console.error("Failed to fetch points:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRedemptions = async () => {
    try {
      const response = await fetch(`/api/redemptions?kidId=${kidId}`);
      const data = await response.json();
      if (response.ok) {
        setRedemptions(data.redemptions);
      }
    } catch (error) {
      console.error("Failed to fetch redemptions:", error);
    }
  };

  const handleRedeem = async (rewardId: string, rewardTitle: string) => {
    if (
      !confirm(
        `Redeem "${rewardTitle}"? This will create a pending request for your parent to approve.`
      )
    )
      return;

    try {
      const response = await fetch("/api/redemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardId }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("Redemption request submitted! Waiting for parent approval.");
        fetchRedemptions();
      } else {
        alert(data.error || "Failed to request redemption");
      }
    } catch (error) {
      console.error("Failed to request redemption:", error);
      alert("Failed to request redemption");
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      PENDING: "bg-yellow-100 text-yellow-800",
      APPROVED: "bg-green-100 text-green-800",
      DENIED: "bg-red-100 text-red-800",
    };
    return styles[status as keyof typeof styles] || "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div>
      {/* Current Points Display */}
      <div className="mb-8">
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow-lg p-8 text-white">
          <div className="text-center">
            <p className="text-lg font-medium opacity-90">Available Points</p>
            <p className="text-6xl font-bold mt-2">{totalPoints}</p>
            <p className="text-sm mt-4 opacity-75">
              Save up to redeem awesome rewards!
            </p>
          </div>
        </div>
      </div>

      {/* Available Rewards */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Available Rewards
        </h2>

        {rewards.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500">
              No rewards available yet. Ask your parent to add some!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rewards.map((reward) => {
              const canAfford = totalPoints >= reward.costPoints;
              return (
                <div
                  key={reward.id}
                  className={`bg-white rounded-lg shadow overflow-hidden ${
                    canAfford ? "hover:shadow-lg" : "opacity-60"
                  } transition-shadow`}
                >
                  {reward.imageUrl && (
                    <div className="h-48 overflow-hidden bg-gray-200">
                      <img
                        src={reward.imageUrl}
                        alt={reward.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {reward.title}
                    </h3>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-2xl font-bold text-purple-600">
                        {reward.costPoints} pts
                      </span>
                      {canAfford ? (
                        <span className="text-sm text-green-600 font-medium">
                          You can afford this!
                        </span>
                      ) : (
                        <span className="text-sm text-gray-500">
                          Need {reward.costPoints - totalPoints} more
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRedeem(reward.id, reward.title)}
                      disabled={!canAfford}
                      className={`w-full px-4 py-2 rounded-md font-medium ${
                        canAfford
                          ? "bg-purple-600 text-white hover:bg-purple-700"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      {canAfford ? "Redeem" : "Not Enough Points"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Redemption History */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          My Redemption History
        </h2>

        {redemptions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500">
              No redemptions yet. Earn points and redeem rewards!
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reward
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Requested
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Resolved
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {redemptions.map((redemption) => (
                  <tr key={redemption.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {redemption.reward.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {redemption.reward.costPoints} pts
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(
                          redemption.status
                        )}`}
                      >
                        {redemption.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(redemption.requestedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {redemption.resolvedAt
                        ? new Date(redemption.resolvedAt).toLocaleDateString()
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
