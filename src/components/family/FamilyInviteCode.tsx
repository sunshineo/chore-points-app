"use client";

import { useState } from "react";

export default function FamilyInviteCode({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = inviteCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="text-sm text-gray-500">Invite Code for Kids</div>
      <div className="flex items-center gap-2">
        {showCode ? (
          <code className="bg-gray-100 px-3 py-1.5 rounded font-mono text-sm">
            {inviteCode}
          </code>
        ) : (
          <button
            onClick={() => setShowCode(true)}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Show code
          </button>
        )}
        <button
          onClick={handleCopy}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            copied
              ? "bg-green-100 text-green-700"
              : "bg-blue-100 text-blue-700 hover:bg-blue-200"
          }`}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      {showCode && (
        <p className="text-xs text-gray-400">
          Share this code with your kid to let them join
        </p>
      )}
    </div>
  );
}
