import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Включва Word шаблона в serverless bundle-а на API route-а,
  // иначе fs.readFileSync хвърля ENOENT на Vercel.
  outputFileTracingIncludes: {
    "/api/protocols/generate": ["./templates/**"],
  },
};

export default nextConfig;
