import React, { useEffect } from "react";

export function OAuthCallbackScreen() {
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const query = window.location.search.substring(1);

    function parseParams(str: string) {
      const params: Record<string, string> = {};
      str.split("&").forEach((pair) => {
        const kv = pair.split("=");
        if (kv[0]) params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || "");
      });
      return params;
    }

    function notify(data: any) {
      if (window.opener) {
        try {
          window.opener.postMessage(data, window.location.origin);
        } catch {
          /* ignore */
        }
      }
      try {
        if (typeof BroadcastChannel !== "undefined") {
          const bc = new BroadcastChannel("google_oauth");
          bc.postMessage(data);
          bc.close();
        }
      } catch {
        /* ignore */
      }
      try {
        localStorage.setItem("google_oauth_result", JSON.stringify({ data, time: Date.now() }));
      } catch {
        /* ignore */
      }
      window.close();
    }

    // Implicit flow — token in hash
    if (hash) {
      const p = parseParams(hash);
      if (p.access_token) {
        notify({ type: "GOOGLE_OAUTH_TOKEN", access_token: p.access_token, expires_in: p.expires_in });
        return;
      }
      if (p.error) {
        notify({ type: "GOOGLE_OAUTH_TOKEN", error: p.error });
        return;
      }
    }

    // PKCE / Authorization Code flow — code in query string
    if (query) {
      const q = parseParams(query);
      if (q.code) {
        notify({ type: "GOOGLE_OAUTH_CODE", code: q.code });
        return;
      }
      if (q.error) {
        notify({ type: "GOOGLE_OAUTH_CODE", error: q.error });
        return;
      }
    }
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#111",
        color: "#e0e0e0",
        fontFamily: "-apple-system, sans-serif",
        textAlign: "center",
        padding: 20,
      }}
    >
      <p style={{ fontSize: 15, color: "#8e8e93", lineHeight: 1.5, margin: "0 0 16px" }}>
        로그인이 완료되었습니다.<br />이 창은 자동으로 닫힙니다.
      </p>
      <button
        onClick={() => window.close()}
        style={{
          background: "#007AFF",
          color: "#fff",
          border: "none",
          padding: "8px 18px",
          borderRadius: 8,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        창 닫기
      </button>
    </div>
  );
}

export default OAuthCallbackScreen;
