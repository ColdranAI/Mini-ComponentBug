"use client";

import { useEffect } from "react";

// Component to trigger dummy failed requests for testing
export default function DummyFailedRequests() {
  useEffect(() => {
    const triggerFailedRequests = async () => {
      // Wait a bit for the page to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Trigger various types of failed requests
      const failedRequests = [
        {
          url: "/api/fake-endpoint-404",
          method: "GET",
          description: "404 Not Found"
        },
        {
          url: "/api/fake-endpoint-500",
          method: "POST",
          body: { test: "data" },
          description: "500 Internal Server Error"
        },
        {
          url: "https://jsonplaceholder.typicode.com/fake-endpoint",
          method: "GET",
          description: "External API 404"
        },
        {
          url: "/api/fake-validation-error",
          method: "PUT",
          body: { invalid: "data" },
          description: "Validation Error"
        }
      ];

      // Trigger requests with delays
      for (let i = 0; i < failedRequests.length; i++) {
        const request = failedRequests[i];
        
        setTimeout(() => {
          console.log(`🔍 Triggering dummy failed request: ${request.description}`);
          
          fetch(request.url, {
            method: request.method,
            headers: {
              'Content-Type': 'application/json',
              'X-Test-Request': 'true',
              'Authorization': 'Bearer fake-token-for-testing'
            },
            body: request.body ? JSON.stringify(request.body) : undefined
          }).catch(error => {
            console.warn(`Expected failure for ${request.description}:`, error);
          });
        }, i * 3000); // Spread out requests every 3 seconds
      }

      // Also trigger some XMLHttpRequest failures
      setTimeout(() => {
        console.log('🔍 Triggering XMLHttpRequest failure');
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/xhr-test-failure');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('X-Custom-Header', 'test-value');
        xhr.send(JSON.stringify({ test: 'xhr data' }));
      }, 15000);

      // Trigger a network error (CORS or unreachable)
      setTimeout(() => {
        console.log('🔍 Triggering network error');
        fetch('https://fake-unreachable-domain-12345.com/api/test')
          .catch(error => console.warn('Expected network error:', error));
      }, 18000);
    };

    triggerFailedRequests();
  }, []);

  return (
    <div className="border border-neutral-300 p-4 bg-white">
      <h3 className="font-medium">Testing Area - Failed Requests</h3>
      <p className="text-sm text-neutral-600 mb-3">
        This component automatically triggers dummy failed network requests for testing the bug reporter.
      </p>
      <div className="space-y-2">
        <button
          onClick={() => {
            fetch('/api/manual-test-404', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ manual: true })
            }).catch(e => console.warn('Manual test 404:', e));
          }}
          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm mr-2"
        >
          Trigger 404 Error
        </button>
        <button
          onClick={() => {
            fetch('/api/manual-test-500', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: 'invalid' })
            }).catch(e => console.warn('Manual test 500:', e));
          }}
          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm mr-2"
        >
          Trigger 500 Error
        </button>
        <button
          onClick={() => {
            fetch('https://httpstat.us/403', {
              method: 'GET',
              headers: { 'X-Test': 'true' }
            }).catch(e => console.warn('Manual test 403:', e));
          }}
          className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm"
        >
          Trigger 403 Error
        </button>
      </div>
      <div className="mt-3 text-xs text-neutral-500">
        💡 These failed requests will be captured and included in bug reports when recording.
      </div>
    </div>
  );
}
