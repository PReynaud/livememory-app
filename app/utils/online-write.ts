export const OFFLINE_TOAST_TITLE = 'You\'re offline.';

export const canWriteOnline = (online: boolean | undefined = globalThis.navigator?.onLine): boolean => {
  if (online === undefined) {
    return true;
  }

  return online;
};
