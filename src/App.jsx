import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { NavLink, Route, Routes, useLocation } from "react-router";

const STORAGE_KEY = "devfinder.saved.v1";
const FavoritesContext = createContext(null);
function safeUser(value) {
  if (
    !value ||
    typeof value.login !== "string" ||
    !/^[\w-]{1,39}$/.test(value.login)
  )
    return null;
  const profile = `https://github.com/${value.login}`;
  if (value.html_url !== profile) return null;
  let avatar = "";
  try {
    const url = new URL(value.avatar_url);
    if (
      url.protocol === "https:" &&
      url.hostname === "avatars.githubusercontent.com"
    )
      avatar = url.href;
  } catch {
    /* Avatar is optional. */
  }
  return { login: value.login, html_url: profile, avatar_url: avatar };
}
function readSaved() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data)
      ? [
          ...new Map(
            data
              .slice(0, 100)
              .map(safeUser)
              .filter(Boolean)
              .map((user) => [user.login.toLowerCase(), user]),
          ).values(),
        ]
      : [];
  } catch {
    return [];
  }
}
export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useState(readSaved);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [favorites]);
  const toggle = (user) =>
    setFavorites((current) =>
      current.some((item) => item.login === user.login)
        ? current.filter((item) => item.login !== user.login)
        : current.length < 100
          ? [...current, user]
          : current,
    );
  return (
    <FavoritesContext.Provider value={{ favorites, toggle }}>
      {storageError && (
        <div className="storage-note" role="status">
          Browser storage is unavailable. Saved people will stay here for this
          visit only.
        </div>
      )}
      {children}
    </FavoritesContext.Provider>
  );
}
function Header() {
  const [open, setOpen] = useState(false);
  const { favorites } = useContext(FavoritesContext);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  return (
    <header className="site-header container">
      <NavLink to="/" className="brand" aria-label="DevFinder home">
        <span className="brand-mark" aria-hidden="true">
          /
        </span>
        DevFinder
      </NavLink>
      <button
        className="df-button menu-toggle"
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen(!open)}
      >
        Menu <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <nav
        id="site-nav"
        className={open ? "site-nav is-open" : "site-nav"}
        aria-label="Main navigation"
      >
        <NavLink to="/" end>
          Search
        </NavLink>
        <NavLink to="/saved">
          Saved <span className="nav-count">{favorites.length}</span>
        </NavLink>
        <NavLink to="/about">About</NavLink>
        <NavLink to="/contact">Contact</NavLink>
      </nav>
    </header>
  );
}
function RouteFocus() {
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.querySelector("main h1")?.focus();
  }, [pathname]);
  return null;
}
function PageHeading({ title, children }) {
  return (
    <div className="page-heading">
      <h1 tabIndex={-1}>{title}</h1>
      <p className="lead">{children}</p>
    </div>
  );
}
function Avatar({ user }) {
  const [failed, setFailed] = useState(false);
  return user.avatar_url && !failed ? (
    <img
      className="avatar"
      src={user.avatar_url}
      alt=""
      loading="lazy"
      width="52"
      height="52"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="avatar avatar-fallback" aria-hidden="true">
      {user.login.slice(0, 2).toUpperCase()}
    </span>
  );
}
function UserCard({ user }) {
  const { favorites, toggle } = useContext(FavoritesContext);
  const saved = favorites.some((item) => item.login === user.login);
  const full = !saved && favorites.length >= 100;
  return (
    <div className="col-sm-6 col-xl-4">
      <article className="developer-card">
        <div className="person">
          <Avatar user={user} />
          <div>
            <h3>
              <a href={user.html_url} target="_blank" rel="noreferrer">
                {user.login}
                <span className="external-icon" aria-hidden="true">
                  /
                </span>
              </a>
            </h3>
            <p>GitHub profile</p>
          </div>
        </div>
        <button
          className="df-button save-button"
          onClick={() => toggle(user)}
          aria-pressed={saved}
          disabled={full}
          aria-label={`${saved ? "Remove" : full ? "Saved list full for" : "Save"} ${user.login}`}
        >
          {saved ? "Remove" : full ? "Saved list full" : "Save"}
        </button>
      </article>
    </div>
  );
}
function StatePanel({ title, children, error = false }) {
  return (
    <div
      className={`state-panel${error ? " state-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      <span className="state-symbol" aria-hidden="true">
        {error ? "!" : "/"}
      </span>
      <div>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
export function SearchPage() {
  const [query, setQuery] = useState("");
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState({
    status: "initial",
    users: [],
    total: 0,
  });
  const sequence = useRef(0);
  useEffect(() => {
    const id = ++sequence.current;
    const controller = new AbortController();
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResult({ status: "initial", users: [], total: 0 });
      return () => controller.abort();
    }
    setResult({ status: "waiting", users: [], total: 0 });
    const timer = setTimeout(async () => {
      setResult({ status: "loading", users: [], total: 0 });
      try {
        const response = await fetch(
          `https://api.github.com/search/users?q=${encodeURIComponent(trimmed)}&per_page=12`,
          {
            signal: controller.signal,
            headers: { Accept: "application/vnd.github+json" },
          },
        );
        if (!response.ok) {
          const error = new Error("Request failed");
          error.status = response.status;
          throw error;
        }
        const data = await response.json();
        if (!Array.isArray(data.items) || !Number.isFinite(data.total_count))
          throw new Error("Unexpected response");
        if (id === sequence.current && !controller.signal.aborted)
          setResult({
            status: "success",
            users: data.items.map(safeUser).filter(Boolean),
            total: data.total_count,
          });
      } catch (error) {
        if (id !== sequence.current || controller.signal.aborted) return;
        setResult({
          status:
            error.status === 403 || error.status === 429
              ? "limited"
              : navigator.onLine === false
                ? "offline"
                : "error",
          users: [],
          total: 0,
        });
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, retry]);
  const loading = ["waiting", "loading"].includes(result.status);
  const errors = {
    limited: [
      "GitHub is limiting requests",
      "The public API has a shared request limit. Wait a little, then try again.",
    ],
    offline: [
      "You appear to be offline",
      "Reconnect to the internet, then retry your search.",
    ],
    error: [
      "We couldn’t load people",
      "GitHub may be unavailable. Please try again.",
    ],
  };
  return (
    <>
      <PageHeading title="Find your next connection.">
        Explore people on GitHub. Keep a shortlist of developers you’d like to
        know better.
      </PageHeading>
      <section className="search-section" aria-label="Developer search">
        <label htmlFor="developer-search">Search GitHub people</label>
        <div className="search-control">
          <span aria-hidden="true">⌕</span>
          <input
            id="developer-search"
            className="form-control"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Username, location, or language…"
            aria-describedby="search-help"
            autoComplete="off"
            maxLength={200}
          />
        </div>
        <div className="search-meta">
          <p id="search-help">
            Start with 2 characters. Results update as you type.
          </p>
          <span>Public GitHub data</span>
        </div>
      </section>
      <section
        className="results-section"
        aria-label="Search results"
        aria-busy={loading}
      >
        {result.status === "initial" && (
          <StatePanel title="Good people start with a search.">
            <p>
              Try a username or{" "}
              <button
                className="text-button"
                onClick={() => setQuery("location:bangalore")}
              >
                location:bangalore
              </button>
              . Save a profile to find it here again.
            </p>
          </StatePanel>
        )}
        {loading && (
          <StatePanel
            title={
              result.status === "waiting"
                ? "Preparing your search…"
                : "Searching GitHub…"
            }
          >
            <p>Finding public profiles that match your query.</p>
          </StatePanel>
        )}
        {errors[result.status] && (
          <StatePanel title={errors[result.status][0]} error>
            <p>{errors[result.status][1]}</p>
            <button
              className="df-button"
              onClick={() => setRetry((value) => value + 1)}
            >
              Retry search
            </button>
          </StatePanel>
        )}
        {result.status === "success" && (
          <>
            <div className="results-heading">
              <h2>People</h2>
              <p role="status">
                <span className="num">{result.total.toLocaleString()}</span>{" "}
                results · showing {result.users.length}
              </p>
            </div>
            {result.users.length ? (
              <div className="row g-3">
                {result.users.map((user) => (
                  <UserCard key={user.login} user={user} />
                ))}
              </div>
            ) : (
              <StatePanel title="No people found">
                <p>Try a different username or a broader location.</p>
              </StatePanel>
            )}
          </>
        )}
      </section>
    </>
  );
}
function SavedPage() {
  const { favorites } = useContext(FavoritesContext);
  return (
    <>
      <PageHeading title="Your people, in one place.">
        A small list of profiles worth coming back to. Saved in this browser, up
        to 100 people.
      </PageHeading>
      {favorites.length ? (
        <>
          <div className="results-heading">
            <h2>Saved people</h2>
            <p>{favorites.length} saved</p>
          </div>
          <div className="row g-3">
            {favorites.map((user) => (
              <UserCard key={user.login} user={user} />
            ))}
          </div>
        </>
      ) : (
        <StatePanel title="Your shortlist is ready.">
          <p>
            <NavLink to="/">Search GitHub</NavLink> and save a person to begin.
          </p>
        </StatePanel>
      )}
    </>
  );
}
function AboutPage() {
  return (
    <>
      <PageHeading title="Built for a little discovery.">
        DevFinder makes GitHub’s public people search a calmer place to explore.
      </PageHeading>
      <div className="row g-4 about-grid">
        <section className="col-md-6">
          <h2>Real profiles. A direct connection.</h2>
          <p>
            Search by username, or use GitHub qualifiers such as
            location:berlin. Every profile opens on GitHub, where you can see
            the person’s own work and details.
          </p>
        </section>
        <section className="col-md-6">
          <h2>A shortlist that stays with you.</h2>
          <p>
            Save people as you explore. Your list stays in this browser when
            storage is available. There’s no account, sync, or private GitHub
            access.
          </p>
        </section>
      </div>
      <aside className="data-note">
        <h2>A note about the data</h2>
        <p>
          Results come from GitHub’s public API. Availability, ordering, and
          request limits are controlled by GitHub. Search results are not
          endorsements. No GitHub token is required or stored.
        </p>
        <a
          href="https://docs.github.com/en/rest/search/search#search-users"
          target="_blank"
          rel="noreferrer"
        >
          Read GitHub’s search documentation
        </a>
      </aside>
    </>
  );
}
function ContactPage() {
  const [values, setValues] = useState({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);
  function submit(event) {
    event.preventDefault();
    const next = {};
    if (values.name.trim().length < 2)
      next.name = "Enter a name with at least 2 characters.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
      next.email = "Enter a valid email address.";
    if (values.message.trim().length < 10)
      next.message = "Write at least 10 characters.";
    setErrors(next);
    setDone(!Object.keys(next).length);
  }
  return (
    <>
      <PageHeading title="Have something in mind?">
        Try the contact form. This is a demo: your details stay in this page and
        nothing is sent.
      </PageHeading>
      <form className="contact-form" noValidate onSubmit={submit}>
        {[
          ["name", "Your name", "text"],
          ["email", "Email address", "email"],
          ["message", "Message", "textarea"],
        ].map(([key, label, type]) => (
          <div className="field" key={key}>
            <label htmlFor={key}>{label}</label>
            {type === "textarea" ? (
              <textarea
                id={key}
                className="form-control"
                rows={5}
                maxLength={2000}
                required
                value={values[key]}
                aria-invalid={!!errors[key]}
                aria-describedby={errors[key] ? `${key}-error` : undefined}
                onChange={(event) => {
                  setValues({ ...values, [key]: event.target.value });
                  setDone(false);
                }}
              />
            ) : (
              <input
                id={key}
                className="form-control"
                type={type}
                autoComplete={key}
                maxLength={key === "name" ? 100 : 254}
                required
                value={values[key]}
                aria-invalid={!!errors[key]}
                aria-describedby={errors[key] ? `${key}-error` : undefined}
                onChange={(event) => {
                  setValues({ ...values, [key]: event.target.value });
                  setDone(false);
                }}
              />
            )}
            {errors[key] && (
              <p className="field-error" id={`${key}-error`} role="alert">
                {errors[key]}
              </p>
            )}
          </div>
        ))}
        <button className="df-button primary-button" type="submit">
          Check message
        </button>
        {done && (
          <p className="form-success" role="status">
            Your form looks good. This is a demo, so nothing was sent.
          </p>
        )}
      </form>
    </>
  );
}
export function App() {
  return (
    <FavoritesProvider>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Header />
      <RouteFocus />
      <main className="container app-main" id="main-content">
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/saved" element={<SavedPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route
            path="*"
            element={
              <>
                <PageHeading title="This page wandered off.">
                  Find your way back to the people.
                </PageHeading>
                <NavLink to="/">Back to search</NavLink>
              </>
            }
          />
        </Routes>
      </main>
      <footer className="container site-footer">
        <span>
          DevFinder <span aria-hidden="true">/</span> People behind the code.
        </span>
        <a href="https://github.com" target="_blank" rel="noreferrer">
          Powered by GitHub’s public API
        </a>
      </footer>
    </FavoritesProvider>
  );
}
