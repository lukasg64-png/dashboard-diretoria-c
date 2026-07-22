const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TOKEN = process.env.HF_TOKEN || '';
const USER = 'lukasg64-png';
const SPACE_NAME = 'dashboard-cancelamentos-vtex';
const REPO_ID = `${USER}/${SPACE_NAME}`;

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
let envVars = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    const parts = line.trim().split('=');
    if (parts.length >= 2) {
      envVars[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
}

const vtexKey = envVars['VTEX_APP_KEY'] || 'vtexappkey-sjdigital-NBIBYX';
const vtexToken = envVars['VTEX_APP_TOKEN'] || '';
const vtexAccount = envVars['VTEX_ACCOUNT'] || 'sjdigital';

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function deploy() {
  if (!TOKEN) {
    console.log('HF_TOKEN não fornecido. Pule o deploy do HF.');
    return;
  }
  try {
    console.log('1. Criando ou verificando repositório na Nuvem...');
    const createRes = await request({
      hostname: 'huggingface.co',
      path: '/api/repos/create',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    }, {
      name: SPACE_NAME,
      type: 'space',
      sdk: 'docker',
      private: false
    });

    console.log(`Status do repositório: ${createRes.statusCode}`);

    console.log('2. Inicializando Git local e enviando arquivos...');
    try {
      execSync('git init', { cwd: rootDir, stdio: 'ignore' });
    } catch(e) {}
    
    execSync('git config user.name "Lucas Alves"', { cwd: rootDir, stdio: 'ignore' });
    execSync('git config user.email "lucas.alves@farmaciassaojoao.com.br"', { cwd: rootDir, stdio: 'ignore' });
    execSync('git add .', { cwd: rootDir, stdio: 'inherit' });
    try {
      execSync('git commit -m "Deploy Dashboard Cancelamentos VTEX"', { cwd: rootDir, stdio: 'ignore' });
    } catch(e) {}

    try {
      execSync('git remote remove hf', { cwd: rootDir, stdio: 'ignore' });
    } catch(e) {}
    
    const remoteUrl = `https://${USER}:${TOKEN}@huggingface.co/spaces/${USER}/${SPACE_NAME}`;
    execSync(`git remote add hf ${remoteUrl}`, { cwd: rootDir, stdio: 'inherit' });
    
    console.log('Enviando código para a nuvem...');
    execSync('git -c http.sslVerify=false push hf master:main --force', { cwd: rootDir, stdio: 'inherit' });
    console.log('Código enviado com sucesso!');

  } catch (err) {
    console.error('Erro na publicação:', err);
  }
}

deploy();
