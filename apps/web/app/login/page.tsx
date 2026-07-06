const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    gap: "2rem",
  },
  heading: {
    fontSize: "2.5rem",
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  subtitle: {
    color: "var(--muted)",
    marginTop: "0.5rem",
  },
  button: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.75rem 2rem",
    borderRadius: "999px",
    background: "var(--accent)",
    color: "#000",
    fontWeight: 600,
    fontSize: "1rem",
    textDecoration: "none",
    transition: "opacity 0.15s",
  },
  error: {
    color: "#e74c3c",
    fontSize: "0.875rem",
    maxWidth: "360px",
    textAlign: "center" as const,
  },
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const errorMessages: Record<string, string> = {
    spotify_denied: "You denied the Spotify authorization request.",
    missing_params: "Invalid response from Spotify.",
    state_mismatch: "Security check failed. Please try again.",
    exchange_failed: "Could not complete authentication with Spotify.",
    userinfo_failed: "Could not retrieve your Spotify profile.",
  };

  const error = searchParams.error
    ? errorMessages[searchParams.error] ?? "An unknown error occurred."
    : null;

  return (
    <main style={styles.container}>
      <style>{".login-btn:hover { opacity: 0.85 !important; }"}</style>

      <div style={{ textAlign: "center" }}>
        <h1 style={styles.heading}>termlyrics</h1>
        <p style={styles.subtitle}>Live, time-synced karaoke lyrics</p>
      </div>

      <a href="/api/auth/login" className="login-btn" style={styles.button}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34c-.24.36-.72.48-1.08.24-2.88-1.68-6.48-2.04-10.68-1.08-.42.12-.84-.12-.96-.54-.12-.42.12-.84.54-.96 4.56-1.08 8.52-.66 11.76 1.2.36.24.48.72.24 1.08zm1.44-3.24c-.3.42-.84.6-1.26.3-3.24-2.04-8.16-2.64-11.76-1.44-.48.18-1.02-.06-1.2-.54-.18-.48.06-1.02.54-1.2 4.2-1.38 9.6-.72 13.32 1.56.42.24.6.78.36 1.2v.12zm.12-3.36c-3.9-2.28-10.32-2.52-14.04-1.38-.54.18-1.08-.12-1.26-.66-.18-.54.12-1.08.66-1.26 4.32-1.32 11.4-1.02 15.84 1.56.48.3.66.96.36 1.44-.3.36-.96.54-1.44.3h-.12z" />
        </svg>
        Login with Spotify
      </a>

      {error && <p style={styles.error}>{error}</p>}
    </main>
  );
}
