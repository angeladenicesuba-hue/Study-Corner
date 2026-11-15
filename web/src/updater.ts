export interface AppVersionInfo {
  version: string;
  buildNumber: number;
  commit: string;
  builtAt?: string;
  apkUrl: string;
}

export const CURRENT_APP_BUILD = {
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0',
  buildNumber: typeof __APP_BUILD_NUMBER__ !== 'undefined' ? __APP_BUILD_NUMBER__ : 0,
  commit: typeof __APP_BUILD_COMMIT__ !== 'undefined' ? __APP_BUILD_COMMIT__ : 'local',
};

const VERSION_JSON_URL =
  'https://github.com/angeladenicesuba-hue/Study-Corner/releases/latest/download/version.json';

export const LATEST_APK_URL =
  'https://github.com/angeladenicesuba-hue/Study-Corner/releases/latest/download/Study-Corner-POS.apk';

export interface UpdateCheckResult {
  hasUpdate: boolean;
  remote: AppVersionInfo | null;
  error?: string;
}

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { hasUpdate: false, remote: null, error: 'Offline' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);

  try {
    const res = await fetch(`${VERSION_JSON_URL}?t=${Date.now()}`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      return { hasUpdate: false, remote: null, error: `Status ${res.status}` };
    }
    const remote = (await res.json()) as AppVersionInfo;

    // Compare buildNumber when running a CI-built APK, or commit hash as fallback
    const hasNewerBuild =
      CURRENT_APP_BUILD.buildNumber > 0 &&
      remote.buildNumber > CURRENT_APP_BUILD.buildNumber;

    const hasDifferentCommit =
      CURRENT_APP_BUILD.buildNumber === 0 &&
      CURRENT_APP_BUILD.commit !== 'local' &&
      Boolean(remote.commit) &&
      remote.commit !== CURRENT_APP_BUILD.commit;

    return {
      hasUpdate: hasNewerBuild || hasDifferentCommit,
      remote,
    };
  } catch {
    return { hasUpdate: false, remote: null, error: 'Could not reach GitHub Releases' };
  } finally {
    clearTimeout(timer);
  }
}
