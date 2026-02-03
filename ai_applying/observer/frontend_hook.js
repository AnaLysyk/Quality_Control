// Minimal frontend observer hook example
// Include this script in your web app to send simple events to the observer endpoint.
(function () {
  const base = window.AI_APPLYING_OBSERVER_BASE || "/observer";
  function sendEvent(name, data) {
    try {
      navigator.sendBeacon(base + "/event", JSON.stringify({ name, data, ts: Date.now() }));
    } catch {
      fetch(base + "/event", { method: "POST", body: JSON.stringify({ name, data, ts: Date.now() }), headers: { 'Content-Type': 'application/json' } });
    }
  }
  window.aiApplyingObserver = { sendEvent };
})();
