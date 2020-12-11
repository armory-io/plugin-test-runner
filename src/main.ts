import * as fs from 'fs'
import * as core from '@actions/core'
import {exec} from '@actions/exec'
import {create, UploadOptions} from '@actions/artifact'
import {resolveGradleSubproject} from './subproject'

async function run(): Promise<void> {
  const service = core.getInput('service')
  const version = core.getInput('version')
  const pluginSha = core.getInput('plugin_sha')
  const timeoutMinutes = core.getInput('timeout_minutes') || 10

  core.info('Received inputs:')
  core.info(`service=${service}`)
  core.info(`version=${version}`)
  core.info(`plugin_sha=${pluginSha}`)

  const subproject = resolveGradleSubproject(service, '.')

  try {
    const initGradle = `
allprojects { project ->
  project.afterEvaluate {
    def spinnakerPlugin = project.extensions.findByName("spinnakerPlugin")
    if (spinnakerPlugin?.serviceName == "${service}") {
      def platform = project.dependencies.platform("com.netflix.spinnaker.${service}:${service}-bom:${version}") {
        force = true
      }
      project.dependencies.add("testRuntime", platform)
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
    const command = `./gradlew -I init.gradle :${subproject}:test`
    core.info(`Running command: ${command}`)
    await exec(command)
  } catch (error) {
    core.setFailed(error.message)
  }

  const runID = process.env['GITHUB_RUN_ID']
  const payload = {
    service,
    version,
    sha: pluginSha
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64')
  const artifactName = `compat-${runID}-${encodedPayload}`
  if (core.getInput('skip_upload') !== 'true') {
    try {
      core.info(`Uploading dummy artifact ${artifactName}`)
      const artifactClient = create()
      const response = await artifactClient.uploadArtifact(
        artifactName,
        ['init.gradle'],
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
