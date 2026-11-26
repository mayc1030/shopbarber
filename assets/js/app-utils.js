// =========================================================================
// UTILIDADES COMPARTIDAS (Seguridad XSS, URLs, Fechas Locales y Horarios)
// =========================================================================
(function () {
  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sanitizeUrl(url, fallback = "#", options = {}) {
    if (!url || typeof url !== "string") return fallback;
    const trimmed = url.trim();
    if (!trimmed) return fallback;

    if (trimmed.startsWith("/")) return trimmed;
    if (options.allowDataImage && /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(trimmed)) {
      return trimmed;
    }

    const candidate = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? `https://${trimmed}` : trimmed);

    try {
      const parsed = new URL(candidate, window.location.origin);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.href;
      }
    } catch (_) {}
    return fallback;
  }

  function getLocalDateStr(dateObj = new Date()) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getLocalDateOffset(days = 0) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return getLocalDateStr(d);
  }

  function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = String(timeStr).split(":");
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
  }

  function minutesToTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  }

  function formatPrice(amount) {
    return Number(amount || 0).toLocaleString("es-CO");
  }

  function parseClosedDays(raw) {
    if (!raw) return [0];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
      }
    } catch (_) {}
    return [0];
  }

  window.AppUtils = {
    escapeHtml,
    sanitizeUrl,
    getLocalDateStr,
    getLocalDateOffset,
    timeToMinutes,
    minutesToTime,
    formatPrice,
    parseClosedDays
  };
})();
