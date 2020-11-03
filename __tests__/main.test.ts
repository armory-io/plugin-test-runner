import * as process from 'process'
import * as cp from 'child_process'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'

test('run compatibility test', () => {
  process.env['INPUT_PAYLOAD'] = '{"platform":"1.23.1","clouddriver":"5.69.0"}'
  process.env['INPUT_SKIP_UPLOAD'] = 'true'
  process.env['GITHUB_RUN_ID'] = '12345'

  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-test'))
  copyDirectory(path.join(__dirname, 'crd-plugin'), testDir)

  try {
    const output = cp.execSync(
      `npx ts-node ${path.join(__dirname, '..', 'src', 'main.ts')}`,
      {
        env: process.env,
        cwd: path.join(testDir, 'crd-plugin')
      }
    )
    console.log(output.toString())
  } catch (e) {
    console.log(e.stderr.toString())
    console.log(e.stdout.toString())
    expect(e).toBeNull()
  }
})

const copyFile = (source: string, target: string) => {
  if (fs.existsSync(target) && fs.lstatSync(target).isDirectory()) {
    target = path.join(target, path.basename(source))
  }
  fs.writeFileSync(target, fs.readFileSync(source), {
    mode: fs.lstatSync(source).mode
  })
}

const copyDirectory = (source: string, target: string) => {
  const targetFolder = path.join(target, path.basename(source))
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder)
  }

  if (fs.lstatSync(source).isDirectory()) {
    fs.readdirSync(source).forEach(file => {
      const curSource = path.join(source, file)
      if (fs.lstatSync(curSource).isDirectory()) {
        copyDirectory(curSource, targetFolder)
      } else {
        copyFile(curSource, targetFolder)
      }
    })
  }
}
