const packager = require('electron-packager')
const path = require('path')
const fs = require('fs')

async function buildApp() {
  console.log('🚀 开始打包应用...')
  
  try {
    const appPaths = await packager({
      dir: '.',
      name: 'gene-drug-app',
      platform: 'win32',
      arch: 'x64',
      out: 'dist',
      overwrite: true,
      asar: true,
      // 关键：跳过版本信息设置，避免 rcedit 问题
      win32metadata: false,
      // 忽略一些不需要的文件
      ignore: [
        /node_modules\/electron($|\/)/,
        /dist/,
        /\.git/,
        /simple-build\.js/,
        /pack-simple\.js/
      ]
    })
    
    console.log('✅ 打包完成!')
    console.log('📂 应用路径:', appPaths)
    
    // 查找exe文件
    if (appPaths && appPaths.length > 0) {
      const exePath = path.join(appPaths[0], 'gene-drug-app.exe')
      if (fs.existsSync(exePath)) {
        console.log(`💾 可执行文件: ${exePath}`)
        console.log(`📏 文件大小: ${(fs.statSync(exePath).size / 1024 / 1024).toFixed(2)} MB`)
        console.log('🎉 打包成功！可以测试运行exe文件了')
      } else {
        console.log('⚠️ exe文件未找到')
      }
    }
    
  } catch (err) {
    console.error('❌ 打包失败:', err)
  }
}

buildApp()