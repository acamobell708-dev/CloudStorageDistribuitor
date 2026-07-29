import { useEffect, useMemo, useState } from "react";
import { AuthApiClient } from "../auth/AuthApiClient";
import { Icon } from "../components/Icon";

export function LoginApp() {
  const apiClient = useMemo(() => new AuthApiClient(), []);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hintVisible, setHintVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState({
    state: "idle"
  });
  const [username, setUsername] = useState("");
  const working = status.state === "working";

  useEffect(() => {
    let active = true;

    apiClient
      .getSession()
      .then((result) => {
        if (result.authenticated) {
          window.location.replace("/");
          return;
        }

        if (active) {
          setCheckingSession(false);
        }
      })
      .catch(() => {
        if (active) {
          setCheckingSession(false);
        }
      });

    return () => {
      active = false;
    };
  }, [apiClient]);

  async function submitLogin(event) {
    event.preventDefault();
    setStatus({
      message: "Checking your details…",
      state: "working"
    });

    try {
      const result = await apiClient.login({
        password,
        username
      });

      setStatus({
        message: `${result.message}. Redirecting…`,
        state: "success"
      });
      window.location.assign("/?login=accepted");
    } catch (error) {
      setStatus({
        message: error.message,
        state: "error"
      });
    }
  }

  async function continueAsGuest() {
    setStatus({
      message: "Starting guest access…",
      state: "working"
    });

    try {
      await apiClient.loginAsGuest();
      window.location.assign("/?login=guest");
    } catch (error) {
      setStatus({
        message: error.message,
        state: "error"
      });
    }
  }

  return (
    <main className="login-page">
      <a className="login-brand" href="/login.html">
        <span className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span>
          CLOUD<span>PORT</span>
        </span>
      </a>

      <section className="login-shell">
        <div className="member-login">
          <span className="section-kicker">
            <span />
            Secure workspace
          </span>
          <h1>Welcome back</h1>
          <p className="login-intro">
            Sign in to upload and manage files across your connected storage
            providers.
          </p>

          <form onSubmit={submitLogin}>
            <label>
              <span>Username</span>
              <span className="login-input">
                <Icon name="user" size={17} />
                <input
                  autoComplete="username"
                  disabled={working || checkingSession}
                  maxLength="64"
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Enter your username"
                  required
                  type="text"
                  value={username}
                />
              </span>
            </label>

            <label>
              <span>Password</span>
              <span className="login-input">
                <Icon name="lock" size={16} />
                <input
                  autoComplete="current-password"
                  disabled={working || checkingSession}
                  maxLength="256"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                  type="password"
                  value={password}
                />
              </span>
            </label>

            <button
              className="login-submit"
              disabled={working || checkingSession}
              type="submit"
            >
              {working ? "Signing in…" : "Submit"}
              <Icon name="chevron" size={16} />
            </button>
          </form>

          <button
            aria-expanded={hintVisible}
            className="hint-button"
            onClick={() => setHintVisible((current) => !current)}
            type="button"
          >
            <Icon name="help" size={16} />
            Password hint
          </button>

          {hintVisible && (
            <div className="login-hint" role="status">
              Use the format: &lt;Name&gt; + &lt;@&gt; +
              &lt;houseNumber&gt;
            </div>
          )}

          {status.state !== "idle" && (
            <div
              className={`login-feedback is-${status.state}`}
              role={status.state === "error" ? "alert" : "status"}
            >
              <Icon
                name={status.state === "error" ? "warning" : "check"}
                size={16}
              />
              {status.message}
            </div>
          )}
        </div>

        <aside className="guest-login">
          <span className="guest-icon">
            <Icon name="eye" size={25} />
          </span>
          <span className="eyebrow">Read-only access</span>
          <h2>Continue as a guest</h2>
          <p>
            Explore Home and Dashboard without access to cloud files or
            storage operations.
          </p>
          <ul>
            <li>
              <Icon name="check" size={15} />
              View Home and Dashboard
            </li>
            <li>
              <Icon name="lock" size={14} />
              No uploads, downloads, or deletions
            </li>
            <li>
              <Icon name="lock" size={14} />
              Manage Files remains unavailable
            </li>
          </ul>
          <button
            className="guest-login-button"
            disabled={working || checkingSession}
            onClick={continueAsGuest}
            type="button"
          >
            Continue as guest
          </button>
        </aside>
      </section>
    </main>
  );
}
