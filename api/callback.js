// Finishes the GitHub OAuth flow for Decap CMS.
// Swap the ?code=... for an access token, then hand the token back to the
// opener window (/admin) via postMessage in the exact shape Decap waits for.
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

  let content = { provider: "github" };
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
      content = { ...content, error: { message: data.error_description || data.error || "No access_token returned" } };
    } else {
      content.token = data.access_token;
    }
  } catch (err) {
    status = "error";
    content = { ...content, error: { message: String((err && err.message) || err) } };
  }

  // Payload format Decap listens for: "authorization:github:<status>:<json>"
  const message = `authorization:github:${status}:${JSON.stringify(content)}`;
  // Pass the payload as a safe JSON string to the inline script.
  const jsonMessage = JSON.stringify(message);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(`<!doctype html>
<html>
<head><meta charset="utf-8"><title>Signing you in…</title></head>
<body style="font-family:system-ui;padding:24px;color:#14263F">
<p>Signing you in…</p>
<script>
(function() {
  var message = ${jsonMessage};
  var allowed = ["https://www.geoffreybrogniet.com", "https://geoffreybrogniet.com"];

  function receiveMessage(e) {
    // Decap first sends a handshake: "authorizing:github"
    if (e.data !== "authorizing:github") return;
    var target = (allowed.indexOf(e.origin) !== -1) ? e.origin : "*";
    e.source.postMessage(message, target);
  }

  window.addEventListener("message", receiveMessage, false);

  // Nudge the opener to start the handshake.
  if (window.opener) {
    try { window.opener.postMessage("authorizing:github", "*"); } catch (err) {}
  }

  // Safety: close the popup after a short delay even if the handshake
  // never reaches us (opener will have received the token already).
  setTimeout(function () {
    try { window.close(); } catch (err) {}
  }, 3000);
})();
</script>
</body>
</html>`);
}
