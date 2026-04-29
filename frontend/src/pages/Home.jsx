import { useEffect, useState } from "react";
import { request } from "../api/client";
import StatusBox from "../components/StatusBox";

export default function Home() {
  const [status, setStatus] = useState("loading...");
  const [error, setError] = useState(null);

  useEffect(() => {
    request("/debug")
      .then((data) => setStatus(data.status))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Messenger MVP</h1>

      {error ? (
        <p style={{ color: "red" }}>Error: {error}</p>
      ) : (
        <StatusBox status={status} />
      )}
    </div>
  );
}