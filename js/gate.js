// 只存 SHA-256 指紋；純前端驗證只能擋一般人
export const PASS_HASH = '53d6668b995a4117d05d7799f6563672f4659d05f9f9fd45f961164de256b5d0';

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function checkPassword(input, hash = PASS_HASH) {
  return (await sha256Hex(String(input ?? '').trim())) === hash;
}

// 解鎖狀態刻意不存，每次重新載入都要再輸入
export function setupGate(onUnlock) {
  const launcher = document.getElementById('launcher');
  const dialog = document.getElementById('passwordDialog');
  const form = document.getElementById('passwordForm');
  const input = document.getElementById('passwordInput');
  const error = document.getElementById('passwordError');
  let unlocked = false;
  let checking = false;

  document.getElementById('btnOpenCounter').addEventListener('click', () => {
    input.value = '';
    error.hidden = true;
    dialog.returnValue = '';
    dialog.showModal();
    input.focus();
  });

  // app.js 的 [data-close] 要等解鎖後 init() 才綁，這裡自己處理
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close('cancel'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (checking || unlocked) return;
    checking = true;
    try {
      if (await checkPassword(input.value)) {
        unlocked = true;
        input.value = '';
        dialog.close('ok');
        launcher.hidden = true;
        document.body.classList.remove('locked');
        onUnlock();
      } else {
        error.hidden = false;
        input.value = '';
        input.focus();
      }
    } finally {
      checking = false;
    }
  });
}
