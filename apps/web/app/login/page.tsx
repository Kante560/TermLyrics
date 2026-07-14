import s from "./login.module.css";

function SpotifyGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34c-.24.36-.72.48-1.08.24-2.88-1.68-6.48-2.04-10.68-1.08-.42.12-.84-.12-.96-.54-.12-.42.12-.84.54-.96 4.56-1.08 8.52-.66 11.76 1.2.36.24.48.72.24 1.08zm1.44-3.24c-.3.42-.84.6-1.26.3-3.24-2.04-8.16-2.64-11.76-1.44-.48.18-1.02-.06-1.2-.54-.18-.48.06-1.02.54-1.2 4.2-1.38 9.6-.72 13.32 1.56.42.24.6.78.36 1.2v.12zm.12-3.36c-3.9-2.28-10.32-2.52-14.04-1.38-.54.18-1.08-.12-1.26-.66-.18-.54.12-1.08.66-1.26 4.32-1.32 11.4-1.02 15.84 1.56.48.3.66.96.36 1.44-.3.36-.96.54-1.44.3h-.12z" />
    </svg>
  );
}

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
    <main className={s.wrap}>
      <div className={s.bg} aria-hidden="true" />
      <div className={s.bgGlow} aria-hidden="true" />

      <div className={s.card}>
        <div className={s.brandMark}>
          <SpotifyGlyph size={30} />
        </div>

        <h1 className={s.title}>Kant_Sing</h1>
        <p className={s.tagline}>Never lost. Every word, on time.</p>

        {error && <p className={s.error}>{error}</p>}

        <a href="/api/auth/login" className={s.primary}>
          <SpotifyGlyph size={20} />
          Continue with Spotify
        </a>

        <a href="/" className={s.secondary}>
          What is Kant_Sing?
        </a>

        <p className={s.fineprint}>
          Login happens on spotify.com — we never see your password.
          <br />
          Works with Spotify Free and Premium.
        </p>
      </div>
    </main>
  );
}
