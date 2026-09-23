import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // imagen de Docker mínima (server.js + dependencias usadas)
};

export default nextConfig;
