import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { AuthApiClient } from "./AuthApiClient";

const AuthSessionContext = createContext();

export function AuthSessionProvider({
  children,
  requiredPermission
}) {
  const client = useMemo(() => new AuthApiClient(), []);
  const [state, setState] = useState({
    loading: true,
    user: undefined
  });
  const permitted =
    !requiredPermission ||
    state.user?.permissions.includes(requiredPermission);

  useEffect(() => {
    let active = true;

    client
      .getSession()
      .then((result) => {
        if (active) {
          setState({
            error: undefined,
            loading: false,
            user: result.authenticated ? result.user : undefined
          });
        }
      })
      .catch((error) => {
        if (active) {
          setState({
            error: error.message,
            loading: false,
            user: undefined
          });
        }
      });

    return () => {
      active = false;
    };
  }, [client]);

  useEffect(() => {
    if (state.loading) {
      return;
    }

    if (!state.user) {
      window.location.replace("/login.html");
      return;
    }

    if (!permitted) {
      window.location.replace("/?access=denied");
    }
  }, [permitted, state.loading, state.user]);

  const value = useMemo(
    () => ({
      hasPermission: (permission) =>
        Boolean(state.user?.permissions.includes(permission)),
      logout: async () => {
        try {
          await client.logout();
        } finally {
          window.location.replace("/login.html");
        }
      },
      user: state.user
    }),
    [client, state.user]
  );

  if (state.loading || !state.user || !permitted) {
    return (
      <div className="session-loading" role="status">
        <span className="loading-spinner" />
        <strong>
          {state.loading ? "Checking your session…" : "Redirecting…"}
        </strong>
      </div>
    );
  }

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  const value = useContext(AuthSessionContext);

  if (!value) {
    throw new Error(
      "useAuthSession must be used inside AuthSessionProvider"
    );
  }

  return value;
}
