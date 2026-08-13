/**
 * Small augmentation for the File System Access API pieces this TS
 * version's `lib.dom.d.ts` doesn't declare yet. `FileSystemDirectoryHandle`/
 * `FileSystemFileHandle`/`FileSystemWritableFileStream` are already
 * declared upstream; only `Window.showDirectoryPicker()` and
 * `FileSystemHandle.queryPermission()`/`.requestPermission()` are missing.
 * Hand-rolled rather than installing `@types/wicg-file-system-access`,
 * which would need reconciling against the already-partially-declared
 * interfaces: small enough to fully own (see docs-site's architecture page
 * for the hand-roll-vs-dependency precedent).
 *
 * Declared with arrow-function property syntax, not TS method shorthand,
 * same reasoning as `store.ts`'s action interface (see its own comment):
 * method shorthand makes `@typescript-eslint/unbound-method` flag any bare
 * reference to `handle.requestPermission` etc. (e.g. in a test's `expect(...)`),
 * since the rule operates on the static type, not the runtime value.
 */
interface Window {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: "read" | "readwrite";
    startIn?: string;
  }) => Promise<FileSystemDirectoryHandle>;
}

interface FileSystemHandle {
  queryPermission: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
}
