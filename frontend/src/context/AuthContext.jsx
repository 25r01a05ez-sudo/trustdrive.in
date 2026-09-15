import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("td_token"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me(token)
      .then(({ user }) => setUser(user))
      .catch(() => {
        setToken(null);
        localStorage.removeItem("td_token");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const login = async (email, password) => {
    const { token, user } = await api.login({ email, password });
    localStorage.setItem("td_token", token);
    setToken(token);
    setUser(user);
    return user;
  };

  const signup = async (payload) => {
    const { token, user } = await api.signup(payload);
    localStorage.setItem("td_token", token);
    setToken(token);
    setUser(user);
    return user;
  };

  /**
   * Step 1 of OTP flow.
   * Validates credentials on the server and triggers OTP email.
   * @param {{ mode: "login"|"signup", email, password, name?, phone?, role? }} payload
   * @returns {{ email: string }} — the email the OTP was sent to
   */
  const sendOtp = async (payload) => {
    return api.sendOtp(payload);
  };

  /**
   * Step 2 of OTP flow.
   * Verifies the OTP and, on success, stores the JWT and hydrates the user.
   * @param {{ mode: "login"|"signup", email: string, otp: string }} payload
   * @returns {object} user
   */
  const verifyOtp = async (payload) => {
    const { token: newToken, user: newUser } = await api.verifyOtp(payload);
    localStorage.setItem("td_token", newToken);
    setToken(newToken);
    setUser(newUser);
    return newUser;
  };

  const logout = () => {
    localStorage.removeItem("td_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ token, user, loading, login, signup, sendOtp, verifyOtp, logout, getToken: async () => token }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
