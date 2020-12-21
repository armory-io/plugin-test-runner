import * as fs from 'fs'
import * as core from '@actions/core'
import {exec} from '@actions/exec'
import {create, UploadOptions} from '@actions/artifact'
import {fingerprintProject, IProjectFingerprint} from './fingerprint'

type Outcome = 'success' | 'failure' | 'unknown'

async function run(): Promise<void> {
  const service = core.getInput('service')
  const version = core.getInput('version')
  const pluginSha = core.getInput('plugin_sha')
  const timeoutMinutes = +core.getInput('timeout_minutes') || 10

  core.info('Received inputs:')
  core.info(`service=${service}`)
  core.info(`version=${version}`)
  core.info(`plugin_sha=${pluginSha}`)
  core.info(`timeout_minutes=${timeoutMinutes}`)

  const fingerprint = await fingerprintProject(service)
  Object.entries(fingerprint).forEach(([key, value]) => {
    core.info(`[fingerprint] ${key}=${value}`)
  })

  let outcome: Outcome = 'success'
  if (fingerprint.success) {
    try {
      const code = await runTests(service, version, fingerprint, timeoutMinutes)
      if (code !== 0) {
        core.setFailed(`Tests exited with code ${code}`)
        outcome = 'failure'
      }
    } catch (error) {
      core.setFailed(error.message)
      outcome = 'failure'
    }
  } else {
    outcome = 'unknown'
  }

  await uploadArtifact(service, version, pluginSha, outcome)
}

const runTests = async (
  service: string,
  version: string,
  fingerprint: IProjectFingerprint,
  timeoutMinutes: number
): Promise<number> => {
  const initGradle = `
allprojects { project ->
  if (project.name == "${fingerprint.subprojectName}") {
    project.afterEvaluate {
      def platform = project.dependencies.enforcedPlatform("com.netflix.spinnaker.${service}:${service}-bom:${version}")
      project.dependencies.add("${fingerprint.testSourceSet}Runtime", platform)
      project.repositories {
        maven { url "https://spinnaker-releases.bintray.com/jars" }
      }
      project.tasks.withType(Test) {
        timeout = Duration.ofMinutes(${timeoutMinutes})
      }
    }
  }
}
`
  core.info(`Gradle init script:\n${initGradle}`)
  fs.writeFileSync('init.gradle', initGradle)
  const command = `./gradlew -I init.gradle :${fingerprint.subprojectName}:${fingerprint.testTask}`
  core.info(`Running command: ${command}`)
  return await exec(command)
}

const uploadArtifact = async (
  service: string,
  version: string,
  sha: string,
  outcome: Outcome
) => {
  const payload = {
    service,
    version,
    sha,
    outcome
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64')
  const artifactName = `compat-${encodedPayload}`
  if (core.getInput('skip_upload') !== 'true') {
    try {
      core.info(`Uploading dummy artifact ${artifactName}`)
      const artifactClient = create()
      const response = await artifactClient.uploadArtifact(
        artifactName,
        ['gradle.properties'],
        '.',
        {}
      )
      if (response.failedItems.length > 0) {
        core.setFailed(`Could not upload artifacts`)
      }
    } catch (error) {
      core.setFailed(error.message)
    }
  } else {
    core.info('Not in a CI environment')
    core.info(`Raw payload is: \n${JSON.stringify(payload, null, 2)}`)
    core.info(`Would have uploaded a artifact with the name '${artifactName}'`)
  }
}

run()
