const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
export default {
  async rewrites() { return [{ source: "/", destination: "/index.html" }, { source: "/admin", destination: "/admin.html" }]; },
  async headers() { return [{ source: "/:path*", headers: [
    { key: "Content-Security-Policy", value: csp }, { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "same-origin" }, { key: "X-Frame-Options", value: "DENY" }] }]; },
};
