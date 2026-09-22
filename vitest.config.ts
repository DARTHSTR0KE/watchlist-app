import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Pure logic only: nothing here touches the DOM, the network, Supabase
    // or a signed-in user.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The date rules are about local calendar days, and the bug they guard
    // against is reading them in UTC. A timezone well off UTC is the only
    // way that mistake shows up rather than passing by coincidence.
    env: { TZ: 'Asia/Kolkata' },
  },
})
