import * as fs from 'fs'
import * as core from '@actions/core'
import {exec} from '@actions/exec'

type Outcome = 'success' | 'failure' | 'noFingerprint'

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

  try {
    const code = await runTests(service, version, timeoutMinutes)
    if (code !== 0) {
      core.setFailed(`Tests exited with code ${code}`)
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

const runTests = async (
  service: string,
  version: string,
  timeoutMinutes: number
): Promise<number> => {
  const initGradle = `
allprojects { project ->
  project.afterEvaluate {
    def spinnakerPlugin = project.extensions.findByName("spinnakerPlugin")
    if ("${service}" == spinnakerPlugin?.serviceName) {
      def platform = project.dependencies.enforcedPlatform("io.spinnaker.${service}:${service}-bom:${version}")
      project.dependencies.add("testRuntime", platform)
      project.tasks.withType(Test) {
        timeout = Duration.ofMinutes(${timeoutMinutes})
      }
      task integTest(type: Test)
    }
  }
}
`
  core.info(`Gradle init script:\n${initGradle}`)
  fs.writeFileSync('init.gradle', initGradle)
  const command = `./gradlew -I init.gradle clean integTest`
  core.info(`Running command: ${command}`)
  return await exec(command)
}

run().catch(error => console.log(error))
