/**
 * Authentication uses Application Default Credentials (ADC) automatically.
 * ADC is a mechanism that the authentication library uses to find credentials
 * in the environment where your code runs, enabling seamless authentication
 * to Google Cloud APIs without changing your application code.
 * (Docs: https://cloud.google.com/docs/authentication/application-default-credentials)
 *
 * Using ADC removes the need to explicitly pass credentials in your code.
 */

import { Firestore } from '@google-cloud/firestore'

const db = new Firestore()

export default db
