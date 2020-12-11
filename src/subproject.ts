import * as fs from 'fs'
import * as path from 'path'

export const resolveGradleSubproject = (
  service: string,
  rootDir: string
): string => {
  const [subproject] = fs
    .readdirSync(rootDir)
    .filter(file => fs.lstatSync(path.join(rootDir, file)).isDirectory())
    .map(dir => {
      const gradleFile = fs
        .readdirSync(path.join(rootDir, dir))
        .find(file => file.endsWith('.gradle'))
      if (!gradleFile) {
        return
      }

      const gradleFileContents = fs.readFileSync(
        path.join(rootDir, dir, gradleFile),
        'utf-8'
      )
      if (
        gradleFileContents
          .split('\n')
          .find(line => line.includes('serviceName'))
          ?.includes(service)
      ) {
        return gradleFile.substring(0, gradleFile.length - '.gradle'.length)
      }
    })
    .filter(it => !!it)

  if (!subproject) {
    throw new SubprojectNotFoundError(
      `Could not find plugin subproject for ${service}`
    )
  }
  return subproject
}

class SubprojectNotFoundError extends Error {}
