// Starts the GitHub OAuth flow for Decap CMS.
// Visitor is redirected to GitHub, approves access, and GitHub redirects
// back to /api/callback with a short-lived code.
export default function handler(req, res) {
  const clientId = process.env.OAUTH_GITHUB_CLIENT_ID;
  if (!clientId) {
    res.status(500).send("OAUTH_GITHUB_CLIENT_ID is not configured");
    return;
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const redirectUri = `${proto}://${host}/api/callback`;

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "repo,user");
  // A random state protects against CSRF; Decap doesn't verify it,
  // but we still generate one for GitHub's sake.
  url.searchParams.set("state", Math.random().toString(36).slice(2));

  res.writeHead(302, { Location: url.toString() });
  res.end();
}
