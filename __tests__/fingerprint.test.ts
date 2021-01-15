import * as fs from 'fs'
import * as path from 'path'

import {fingerprintProject} from '../src/fingerprint'

test('fingerprints subproject that uses plugin tck', async () => {
  const fingerprint = await fingerprintProject(
    'clouddriver',
    path.join(__dirname, 'crd-plugin')
  )
  expect(fingerprint.subprojectName).toEqual('crdcheck-clouddriver')
  expect(fingerprint.testTask).toEqual('test')
  expect(fingerprint.testSourceSet).toEqual('test')
}, 10000)

test('fingerprints subproject that has its own integration tests', async () => {
  const fingerprint = await fingerprintProject(
    'clouddriver',
    path.join(__dirname, 'external-accounts')
  )
  expect(fingerprint.subprojectName).toEqual('integration-tests')
  expect(fingerprint.testTask).toEqual('integrationTest')
  expect(fingerprint.testSourceSet).toEqual('integration')
}, 10000)

test("fingerprint fails if the plugin's integration tests do not test the requested service", async () => {
  const fingerprint = await fingerprintProject(
    'fiat',
    path.join(__dirname, 'external-accounts')
  )
  expect(fingerprint.success).toEqual(false)
}, 10000)
