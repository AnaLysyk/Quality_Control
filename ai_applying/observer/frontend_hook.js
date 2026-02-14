// Hardened observer hook to report frontend telemetry without blocking navigation.
(function () {
  const base = window.AI_APPLYING_OBSERVER_BASE || "/observer";

  function safeStringify(input) {
    try {
      return JSON.stringify(input);
    } catch (err) {
      return JSON.stringify({ error: "serialize_failed" });
    }
  }

  function buildPayload(name, data) {
    return {
      name,
      data,
      ts: Date.now(),
      url: window.location ? window.location.pathname : null,
      ua: navigator && navigator.userAgent ? navigator.userAgent : null,
      session: window.AI_SESSION_ID || null,
    };
  }

  function sendEvent(name, data) {
    const payload = buildPayload(name, data || {});
    let serialized = safeStringify(payload);

    if (serialized.length > 60000) {
      payload.data = { truncated: true };
      serialized = safeStringify(payload);
      if (serialized.length > 60000) {
        serialized = serialized.slice(0, 60000);
      }
      console.warn("aiApplyingObserver: payload truncated due to size");
    }

    const url = `${base.replace(/\/$/, "")}/event`;

    if (navigator && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([serialized], { type: "application/json" });
      const accepted = navigator.sendBeacon(url, blob);
      if (accepted) {
        return;
      }
    }

    try {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: serialized,
        keepalive: true,
      }).catch(() => {
        /* swallow network errors */
      });
    } catch (err) {
      /* swallow fetch setup errors */
    }
  }

  window.aiApplyingObserver = { sendEvent };
})();
