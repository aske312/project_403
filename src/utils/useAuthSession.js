import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProfile } from "./apiClient";

const ACCESS_TOKEN_KEY = "access_token";
const SESSION_EXPIRED_KEY = "session_expired";

export function getAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token) {
  window.sessionStorage.removeItem(SESSION_EXPIRED_KEY);
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

function markSessionExpired() {
  window.sessionStorage.setItem(SESSION_EXPIRED_KEY, "1");
}

function consumeSessionExpired() {
  const value = window.sessionStorage.getItem(SESSION_EXPIRED_KEY) === "1";
  window.sessionStorage.removeItem(SESSION_EXPIRED_KEY);
  return value;
}

export function useAuthSession() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadProfile() {
      const token = getAccessToken();
      if (!token) {
        if (!ignore) {
          setSessionExpired(consumeSessionExpired());
          setProfileLoaded(true);
        }
        return;
      }

      try {
        const { response, payload } = await getProfile(token);

        if (!response.ok) {
          clearAccessToken();
          if (response.status === 401) {
            markSessionExpired();
          }

          if (!ignore) {
            setProfile(null);
            setAccountOpen(false);
            setSessionExpired(response.status === 401);
          }
          return;
        }

        if (!ignore) {
          setProfile(payload);
          setSessionExpired(false);
        }
      } catch {
        if (!ignore) {
          setProfile(null);
        }
      } finally {
        if (!ignore) {
          setProfileLoaded(true);
        }
      }
    }

    loadProfile();

    return () => {
      ignore = true;
    };
  }, []);

  const logout = () => {
    window.sessionStorage.removeItem(SESSION_EXPIRED_KEY);
    clearAccessToken();
    setProfile(null);
    setAccountOpen(false);
    setProfileLoaded(true);
    setSessionExpired(false);
    navigate("/", { replace: true });
  };

  return {
    profile,
    setProfile,
    profileLoaded,
    sessionExpired,
    setSessionExpired,
    accountOpen,
    setAccountOpen,
    logout,
  };
}
