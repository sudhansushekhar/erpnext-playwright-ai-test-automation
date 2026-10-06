/**
 * Environment: where the site is and how to sign in.
 * Values come from .env locally and from repository secrets/variables in CI.
 */
require('dotenv').config({ quiet: true })

const ENV = {
  baseUrl: (process.env.BASE_URL || 'http://localhost:8080').replace(/\/$/, ''),
  adminUser: process.env.ADMIN_USER || 'Administrator',
  get adminPassword() {
    const value = process.env.ADMIN_PASSWORD
    if (!value) throw new Error('ADMIN_PASSWORD is not set (copy .env.example to .env)')
    return value
  },
  get demoUserPassword() {
    const value = process.env.DEMO_USER_PASSWORD
    if (!value) throw new Error('DEMO_USER_PASSWORD is not set (copy it from .env.example to .env)')
    return value
  },
  testDataFile: '.results/test-data.json',
}

module.exports = { ENV }
