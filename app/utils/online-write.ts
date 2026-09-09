export const OFFLINE_TOAST_TITLE = 'You\'re offline.';

export type OfflineToast = {
  add: (input: { title: string }) => void;
};

export const canWriteOnline = (online: boolean | undefined = globalThis.navigator?.onLine): boolean => {
  if (online === undefined) {
    return true;
  }

  return online;
};

export const notifyOfflineWrite = (toast: OfflineToast): string | null => {
  if (canWriteOnline()) {
    return null;
  }

  toast.add({ title: OFFLINE_TOAST_TITLE });
  return OFFLINE_TOAST_TITLE;
};
