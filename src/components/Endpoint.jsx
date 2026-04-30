import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function KV({ obj }) {
  return (
    <div className="kv">
      {Object.entries(obj).map(([k, v]) => (
        <div key={k} className="kv-row">
          <span className="kv-key">{k}</span>
          <span className="kv-value">{String(v)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Endpoint({ method, path }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(null);

  const run = async () => {
    const isOpening = !open;
    setOpen(isOpening);

    if (data) return;

    try {
      const res = await fetch(`${API_URL}${path}`, { method });
      const headers = {};
      res.headers.forEach((v, k) => (headers[k] = v));

      const contentType = res.headers.get("content-type") || "";
      const body = contentType.includes("application/json")
        ? await res.json()
        : await res.text();

      setData({
        request: {
          method,
          url: `${API_URL}${path}`,
        },
        response: {
          status: res.status,
          statusText: res.statusText,
          headers,
          body,
        },
      });
      setStatus(res.status);
    } catch (e) {
      setData({ error: e.message });
      setStatus("ERR");
    }
  };

  const isOk = typeof status === "number" && status >= 200 && status < 300;

  return (
    <div className="endpoint">
      <button className="endpoint-header" type="button" onClick={run}>
        <span className="endpoint-left">
          <span className={`method ${method}`}>{method}</span>
          <span className="url">{path}</span>
        </span>

        <span className="endpoint-right">
          {status && (
            <span className={`status-badge ${isOk ? "ok" : "error"}`}>
              {status}
            </span>
          )}

          <span className={`arrow ${open ? "open" : ""}`} aria-hidden="true" />
        </span>
      </button>

      {open && data && (
        <div className="endpoint-content">
          {data.error ? (
            <div className="error">{data.error}</div>
          ) : (
            <>
              <div className="panel">
                <div className="panel-title">Request</div>
                <KV obj={data.request} />
              </div>

              <div className="panel">
                <div className="panel-title">
                  Response ({data.response.status} {data.response.statusText})
                </div>

                <KV obj={data.response.headers} />

                <div className="json-wrap">
                  <pre className="json">
                    {JSON.stringify(data.response.body, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
