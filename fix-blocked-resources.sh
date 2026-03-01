#!/bin/bash

# Configuration
TARGET_FILE=$1
if [ -z "$TARGET_FILE" ]; then
    TARGET_FILE="index.html"
fi

if [ ! -f "$TARGET_FILE" ]; then
    echo "Error: $TARGET_FILE not found!"
    exit 1
fi

echo "--- Production Environment Fixer ---"
echo "Target: $TARGET_FILE"

# 1. REMOVE Tailwind CDN & Config Blocks
# These are redundant with the bundled build and can cause layout shifts or security blocks.
if grep -q "cdn.tailwindcss.com" "$TARGET_FILE"; then
    echo "[Fix] Removing Tailwind CDN and inline config..."
    TMP_HTML=$(mktemp)
    perl -0777 -pe 's/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\s*<script>.*?tailwind\.config.*?<\/script>//gs' "$TARGET_FILE" > "$TMP_HTML"
    mv "$TMP_HTML" "$TARGET_FILE"
    chmod 644 "$TARGET_FILE"
fi

# 2. REMOVE importmap
# Importmaps can conflict with Vite's bundled module resolution in production.
if grep -q "type=\"importmap\"" "$TARGET_FILE"; then
    echo "[Fix] Removing redundant importmap..."
    TMP_HTML=$(mktemp)
    perl -0777 -pe 's/<script type="importmap">.*?<\/script>//gs' "$TARGET_FILE" > "$TMP_HTML"
    mv "$TMP_HTML" "$TARGET_FILE"
    chmod 644 "$TARGET_FILE"
fi

# 3. BLOCK Cloudflare Beacon Injection
# Cloudflare often injects a beacon.min.js which is blocked by ad-blockers, 
# resulting in ERR_BLOCKED_BY_CLIENT. This MutationObserver stops it early.
if ! grep -q "cloudflareinsights" "$TARGET_FILE"; then
    echo "[Fix] Injecting Cloudflare Beacon blocker..."
    # Insert at the top of <head> to be pre-emptive
    sed -i '/<head>/a \
<script data-cfasync="false">\
  (function() {\
    const observer = new MutationObserver((mutations) => {\
      mutations.forEach((mutation) => {\
        mutation.addedNodes.forEach((node) => {\
          if (node.tagName === "SCRIPT" && node.src && node.src.includes("cloudflareinsights.com")) {\
            node.remove();\
          }\
        });\
      });\
    });\
    observer.observe(document.documentElement, { childList: true, subtree: true });\
    window._cf_beacon = { disabled: true };\
    window.cfBeacon = false;\
  })();\
</script>' "$TARGET_FILE"
fi

# 4. PREVENT Rocket Loader Interference
# Cloudflare Rocket Loader can defer script execution, breaking React's hydration/mounting.
# We ensure every <script> has data-cfasync="false" unless it already exists.
# First, add to standard script tags
sed -i 's/<script[^d>]*>/&/g; s/<script/<script data-cfasync="false"/g' "$TARGET_FILE"
# Clean up double injections
sed -i 's/data-cfasync="false" data-cfasync="false"/data-cfasync="false"/g' "$TARGET_FILE"

# 5. MOUNT Debug Health Check (Production-only log)
if ! grep -q "mount-health-check" "$TARGET_FILE"; then
    echo "[Fix] Adding mount health check..."
    sed -i '/<\/body>/i <script data-cfasync="false" id="mount-health-check">setTimeout(()=>{ if(document.getElementById("root").innerHTML==="") { console.error("CRITICAL: React app failed to mount to #root!"); }}, 5000);<\/script>' "$TARGET_FILE"
fi

echo "--- All fixes applied successfully ---"
