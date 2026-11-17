// Finishes the GitHub OAuth flow: swap the code for an access token,
// then post it back to the Decap CMS window opener so it can commit.
export default async function handler(req, res) {
  const clientId = process.env.OAUTH_GITHUB_CLIENT_ID;
  const clientSecret = process.env.OAUTH_GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    res.status(500).send("OAUTH_GITHUB_CLIENT_ID / _SECRET not configured");
    return;
  }

  const code = req.query.code;
  if (!code) {
    res.status(400).send("Missing code");
    return;
  }

  const content = { provider: "github" };
  let status = "success";

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const data = await tokenRes.json();
    if (data.error || !data.access_token) {
      status = "error";
      content.error = data.error_description || data.error || "No access_token returned";
    } else {
      content.token = data.access_token;
    }
  } catch (err) {
    status = "error";
    content.error = String(err && err.message || err);
  }

  // Decap listens for a window.postMessage of the shape:
  // "authorization:github:<status>:<json payload>"
  const payload = `authorization:github:${status}:${JSON.stringify(content)}`;
  const safePayload = payload.replace(/</g, "\\u003c");

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(`<!doctype html>
<html><body>
<p style="font-family:system-ui;padding:24px">Signing you in…</p>
<script>
(function() {
  function send() {
    if (!window.opener) return;
    window.opener.postMessage(${JSON.stringify(safePayload)}, "*");
  }
  // Decap first posts "authorizing:github" — we reply with the real payload.
  window.addEventListener("message", function (e) {
    if (e.data === "authorizing:github") send();
  }, false);
  // Also fire once in case Decap is already waiting.
  send();
  // Close the popup shortly after.
  setTimeout(function(){ window.close(); }, 1500);
})();
</script>
</body></html>`);
}
