"use client";

import { useEffect, useState } from "react";
import PointEntryForm from "./PointEntryForm";

type Kid = {
  id: string;
  name: string | null;
  email: string;
};

type PointEntry = {
  id: string;
  points: number;
  note: string | null;
  date: string;
  chore: { title: string } | null;
  createdBy: { name: string | null; email: string };
  updatedBy: { name: string | null; email: string };
  redemption: any;
};

export default function PointsLedger() {
  const [kids, setKids] = useState<Kid[]>([]);
  const [selectedKid, setSelectedKid] = useState<Kid | null>(null);
  const [entries, setEntries] = useState<PointEntry[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PointEntry | null>(null);

  useEffect(() => {
    fetchKids();
  }, []);

  useEffect(() => {
    if (selectedKid) {
      fetchPoints(selectedKid.id);
    }
  }, [selectedKid]);

  const fetchKids = async () => {
    try {
      const response = await fetch("/api/family/kids");
      const data = await response.json();
      if (response.ok && data.kids.length > 0) {
        setKids(data.kids);
        setSelectedKid(data.kids[0]);
      }
    } catch (error) {
      console.error("Failed to fetch kids:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPoints = async (kidId: string) => {
    try {
      const response = await fetch(`/api/points?kidId=${kidId}`);
      const data = await response.json();
      if (response.ok) {
        setEntries(data.entries);
        setTotalPoints(data.totalPoints);
      }
    } catch (error) {
      console.error("Failed to fetch points:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    try {
      const response = await fetch(`/api/points/${id}`, {
        method: "DELETE",
      });

      if (response.ok && selectedKid) {
        fetchPoints(selectedKid.id);
      }
    } catch (error) {
      console.error("Failed to delete entry:", error);
    }
  };

  const handleEdit = (entry: PointEntry) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingEntry(null);
  };

  const handleFormSuccess = () => {
    if (selectedKid) {
      fetchPoints(selectedKid.id);
    }
    handleFormClose();
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (kids.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">
          No kids in your family yet. Add a kid using the invite code.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">
            Select Kid:
          </label>
          <select
            value={selectedKid?.id || ""}
            onChange={(e) => {
              const kid = kids.find((k) => k.id === e.target.value);
              setSelectedKid(kid || null);
            }}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {kids.map((kid) => (
              <option key={kid.id} value={kid.id}>
                {kid.name || kid.email}
              </option>
            ))}
          </select>

          {selectedKid && (
            <div className="ml-6 flex items-center">
              <span className="text-2xl font-bold text-blue-600">
                {totalPoints} points
              </span>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowForm(true)}
          disabled={!selectedKid}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Add Points
        </button>
      </div>

      {selectedKid && entries.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">
            No point entries yet. Add points to get started!
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Chore
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Points
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Note
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Added By
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(entry.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entry.chore?.title || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`text-sm font-semibold ${
                        entry.points >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {entry.points >= 0 ? "+" : ""}
                      {entry.points}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {entry.redemption ? (
                      <span className="text-purple-600">
                        Redeemed: {entry.redemption.reward.title}
                      </span>
                    ) : (
                      entry.note || "-"
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.createdBy.name || entry.createdBy.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    {!entry.redemption && (
                      <>
                        <button
                          onClick={() => handleEdit(entry)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && selectedKid && (
        <PointEntryForm
          kidId={selectedKid.id}
          entry={editingEntry}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
}
