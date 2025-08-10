// Network request monitoring and logging

export interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  timestamp: number;
  status?: number;
  statusText?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
  error?: string;
  duration?: number;
}

export interface NetworkMonitor {
  start: () => void;
  stop: () => void;
  getFailedRequests: () => NetworkRequest[];
  getAllRequests: () => NetworkRequest[];
  clear: () => void;
}

export function createNetworkMonitor(): NetworkMonitor {
  const requests: NetworkRequest[] = [];
  let isMonitoring = false;
  let originalFetch: typeof fetch;
  let originalXHR: typeof XMLHttpRequest;

  const generateId = () => `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const logRequest = (request: NetworkRequest) => {
    requests.push(request);
    
    // Keep only last 100 requests to avoid memory issues
    if (requests.length > 100) {
      requests.splice(0, requests.length - 100);
    }
  };

  const start = () => {
    if (isMonitoring) return;
    isMonitoring = true;

    // Hook into fetch
    originalFetch = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
      const startTime = Date.now();
      const requestId = generateId();
      
      // Parse request details
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
      const init = args[1] || {};
      const method = init.method || 'GET';
      const headers: Record<string, string> = {};
      
      // Extract headers
      if (init.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((value, key) => {
            headers[key] = value;
          });
        } else if (Array.isArray(init.headers)) {
          init.headers.forEach(([key, value]) => {
            headers[key] = value;
          });
        } else {
          Object.assign(headers, init.headers);
        }
      }

      const requestData: NetworkRequest = {
        id: requestId,
        url,
        method,
        headers,
        body: init.body,
        timestamp: startTime,
      };

      try {
        const response = await originalFetch(...args);
        const endTime = Date.now();
        
        // Extract response headers
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        requestData.status = response.status;
        requestData.statusText = response.statusText;
        requestData.responseHeaders = responseHeaders;
        requestData.duration = endTime - startTime;

        // For failed requests, try to capture response body
        if (!response.ok) {
          try {
            const clone = response.clone();
            const contentType = response.headers.get('content-type') || '';
            
            if (contentType.includes('application/json')) {
              requestData.responseBody = await clone.json();
            } else {
              requestData.responseBody = await clone.text();
            }
          } catch (e) {
            requestData.responseBody = 'Could not read response body';
          }
          
          // Skip console logging for failed requests to avoid circular issues
          // Data is still captured in logRequest() for analysis
        }

        logRequest(requestData);
        return response;
      } catch (error: any) {
        const endTime = Date.now();
        requestData.duration = endTime - startTime;
        requestData.error = error.message || String(error);
        
        // Skip console logging for network errors to avoid circular issues
        // Data is still captured in logRequest() for analysis

        logRequest(requestData);
        throw error;
      }
    };

    // Hook into XMLHttpRequest
    originalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = class extends originalXHR {
      private _url?: string;
      private _method?: string;
      private _requestHeaders: Record<string, string> = {};
      private _requestBody?: any;
      private _startTime?: number;
      private _requestId?: string;

      open(method: string, url: string, async?: boolean, user?: string | null, password?: string | null) {
        this._method = method;
        this._url = url;
        this._requestId = generateId();
        this._startTime = Date.now();
        return super.open(method, url, async ?? true, user, password);
      }

      setRequestHeader(name: string, value: string) {
        this._requestHeaders[name] = value;
        return super.setRequestHeader(name, value);
      }

      send(body?: any) {
        this._requestBody = body;
        
        this.addEventListener('loadend', () => {
          if (!this._url || !this._method || !this._startTime || !this._requestId) return;
          
          const endTime = Date.now();
          const responseHeaders: Record<string, string> = {};
          
          // Parse response headers
          const headerText = this.getAllResponseHeaders();
          if (headerText) {
            headerText.split('\r\n').forEach(line => {
              const parts = line.split(': ');
              if (parts.length === 2) {
                responseHeaders[parts[0]] = parts[1];
              }
            });
          }

          const requestData: NetworkRequest = {
            id: this._requestId,
            url: this._url,
            method: this._method,
            headers: this._requestHeaders,
            body: this._requestBody,
            timestamp: this._startTime,
            status: this.status,
            statusText: this.statusText,
            responseHeaders,
            duration: endTime - this._startTime,
          };

          // For failed requests, capture response
          if (this.status >= 400) {
            try {
              const contentType = this.getResponseHeader('content-type') || '';
              if (contentType.includes('application/json')) {
                requestData.responseBody = JSON.parse(this.responseText);
              } else {
                requestData.responseBody = this.responseText;
              }
            } catch (e) {
              requestData.responseBody = this.responseText;
            }
            
            // Skip console logging for failed XMLHttpRequest to avoid circular issues
            // Data is still captured in logRequest() for analysis
          }

          logRequest(requestData);
        });

        this.addEventListener('error', () => {
          if (!this._url || !this._method || !this._startTime || !this._requestId) return;
          
          const endTime = Date.now();
          const requestData: NetworkRequest = {
            id: this._requestId,
            url: this._url,
            method: this._method,
            headers: this._requestHeaders,
            body: this._requestBody,
            timestamp: this._startTime,
            duration: endTime - this._startTime,
            error: 'XMLHttpRequest error',
          };

          // Skip console logging for XMLHttpRequest errors to avoid circular issues
          // Data is still captured in logRequest() for analysis

          logRequest(requestData);
        });

        return super.send(body);
      }
    };
  };

  const stop = () => {
    if (!isMonitoring) return;
    isMonitoring = false;

    // Restore original implementations
    if (originalFetch) {
      window.fetch = originalFetch;
    }
    if (originalXHR) {
      window.XMLHttpRequest = originalXHR;
    }
  };

  const getFailedRequests = () => {
    return requests.filter(req => 
      (req.status && req.status >= 400) || req.error
    );
  };

  const getAllRequests = () => [...requests];

  const clear = () => {
    requests.length = 0;
  };

  return {
    start,
    stop,
    getFailedRequests,
    getAllRequests,
    clear,
  };
}

// Global network monitor instance
let globalNetworkMonitor: NetworkMonitor | null = null;

export function startNetworkMonitoring(): NetworkMonitor {
  if (globalNetworkMonitor) {
    globalNetworkMonitor.stop();
  }
  
  globalNetworkMonitor = createNetworkMonitor();
  globalNetworkMonitor.start();
  
  console.log('🔍 Network monitoring started');
  return globalNetworkMonitor;
}

export function stopNetworkMonitoring(): NetworkRequest[] {
  if (!globalNetworkMonitor) return [];
  
  const requests = globalNetworkMonitor.getAllRequests();
  globalNetworkMonitor.stop();
  globalNetworkMonitor = null;
  
  console.log('🔍 Network monitoring stopped');
  return requests;
}

export function getNetworkMonitor(): NetworkMonitor | null {
  return globalNetworkMonitor;
}
