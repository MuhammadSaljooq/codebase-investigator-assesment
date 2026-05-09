/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  // Keep dev/build artifacts separate so local dev isn't corrupted
  // when build commands run in parallel (e.g. CI checks while dev server is up).
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next"
};

export default nextConfig;
