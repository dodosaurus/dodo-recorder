const whisper = require('whisper-node').default;
const fs = require('fs');
const path = require('path');

async function testWhisper() {
  console.log('Testing Whisper setup...\n');
  
  const whisperNodeDir = path.dirname(require.resolve('whisper-node/package.json'));
  const modelsDir = path.join(whisperNodeDir, 'lib/whisper.cpp/models');
  const modelPath = path.join(modelsDir, 'ggml-base.en.bin');
  
  console.log('Checking model at:', modelPath);
  
  if (!fs.existsSync(modelPath)) {
    console.error('❌ Model not found!');
    console.log('\nTo fix, run:');
    console.log('  npm run whisper:download');
    console.log('\nOr manually download from:');
    console.log('  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin');
    process.exit(1);
  }
  
  const stats = fs.statSync(modelPath);
  console.log('✅ Model found! Size:', (stats.size / 1024 / 1024).toFixed(1), 'MB');
  
  const mainBinary = path.join(whisperNodeDir, 'lib/whisper.cpp/main');
  
  console.log('\nChecking whisper.cpp binary at:', mainBinary);
  
  if (!fs.existsSync(mainBinary)) {
    console.error('❌ whisper.cpp not compiled!');
    console.log('\nTo fix, run:');
    console.log('  cd node_modules/whisper-node/lib/whisper.cpp && make');
    process.exit(1);
  }
  
  console.log('✅ whisper.cpp binary found!');
  console.log('\n✅ Whisper is ready to use!\n');
}

testWhisper().catch(console.error);
