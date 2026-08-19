import { useState } from "react";
import { Modal } from "./Modal";
import { useAuth } from "../auth/AuthContext";

export function SignInModal({ onClose, notify }: { onClose(): void; notify(message: string): void }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) return setError("Enter your email and password.");
    setSubmitting(true); setError(null);
    const result = await signIn(email.trim(), password);
    setSubmitting(false);
    if (result.ok) { notify("Signed in."); onClose(); return; }
    setError(result.reason === "not-provisioned" ? "This account isn't set up for a venue yet. Contact your manager." : "Incorrect email or password.");
  };

  return <Modal title="Sign In" onClose={onClose}>
    <form className="field" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <label className="field"><span>Email</span><input type="email" autoFocus value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" /></label>
      <label className="field"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
      {error && <p className="inline-alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button type="submit" className="button primary" disabled={submitting}>{submitting ? "Signing in…" : "Sign In"}</button></div>
    </form>
  </Modal>;
}
