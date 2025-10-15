import { withContentlayer } from "next-contentlayer";
import { config as loadEnv } from "dotenv";
import { join } from "path";

loadEnv({ path: join(process.cwd(), ".env.local") });
loadEnv({ path: join(process.cwd(), ".env") });
loadEnv({ path: join(process.cwd(), "..", "..", ".env") });

const nextConfig = {
  typedRoutes: true
};

export default withContentlayer(nextConfig);

