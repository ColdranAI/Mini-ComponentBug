"use client";

import Link from "next/link";
import DummyFailedRequests from "@/app/components/DummyFailedRequests";

export default function TestPage1() {
  return (
    <>
      <h1 className="text-xl font-semibold">Test Page 1</h1>
      <p className="text-sm text-neutral-700 mt-1">
        This is the first test page. You can record across pages by starting recording here and navigating to other pages.
      </p>

      <section className="mt-6 grid gap-4">
        <DummyFailedRequests />
        <div className="border border-neutral-300 p-4 bg-white">
          <h3 className="font-medium">Test Component 1</h3>
          <p className="text-sm text-neutral-600">This component demonstrates different interactions.</p>
          <button className="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 duration-300 hover:scale-105 text-white cursor-pointer">
            Click Test 1
          </button>
        </div>

        <div className="border border-neutral-300 p-4 bg-white">
          <h3 className="font-medium">Form Component</h3>
          <p className="text-sm text-neutral-600">Test form interactions and input handling.</p>
          <div className="mt-2 space-y-2">
            <input 
              type="text" 
              placeholder="Enter some text..." 
              className="w-full border border-neutral-300 p-2 rounded"
            />
            <select className="w-full border border-neutral-300 p-2 rounded">
              <option>Option 1</option>
              <option>Option 2</option>
              <option>Option 3</option>
            </select>
            <button className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white cursor-pointer">
              Submit Form
            </button>
          </div>
        </div>

        <div className="border border-neutral-300 p-4 bg-white">
          <h3 className="font-medium">Interactive Elements</h3>
          <p className="text-sm text-neutral-600">Various interactive elements for testing.</p>
          <div className="mt-2 flex gap-2">
            <button className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white cursor-pointer">
              Red Button
            </button>
            <button className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white cursor-pointer">
              Yellow Button
            </button>
            <button className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white cursor-pointer">
              Purple Button
            </button>
          </div>
        </div>

        <div className="border border-neutral-300 p-4 bg-white">
          <h3 className="font-medium">Navigation Test</h3>
          <p className="text-sm text-neutral-600">Test cross-page recording by clicking these links while recording.</p>
          <div className="mt-2 flex gap-2">
            <Link href="/" className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-900 text-white inline-block">
              Go to Home
            </Link>
            <Link href="/test-page-2" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white inline-block">
              Go to Test Page 2
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
