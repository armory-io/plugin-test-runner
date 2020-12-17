import * as fs from 'fs'
import * as path from 'path'

import {fingerprintProject} from '../src/fingerprint'

test('fingerprints subproject', async () => {
  const fingerprint = await fingerprintProject(
    'clouddriver',
    path.join(__dirname, 'crd-plugin')
  )
  expect(fingerprint.subprojectName).toEqual('crdcheck-clouddriver')
  expect(fingerprint.dependsOnPluginsTck).toEqual(true)
})
