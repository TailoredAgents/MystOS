import { withContentlayer } from "next-contentlayer";

const nextConfig = {
  typedRoutes: true,
  eslint: {
    ignoreDuringBuilds: true
  }
};

export default withContentlayer(nextConfig);

