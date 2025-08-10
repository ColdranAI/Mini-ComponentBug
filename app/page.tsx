"use client";

import ErrorBoundary from "@/app/components/ErrorBoundary";
import ErrorProneWidget from "@/app/components/ErrorProneWidget";
import DummyFailedRequests from "@/app/components/DummyFailedRequests";
import { useRecorder } from "@/app/contexts/RecorderContext";

export default function HomePage() {
  const { status } = useRecorder();

  return (
    <>
      <h1 className="text-xl font-semibold">Mini Component Bug Reporter</h1>
      <p className="text-sm text-neutral-700 mt-1">
        Cross-browser element recorder using html2canvas → canvas.captureStream() → MediaRecorder.
      </p>

      {/* {status && <div className="mt-2 text-neutral-700">{status}</div>} */}

      <textarea 
        className="w-full min-h-[128px] border border-neutral-300 p-2 outline-none focus:ring-2 focus:ring-neutral-500 bg-neutral-50 mt-4"
      />

      <div className="mt-4 flex flex-row gap-2">
        <button onClick={() => window.open('https://x.com/ColdranAI', '_blank')} className="px-3 py-1.5 cursor-pointer bg-neutral-800 hover:bg-neutral-900 duration-300 active:scale-95 text-white">
          Follow Coldran on X
        </button>
        <button onClick={() => window.open('https://x.com/ArjunShips', '_blank')} className="px-3 py-1.5 cursor-pointer bg-neutral-800 hover:bg-neutral-900 duration-300 active:scale-95 text-white">
          Follow Arjun Aditya on X
        </button>
      </div>

      <section className="mt-6 grid gap-4 pb-40">
        <DummyFailedRequests />
        
        <div className="border border-neutral-300 p-4 bg-white">
          <h3 className="font-medium">Example component</h3>
          <p className="text-sm text-neutral-600">Hover this or anything else—your choice.</p>
          <button className="mt-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-900 duration-300 hover:scale-105 text-white cursor-pointer">
            Click me
          </button>
        </div>

        <div className="border border-neutral-300 p-4 bg-white">
          <h3 className="font-medium">Our Links</h3>
          <p className="text-sm text-neutral-600">Hover this or anything else—your choice.</p>
          <div className="flex flex-row gap-2">
            <a href="https://coldran.com/" target="_blank" className="mt-2 px-3 py-1.5 bg-black hover:bg-neutral-800 duration-300 text-white">
              Coldran
            </a>
            <a href="https://github.com/ColdranAI/Mini-ComponentBug" target="_blank" className="mt-2 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-800 duration-300 text-white">
              Github
            </a>
            <a href="https://discord.gg/rDDqA83eGz" target="_blank" className="mt-2 px-3 py-1.5 bg-purple-500 hover:bg-purple-600 duration-300 text-white">
              Join Discord
            </a>
            <a href="https://x.com/ArjunS1234567890" target="_blank" className="mt-2 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 duration-300 text-white">
              Follow on X
            </a>
          </div>
        </div>

        <ErrorBoundary>
          <ErrorProneWidget />
        </ErrorBoundary>
      </section>
    </>
  );
}