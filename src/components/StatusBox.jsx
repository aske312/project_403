export default function StatusBox({ status }) {
  return (
    <div style={{
      padding: "10px",
      border: "1px solid #ccc",
      borderRadius: "8px",
      marginTop: "10px"
    }}>
      <h3>Backend status</h3>
      <p>{status}</p>
    </div>
  );
}