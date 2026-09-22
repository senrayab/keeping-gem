if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}

// 새 빌드 알림: 배포 때 생성되는 version.json을 확인해 처음 연 버전과 다르면 토스트를 띄운다.
const UPDATE_CHECK_INTERVAL = 60 * 1000;
let bootVersion = null;
let toastShown = false;

async function fetchVersion() {
  try {
    const res = await fetch('./version.json', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()).version;
  } catch {
    return null;
  }
}

async function checkForUpdate() {
  if (toastShown) return;
  const latest = await fetchVersion();
  if (!latest) return;
  if (!bootVersion) {
    bootVersion = latest;
  } else if (latest !== bootVersion) {
    showUpdateToast();
  }
}

function showUpdateToast() {
  toastShown = true;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.innerHTML = `
    <span>최신 버전이 나왔어요. 새로고침하면 반영됩니다.</span>
    <button type="button">새로고침</button>
  `;
  toast.querySelector('button').addEventListener('click', () => location.reload());
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
}

checkForUpdate();
setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkForUpdate();
});
