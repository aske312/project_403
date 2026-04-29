import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

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
      const res = await fetch(`${API_URL}${path}`, {
        method,
      });

      const headers = {};
      res.headers.forEach((v, k) => (headers[k] = v));

      const body = await res.json();

      const result = {
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
      };

      setData(result);
      setStatus(res.status);

    } catch (e) {
      setData({ error: e.message });
      setStatus("ERR");
    }
  };

  const isOk = typeof status === "number" && status >= 200 && status < 300;

  return (
    <div className="endpoint">

      {/* HEADER */}
      <div className="endpoint-header" onClick={run}>

        <div className="endpoint-left">
          <span className={`method ${method}`}>{method}</span>
          <span className="url">{path}</span>
        </div>

        <div className="endpoint-right">
          {status && (
            <span className={`status-badge ${isOk ? "ok" : "error"}`}>
              {status}
            </span>
          )}

          <span className={`arrow ${open ? "open" : ""}`}>▶</span>
        </div>

      </div>

      {/* CONTENT */}
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

                <div style={{ marginTop: 10 }}>
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