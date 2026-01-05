"use client";

import { useEffect, useState } from "react";
import ChoreForm from "./ChoreForm";

type Chore = {
  id: string;
  title: string;
  defaultPoints: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: { name: string | null; email: string };
  updatedBy: { name: string | null; email: string };
};

export default function ChoresList() {
  const [chores, setChores] = useState<Chore[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingChore, setEditingChore] = useState<Chore | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "archived">("active");

  useEffect(() => {
    fetchChores();
  }, []);

  const fetchChores = async () => {
    try {
      const response = await fetch("/api/chores");
      const data = await response.json();
      if (response.ok) {
        setChores(data.chores);
      }
    } catch (error) {
      console.error("Failed to fetch chores:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this chore?")) return;

    try {
      const response = await fetch(`/api/chores/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setChores(chores.filter((c) => c.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete chore:", error);
    }
  };

  const handleToggleActive = async (chore: Chore) => {
    try {
      const response = await fetch(`/api/chores/${chore.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !chore.isActive }),
      });

      if (response.ok) {
        const data = await response.json();
        setChores(chores.map((c) => (c.id === chore.id ? data.chore : c)));
      }
    } catch (error) {
      console.error("Failed to update chore:", error);
    }
  };

  const handleEdit = (chore: Chore) => {
    setEditingChore(chore);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingChore(null);
  };

  const handleFormSuccess = (chore: Chore) => {
    if (editingChore) {
      setChores(chores.map((c) => (c.id === chore.id ? chore : c)));
    } else {
      setChores([chore, ...chores]);
    }
    handleFormClose();
  };

  const filteredChores = chores.filter((chore) => {
    if (filter === "active") return chore.isActive;
    if (filter === "archived") return !chore.isActive;
    return true;
  });

  if (loading) {
    return <div className="text-center py-8">Loading chores...</div>;
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter("active")}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === "active"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter("archived")}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === "archived"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Archived
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === "all"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            All
          </button>
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          + Add Chore
        </button>
      </div>

      {filteredChores.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">
            {filter === "active"
              ? "No active chores. Add one to get started!"
              : filter === "archived"
              ? "No archived chores."
              : "No chores yet. Add one to get started!"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Chore
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Points
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created By
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredChores.map((chore) => (
                <tr key={chore.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {chore.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      Last updated by{" "}
                      {chore.updatedBy.name || chore.updatedBy.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-semibold text-blue-600">
                      {chore.defaultPoints} pts
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        chore.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {chore.isActive ? "Active" : "Archived"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {chore.createdBy.name || chore.createdBy.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleEdit(chore)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(chore)}
                      className="text-yellow-600 hover:text-yellow-900"
                    >
                      {chore.isActive ? "Archive" : "Activate"}
                    </button>
                    <button
                      onClick={() => handleDelete(chore.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <ChoreForm
          chore={editingChore}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
}
