import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wrangler = resolve(root, 'node_modules/wrangler/bin/wrangler.js');
const project = 'form-and-fuel-shyam';
const generatedOnly = process.argv.includes('--generated-only');
const names = ['BETTER_AUTH_SECRET', 'INTEGRATION_ENCRYPTION_KEY', ...(generatedOnly ? [] : ['RESEND_API_KEY'])];
const useDialog = process.argv.includes('--dialog');
function keyDialog() {
  if (process.platform !== 'win32') throw new Error('The setup dialog requires Windows.');
  // Only UI code is passed as an argument. The key returns through a private pipe.
  const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Form & Fuel - Resend setup'
$form.ClientSize = New-Object System.Drawing.Size(540,190)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.TopMost = $true
$label = New-Object System.Windows.Forms.Label
$label.Text = 'Paste your Resend API key below. Dots confirm input. Then click Upload.'
$label.SetBounds(20,20,500,40)
$box = New-Object System.Windows.Forms.TextBox
$box.SetBounds(20,70,500,28)
$box.UseSystemPasswordChar = $true
$box.MaxLength = 512
$ok = New-Object System.Windows.Forms.Button
$ok.Text = 'Upload'
$ok.SetBounds(320,125,95,32)
$ok.DialogResult = [System.Windows.Forms.DialogResult]::OK
$cancel = New-Object System.Windows.Forms.Button
$cancel.Text = 'Cancel'
$cancel.SetBounds(425,125,95,32)
$cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$form.Controls.AddRange(@($label,$box,$ok,$cancel))
$form.AcceptButton = $ok
$form.CancelButton = $cancel
$form.Add_Shown({ $box.Focus() })
$result = $form.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($box.Text.Trim()) }
$box.Clear()
$form.Dispose()
if ($result -ne [System.Windows.Forms.DialogResult]::OK) { exit 2 }
`;
  return new Promise((resolveKey, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let key = '';
    child.stdout.on('data', chunk => { key += chunk; });
    child.stderr.resume();
    child.on('error', () => reject(new Error('Could not open the secure input dialog.')));
    child.on('close', code => {
      if (code === 0) resolveKey(key.trim());
      else reject(new Error(code === 2 ? 'Setup cancelled.' : 'The secure input dialog could not run.'));
      key = '';
    });
  });
}
function run(args, input) {
  return new Promise((resolveResult) => {
    const child = spawn(process.execPath, [wrangler, ...args], {
      cwd: root, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.resume(); // Never print provider output or secret-bearing input.
    child.on('error', () => resolveResult({ code: 1, output: '' }));
    child.on('close', code => resolveResult({ code, output }));
    child.stdin.on('error', () => {});
    child.stdin.end(input || '');
  });
}
function hiddenInput(prompt) {
  if (!process.stdin.isTTY) throw new Error('Open this script in an interactive terminal.');
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.resume();
  return new Promise((resolveInput, reject) => {
    let value = '';
    const finish = (cancelled) => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (cancelled) reject(new Error('Setup cancelled.'));
      else resolveInput(value.trim());
      value = '';
    };
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\u0003') { finish(true); return; }
        if (char === '\r' || char === '\n') { finish(false); return; }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ' && char <= '~' && value.length < 512) value += char;
      }
    };
    process.stdin.on('data', onData);
  });
}
function record(status, message) {
  writeFileSync(resolve(root, '.production-setup-result.json'), JSON.stringify({
    status, message, project, names, completedAt: new Date().toISOString(),
  }, null, 2));
}
console.log('Form & Fuel — private production setup\n');
console.log('No PowerShell policy change is needed. Existing secrets are preserved.');
console.log('Key input is hidden and goes directly to Cloudflare; values are not saved or printed.');
try {
  console.log('Checking existing production secret names...');
  const listed = await run(['pages', 'secret', 'list', '--project-name', project]);
  if (listed.code !== 0) throw new Error('Cloudflare authentication or project access failed.');
  const missing = names.filter(name => !listed.output.includes(name));
  const payload = {};
  if (missing.includes('BETTER_AUTH_SECRET')) payload.BETTER_AUTH_SECRET = randomBytes(48).toString('base64');
  if (missing.includes('INTEGRATION_ENCRYPTION_KEY')) payload.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  if (missing.includes('RESEND_API_KEY')) {
    console.log('Create a Sending access key at https://resend.com/api-keys.');
    record('awaiting-input', 'Waiting for the Resend key in the private setup prompt.');
    const key = useDialog ? await keyDialog() : await hiddenInput('Paste Resend API key here (nothing appears), then press Enter: ');
    if (!/^re_[A-Za-z0-9_-]{8,}$/.test(key)) throw new Error('Input was not a valid Resend key format. Run setup again.');
    payload.RESEND_API_KEY = key;
  }
  if (missing.length) {
    console.log('Uploading missing secrets...');
    const result = await run(['pages', 'secret', 'bulk', '--project-name', project], JSON.stringify(payload));
    for (const key of Object.keys(payload)) delete payload[key];
    if (result.code !== 0) throw new Error('Cloudflare secret upload failed. Values were not printed; ask for help checking access.');
  }
  const verified = await run(['pages', 'secret', 'list', '--project-name', project]);
  if (verified.code !== 0 || names.some(name => !verified.output.includes(name))) throw new Error('Upload could not be verified. Ask for a production secret-name check.');
  record('uploaded', 'Requested production secret names verified.');
  console.log(generatedOnly ? 'SUCCESS: Auth and encryption secret names verified. Resend key is configured separately.' : 'SUCCESS: Secrets uploaded and names verified. Return to Codex for redeployment.');
} catch (error) {
  process.exitCode = 1;
  record('failed', error.message);
  console.log('Setup did not complete: ' + error.message);
}
if (!useDialog && !generatedOnly && process.stdin.isTTY) await hiddenInput('Press Enter to close this window.');
