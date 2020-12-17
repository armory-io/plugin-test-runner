import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import split from 'split'
import * as core from '@actions/core'
import {exec} from '@actions/exec'

interface IProjectFingerprint {
  subprojectName: string
  dependsOnPluginsTck: boolean
}

export const fingerprintProject = async (
  service: string,
  projectDir = '.'
): Promise<IProjectFingerprint> => {
  const fingerprintGradle = `
allprojects { project ->
  project.afterEvaluate {
    def spinnakerPlugin = project.extensions.findByName("spinnakerPlugin")
    if (spinnakerPlugin?.serviceName == "${service}") {
      project.logger.lifecycle("FINGERPRINT:subprojectName: \${project.name}")
      def tck = project.configurations.findByName("testImplementation")?.dependencies.find {
        it.name == "kork-plugins-tck" && it.group == "com.netflix.spinnaker.kork"
      }
      project.logger.lifecycle("FINGERPRINT:dependsOnPluginsTck: \${tck != null}")
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
