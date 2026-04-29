import { useEffect, useState } from "react";
import { request } from "../api/client";

export default function Home() {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    request("/health")
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div>
      <h1>Messenger MVP</h1>
      <p>Backend status: {status}</p>
    </div>
  );
}