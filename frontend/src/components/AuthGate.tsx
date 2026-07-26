"use client";

import { useState, type FormEvent } from "react";
import { BoardWorkspace } from "@/components/BoardWorkspace";
import { getStoredUsername, getToken, login, register } from "@/lib/api";

type Mode = "login" | "register";

export const AuthGate = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => getToken() !== null);
  const [currentUser, setCurrentUser] = useState(() => getStoredUsername() ?? "");
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    if (!username.trim() || !password) {
      setError("Enter a username and password.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const result =
        mode === "login"
          ? await login(username.trim(), password)
          : await register(username.trim(), password);
      setCurrentUser(result.username);
      setIsAuthenticated(true);
      setPassword("");
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Authentication failed.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser("");
    setUsername("");
    setPassword("");
    setError("");
    setMode("login");
  };

  if (isAuthenticated) {
    return <BoardWorkspace username={currentUser} onLogout={handleLogout} />;
  }

  const isLogin = mode === "login";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[520px] items-center px-6 py-12">
      <section className="w-full rounded-[32px] border border-[var(--stroke)] bg-white/90 p-8 shadow-[var(--shadow)]">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
          Project Management
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
          {isLogin ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-2 text-sm text-[var(--gray-text)]">
          {isLogin
            ? "Sign in to manage your Kanban boards."
            : "Register a new account to start managing boards."}
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="username"
              className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]"
            >
              Username
            </label>
            <input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-xl border border-[var(--stroke)] px-4 py-3 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
              placeholder="your-username"
              autoComplete="username"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-[var(--stroke)] px-4 py-3 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
              placeholder="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-[var(--secondary-purple)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Please wait..."
              : isLogin
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-sm text-[var(--gray-text)]">
          {isLogin ? "Need an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(isLogin ? "register" : "login");
              setError("");
            }}
            className="font-semibold text-[var(--primary-blue)] underline-offset-2 hover:underline"
          >
            {isLogin ? "Register" : "Sign in"}
          </button>
        </p>
      </section>
    </main>
  );
};
