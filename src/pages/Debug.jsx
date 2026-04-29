import "../styles/debug.css";
import Endpoint from "../components/Endpoint";

export default function Debug() {
  return (
    <div className="container">
      <h1>API Debug</h1>

      <Endpoint method="GET" path="/health" />
      <Endpoint method="GET" path="/db-check" />
      <Endpoint method="POST" path="/digital" />
    </div>
  );
}