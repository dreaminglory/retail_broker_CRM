import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Don't let `next dev` write its agent-rules block into AGENTS.md (AD-047).
  agentRules: false,
};

export default withNextIntl(nextConfig);
