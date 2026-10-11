/**
 * The tests' API session: the automation user, signed in ONCE before the workers start.
 *
 * Every worker needs an API session as the automation user (the `api` fixture). When each worker
 * signed in by itself, all of them did so at the same moment, and ERPNext failed most of those
 * sign-ins: 4 at once gave 1 success and 3 × HTTP 500, "SAVEPOINT ... does not exist" (the sign-ins
 * write the same user's record at the same time). So global setup signs in once and saves the
 * session's cookies here; each worker resumes that session (FrappeClient.resume). A Frappe session
 * serves many requests at once.
 */
const fs = require('fs')
const path = require('path')
const { FrappeClient } = require('../api/FrappeClient')
const { ENV } = require('../../config/env')

const API_SESSION_FILE = '.results/api-session.json'

/** Sign the automation user in and save the session for the workers. */
async function saveApiSession(testData, { log = console.log } = {}) {
  const api = await FrappeClient.signIn(ENV.baseUrl, testData.automationUser, ENV.demoUserPassword)
  try {
    fs.mkdirSync(path.dirname(API_SESSION_FILE), { recursive: true })
    await api.saveSession(API_SESSION_FILE)
    log(`API SESSION: ${testData.automationUser} signed in once, shared by the workers`)
  } finally {
    await api.dispose() // closes the client only; the session stays signed in for the workers
  }
}

module.exports = { saveApiSession, API_SESSION_FILE }
