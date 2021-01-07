import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import split from 'split'
import * as core from '@actions/core'
import {exec} from '@actions/exec'

export interface IProjectFingerprint {
  success: boolean
  testTask: string
  subprojectName: boolean
  testSourceSet: string
}

export const fingerprintProject = async (
  service: string,
  projectDir = '.'
): Promise<IProjectFingerprint> => {
  const fingerprintGradle = `
import org.gradle.api.internal.artifacts.dependencies.DefaultProjectDependency

allprojects { project ->
  def service = "${service}"

  // For projects that implement their own integration tests.
  project.afterEvaluate {
    def integrationTestTask = project.tasks.findByName("integrationTest")
    if (integrationTestTask == null) {
      return
    }

    def sourceSets = project.sourceSets.findAll {
      it.name.contains("integration")
    }
    if (sourceSets.size() != 1) {
      return
    }
    def integrationSourceSet = sourceSets.first()

    def testIsForService = true
    def extension = project.extensions.findByName("spinnakerPlugin")
    if (extension != null) {
      if (extension.serviceName != service) {
        testIsForService = false
      }
    } else {
      def configurationName = "\${integrationSourceSet.name}Implementation"
      def configuration = project.configurations.findByName(configurationName)
      if (!configuration) {
        return
      }
      testIsForService = configuration.dependencies.findAll {
        it instanceof DefaultProjectDependency
      }.findResults {
        it.extensions.findByName("spinnakerPlugin")?.serviceName == service
      }.size() > 0
    }
    if (!testIsForService) {
      project.logger.lifecycle("Test is not for service.")
      return
    }
    
    project.logger.lifecycle("FINGERPRINT:testTask:integrationTest")
    project.logger.lifecycle("FINGERPRINT:testSourceSet:\${integrationSourceSet.name}")
    project.logger.lifecycle("FINGERPRINT:subprojectName:\${project.name}")
  }

  // For projects that implement integration tests using the plugin TCK.
  project.afterEvaluate {
    def spinnakerPlugin = project.extensions.findByName("spinnakerPlugin")
    if (spinnakerPlugin?.serviceName == service) {
      def tck = project.configurations.findByName("testImplementation")?.dependencies.find {
        it.name == "kork-plugins-tck" && it.group == "com.netflix.spinnaker.kork"
      }
      if (tck == null) {
        return
      }
      project.logger.lifecycle("FINGERPRINT:testTask:test")
      project.logger.lifecycle("FINGERPRINT:testSourceSet:test")
      project.logger.lifecycle("FINGERPRINT:subprojectName:\${project.name}")
    }
  }
}
`
  core.info(`Gradle fingerprint script:\n${fingerprintGradle}`)
  fs.writeFileSync(
    path.join(projectDir, 'fingerprint.gradle'),
    fingerprintGradle
  )

  const fingerprint: any = {}
  try {
    await exec('./gradlew', ['-I', 'fingerprint.gradle'], {
      cwd: projectDir,
      outStream: fs.createWriteStream(path.join(projectDir, 'fingerprint.log'))
    })

    const logStream = fs
      .createReadStream(path.join(projectDir, 'fingerprint.log'))
      .pipe(split())

    await new Promise((resolve, reject) => {
      logStream.on('data', (line: string) => {
        if (line.includes('FINGERPRINT:')) {
          line = line.substring(
            line.lastIndexOf('FINGERPRINT:') + 'FINGERPRINT:'.length
          )
          const [key, value] = line.split(':').map(el => coerce(el.trim()))
          fingerprint[key] = value
        }
      })
      logStream.on('end', resolve)
      logStream.on('error', reject)
    })
  } catch (e) {
    throw e
  } finally {
    fs.unlinkSync(path.join(projectDir, 'fingerprint.gradle'))
    fs.unlinkSync(path.join(projectDir, 'fingerprint.log'))
  }

  fingerprint.success =
    !!fingerprint.testTask &&
    !!fingerprint.subprojectName &&
    !!fingerprint.testSourceSet
  return fingerprint as IProjectFingerprint
}

const coerce = (str: string): any => {
  switch (str) {
    case 'true':
      return true
    case 'false':
      return false
    default:
      return str
  }
}
