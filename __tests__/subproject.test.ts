import * as fs from 'fs'
import * as path from 'path'

import {resolveGradleSubproject} from '../src/subproject'

test('resolves subproject', async () => {
  const subproject = await resolveGradleSubproject(
    'clouddriver',
    path.join(__dirname, 'crd-plugin')
  )
  expect(subproject).toEqual('crdcheck-clouddriver')
})
