"use client";

import { useEffect, useState, type FormEvent } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";

const AUTH_KEY = "pm-authenticated";
const DEMO_USERNAME = "user";
const DEMO_PASSWORD = "password";

export const AuthGate = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem(AUTH_KEY);
    setIsAuthenticated(stored === "true");
  }, []);

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (username === DEMO_USERNAME && password === DEMO_PASSWORD) {
      window.localStorage.setItem(AUTH_KEY, "true");
      setIsAuthenticated(true);
      setError("");
      return;
    }

    setError("Invalid credentials. Use user / password.");
  };

  const handleLogout = () => {
    window.localStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
    setUsername("");
    setPassword("");
    setError("");
  };

  if (!isAuthenticated) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[520px] items-center px-6 py-12">
        <section className="w-full rounded-[32px] border border-[var(--stroke)] bg-white/90 p-8 shadow-[var(--shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
            Project Management MVP
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-[var(--gray-text)]">
            Use the demo credentials to enter the Kanban board.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
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
                placeholder="user"
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
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm font-medium text-red-600">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-xl bg-[var(--secondary-purple)] px-4 py-3 text-sm font-semibold text-white"
            >
              Sign in
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <div>
      <div className="fixed right-6 top-6 z-20">
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full border border-[var(--stroke)] bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] shadow-[var(--shadow)]"
        >
          Logout
        </button>
      </div>
      <KanbanBoard />
    </div>
  );
};
