import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProfile } from "./apiClient";

const ACCESS_TOKEN_KEY = "access_token";

export function getAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function useAuthSession() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadProfile() {
      const token = getAccessToken();
      if (!token) {
        if (!ignore) setProfileLoaded(true);
        return;
      }

      try {
        const { response, payload } = await getProfile(token);

        if (!response.ok) {
          clearAccessToken();
          if (!ignore) {
            setProfile(null);
            setAccountOpen(false);
          }
          return;
        }

        if (!ignore) {
          setProfile(payload);
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
    clearAccessToken();
    setProfile(null);
    setAccountOpen(false);
    setProfileLoaded(true);
    navigate("/", { replace: true });
  };

  return {
    profile,
    setProfile,
    profileLoaded,
    accountOpen,
    setAccountOpen,
    logout,
  };
}
