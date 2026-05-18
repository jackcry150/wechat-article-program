import * as os from "node:os";
import type { NextConfig } from "next";

function getLanHosts(): string[] {
  const hosts = new Set<string>([
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "*.localhost",
    os.hostname(),
    `${os.hostname()}.local`,
    // 常见局域网网段。Next 的 allowedDevOrigins 支持 * 匹配单段域名/IP 段。
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
  ]);

  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const item of interfaces ?? []) {
      if (item.family === "IPv4" && !item.internal) {
        hosts.add(item.address);
      }
    }
  }

  const extraHosts = process.env.NEXT_ALLOWED_DEV_ORIGINS
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];

  for (const host of extraHosts) {
    hosts.add(host.replace(/^https?:\/\//, "").replace(/:\d+$/, ""));
  }

  return Array.from(hosts);
}

function getServerActionOrigins(hosts: string[]): string[] {
  const port = process.env.PORT || "3000";
  const origins = new Set<string>();

  for (const host of hosts) {
    // Server Actions 校验的是 URL.host，包含端口；通配网段保留无端口版本用于反向代理场景。
    origins.add(host);
    if (!host.includes(":")) {
      origins.add(`${host}:${port}`);
    }
  }

  const extraOrigins = process.env.NEXT_SERVER_ACTION_ORIGINS
    ?.split(",")
    .map((item) => item.trim().replace(/^https?:\/\//, ""))
    .filter(Boolean) ?? [];

  for (const origin of extraOrigins) {
    origins.add(origin);
  }

  return Array.from(origins);
}

const lanHosts = getLanHosts();

const nextConfig: NextConfig = {
  allowedDevOrigins: lanHosts,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
      allowedOrigins: getServerActionOrigins(lanHosts),
    },
  },
};

export default nextConfig;
