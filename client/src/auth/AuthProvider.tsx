import React, { createContext, useContext, useMemo } from "react";
import { Auth0Provider, useAuth0, AppState } from "@auth0/auth0-react";

export interface AuthUser {
  name?: string;
  email?: string;
  sub?: string;
  picture?: string;
}

export interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  loginWithRedirect: (options?: any) => Promise<void>;
  logout: (options?: any) => void;
  getAccessTokenSilently: (options?: any) => Promise<string>;
  isConfigured: boolean;
}

export const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  isLoading: false,
  user: null,
  loginWithRedirect: async () => {},
  logout: () => {},
  getAccessTokenSilently: async () => {
    throw new Error("Auth0 is not configured");
  },
  isConfigured: false,
});

export const useAuth = (): AuthContextValue => useContext(AuthContext);

const Auth0Bridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth0 = useAuth0();

  const user = useMemo<AuthUser | null>(() => {
    if (!auth0.user) return null;
    return {
      name: auth0.user.name || auth0.user.nickname,
      email: auth0.user.email,
      sub: auth0.user.sub,
      picture: auth0.user.picture,
    };
  }, [auth0.user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: auth0.isAuthenticated,
      isLoading: auth0.isLoading,
      user,
      loginWithRedirect: auth0.loginWithRedirect,
      logout: auth0.logout,
      getAccessTokenSilently: auth0.getAccessTokenSilently as (options?: any) => Promise<string>,
      isConfigured: true,
    }),
    [
      auth0.isAuthenticated,
      auth0.isLoading,
      user,
      auth0.loginWithRedirect,
      auth0.logout,
      auth0.getAccessTokenSilently,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const AuthProviderWithHistory: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  const onRedirectCallback = (appState?: AppState) => {
    if (typeof window !== "undefined") {
      const target = appState?.returnTo || window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, target);
    }
  };

  if (!domain || !clientId) {
    const unconfiguredValue: AuthContextValue = {
      isAuthenticated: false,
      isLoading: false,
      user: null,
      loginWithRedirect: async () => {
        console.warn("Auth0 is not configured (missing VITE_AUTH0_DOMAIN or VITE_AUTH0_CLIENT_ID)");
      },
      logout: () => {},
      getAccessTokenSilently: async () => {
        throw new Error("Auth0 is not configured in client environment");
      },
      isConfigured: false,
    };

    return <AuthContext.Provider value={unconfiguredValue}>{children}</AuthContext.Provider>;
  }

  const redirectUri =
    import.meta.env.VITE_AUTH0_REDIRECT_URI ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
        audience: audience || undefined,
        scope: "openid profile email read:investigations create:investigations",
      }}
      onRedirectCallback={onRedirectCallback}
      useRefreshTokens={true}
      cacheLocation="memory"
    >
      <Auth0Bridge>{children}</Auth0Bridge>
    </Auth0Provider>
  );
};
