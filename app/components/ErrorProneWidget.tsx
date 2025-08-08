"use client";

import { useState } from "react";

export default function ErrorProneWidget() {
  const [explode, setExplode] = useState(false);
  if (explode) {
    throw new Error("Demo error from ErrorProneWidget");
  }
  return (
    <div className="border border-neutral-400 p-4 bg-white">
      <h3 className="font-medium">ErrorProneWidget</h3>
      <p className="text-sm text-neutral-600">Click the button to throw an error (caught by local boundary).</p>
      <button onClick={() => setExplode(true)} className="mt-2 px-3 py-1.5 bg-red-600 text-white hover:bg-red-700">
        Throw error
      </button>
    </div>
  );
}


