import "../styles/debug.css";
import Endpoint from "../components/Endpoint";

export default function Debug() {
  return (
    <div className="container">
      <h1>API Debug</h1>
      <Endpoint method="GET" path="/api/debug/check" />
      <Endpoint method="POST" path="/api/debug/check" />
      <Endpoint method="PUT" path="/api/debug/check" />
      <Endpoint method="PATCH" path="/api/debug/check" />
      <Endpoint method="DELETE" path="/api/debug/check" />

      <Endpoint method="GET" path="/api/db/check_connect" />
    </div>
  );
}