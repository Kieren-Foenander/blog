// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';

// https://astro.build/config
// API route has prerender: false for on-demand execution
export default defineConfig({
  site: 'https://example.com',
  output: 'static',
  integrations: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', { target: '19' }]],
      },
    }),
    mdx(),
    sitemap(),
  ],
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
      remoteBindings: false,
    },
  }),
});