FALLBACK_HTML = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Project Management MVP</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 2rem; color: #032147; }
      code { background: #f3f3f3; padding: 0.2rem 0.4rem; border-radius: 4px; }
      #status { color: #888888; margin-top: 0.8rem; }
    </style>
  </head>
  <body>
    <h1>Project Management MVP</h1>
    <p>Backend scaffold is running. API call status:</p>
    <div id="status">Checking <code>/api/hello</code>...</div>
    <script>
      fetch('/api/hello')
        .then((response) => response.json())
        .then((data) => {
          document.getElementById('status').textContent = `API OK: ${data.message}`;
        })
        .catch(() => {
          document.getElementById('status').textContent = 'API check failed';
        });
    </script>
  </body>
</html>
"""
