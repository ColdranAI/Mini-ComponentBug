"use client";

import Link from "next/link";
import DummyFailedRequests from "@/app/components/DummyFailedRequests";

export default function TestPage2() {
  return (
    <>
      <h1 className="text-xl font-semibold">Test Page 2</h1>
      <p className="text-sm text-neutral-700 mt-1">
        This is the second test page. Recording should continue even when you navigate between pages.
      </p>

      <section className="mt-6 grid gap-4">
        <DummyFailedRequests />
        <div className="border border-neutral-300 p-4 bg-white">
          <h3 className="font-medium">Advanced Interactions</h3>
          <p className="text-sm text-neutral-600">More complex UI components for testing.</p>
          <div className="mt-2 space-y-2">
            <div className="flex items-center space-x-2">
              <input type="checkbox" id="check1" />
              <label htmlFor="check1">Checkbox Option 1</label>
            </div>
            <div className="flex items-center space-x-2">
              <input type="checkbox" id="check2" />
              <label htmlFor="check2">Checkbox Option 2</label>
            </div>
            <div className="flex items-center space-x-2">
              <input type="radio" id="radio1" name="test" />
              <label htmlFor="radio1">Radio Option 1</label>
            </div>
            <div className="flex items-center space-x-2">
              <input type="radio" id="radio2" name="test" />
              <label htmlFor="radio2">Radio Option 2</label>
            </div>
          </div>
        </div>

        <div className="border border-neutral-300 p-4 bg-white">
          <h3 className="font-medium">Drag and Drop Area</h3>
          <p className="text-sm text-neutral-600">Test drag and drop interactions.</p>
          <div 
            className="mt-2 border-2 border-dashed border-neutral-300 p-8 text-center text-neutral-500 hover:bg-neutral-50"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              alert('File dropped!');
            }}
          >
            Drag files here or click to upload
          </div>
        </div>

        <div className="border border-neutral-300 p-4 bg-white">
          <h3 className="font-medium">Navigation Test</h3>
          <p className="text-sm text-neutral-600">Navigate to other pages while recording to test cross-page functionality.</p>
          <div className="mt-2 flex gap-2">
            <Link href="/" className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-900 text-white inline-block">
              Go to Home
            </Link>
            <Link href="/test-page-1" className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white inline-block">
              Go to Test Page 1
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
