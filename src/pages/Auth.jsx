import AuthForm from "../components/AuthForm";
import AuthIntro from "../components/AuthIntro";
import "../styles/auth.css";

export default function Auth({
  mode,
  status,
  submitting,
  t,
  projectName,
  onModeChange,
  onSubmit,
}) {
  return (
    <>
      <AuthIntro t={t} projectName={projectName} />
      <AuthForm
        t={t}
        mode={mode}
        status={status}
        submitting={submitting}
        onModeChange={onModeChange}
        onSubmit={onSubmit}
      />
    </>
  );
}
