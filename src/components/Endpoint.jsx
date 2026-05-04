import { useMemo, useState } from "react";
import { API_URL } from "../utils/apiClient";

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

function buildInitialParams(parameters = []) {
  return parameters.reduce((acc, parameter) => {
    if (parameter.in === "query" || parameter.in === "path") {
      acc[parameter.name] = parameter.schema?.default ?? parameter.example ?? "";
    }
    return acc;
  }, {});
}

function replacePathParams(path, values) {
  return path.replace(/\{([^}]+)\}/g, (_, key) => encodeURIComponent(values[key] || `{${key}}`));
}

export default function Endpoint({ endpoint, token }) {
  const { method, path, summary, parameters = [], bodyTemplate = "", presets = [], authRequired } = endpoint;
  const [open, setOpen] = useState(false);
  const [params, setParams] = useState(() => buildInitialParams(parameters));
  const [body, setBody] = useState(bodyTemplate || "");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState(presets[0]?.code || "");

  const queryParameters = parameters.filter((parameter) => parameter.in === "query");
  const pathParameters = parameters.filter((parameter) => parameter.in === "path");
  const hasBody = !["GET", "DELETE"].includes(method) || bodyTemplate;
  const selectedPresetData = presets.find((preset) => preset.code === selectedPreset);

  const requestUrl = useMemo(() => {
    const resolvedPath = replacePathParams(path, params);
    const url = new URL(`${API_URL}${resolvedPath}`);
    queryParameters.forEach((parameter) => {
      const value = params[parameter.name];
      if (value !== undefined && value !== "") {
        url.searchParams.set(parameter.name, value);
      }
    });
    return url.toString();
  }, [params, path, queryParameters]);

  const run = async () => {
    setOpen(true);
    setData(null);
    setStatus(null);

    try {
      const headers = {};
      if (authRequired && token) headers.Authorization = `Bearer ${token}`;
      if (hasBody && body.trim()) headers["Content-Type"] = "application/json";

      const options = { method, headers };
      if (hasBody && body.trim()) options.body = body;

      const res = await fetch(requestUrl, options);
      const responseHeaders = {};
      res.headers.forEach((v, k) => (responseHeaders[k] = v));

      const contentType = res.headers.get("content-type") || "";
      const responseBody = contentType.includes("application/json")
        ? await res.json().catch(() => null)
        : await res.text();

      setData({
        request: { method, url: requestUrl, auth: authRequired ? "Bearer token" : "none" },
        response: {
          status: res.status,
          statusText: res.statusText,
          headers: responseHeaders,
          body: responseBody,
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
      <button className="endpoint-header" type="button" onClick={() => setOpen((value) => !value)}>
        <span className="endpoint-left">
          <span className={`method ${method}`}>{method}</span>
          <span className="url">{path}</span>
          {summary && <span className="endpoint-summary">{summary}</span>}
        </span>

        <span className="endpoint-right">
          {status && <span className={`status-badge ${isOk ? "ok" : "error"}`}>{status}</span>}
          <span className={`arrow ${open ? "open" : ""}`} aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div className="endpoint-content">
          {(pathParameters.length > 0 || queryParameters.length > 0 || hasBody) && (
            <div className="panel endpoint-emulator">
              <div className="panel-title">Request emulator</div>

              {[...pathParameters, ...queryParameters].map((parameter) => (
                <label className="endpoint-field" key={`${parameter.in}-${parameter.name}`}>
                  <span>{parameter.in}: {parameter.name}{parameter.required ? " *" : ""}</span>
                  <input
                    value={params[parameter.name] ?? ""}
                    onChange={(event) => setParams((current) => ({
                      ...current,
                      [parameter.name]: event.target.value,
                    }))}
                    placeholder={parameter.schema?.type || "value"}
                  />
                </label>
              ))}

              {hasBody && (
                <label className="endpoint-field endpoint-body-field">
                  <span>JSON body</span>
                  <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={7} />
                </label>
              )}

              <button className="endpoint-run" type="button" onClick={run}>Execute request</button>
            </div>
          )}

          {presets.length > 0 && (
            <div className="panel endpoint-presets">
              <div className="panel-title">Prepared responses</div>
              <select value={selectedPreset} onChange={(event) => setSelectedPreset(event.target.value)}>
                {presets.map((preset) => (
                  <option key={preset.code} value={preset.code}>{preset.code} — {preset.label}</option>
                ))}
              </select>
              {selectedPresetData && <pre className="json compact-json">{JSON.stringify(selectedPresetData, null, 2)}</pre>}
            </div>
          )}

          {data && (
            data.error ? (
              <div className="error">{data.error}</div>
            ) : (
              <>
                <div className="panel">
                  <div className="panel-title">Request</div>
                  <KV obj={data.request} />
                </div>

                <div className="panel">
                  <div className="panel-title">Response ({data.response.status} {data.response.statusText})</div>
                  <KV obj={data.response.headers} />
                  <div className="json-wrap"><pre className="json">{JSON.stringify(data.response.body, null, 2)}</pre></div>
                </div>
              </>
            )
          )}
        </div>
      )}
    </div>
  );
}
