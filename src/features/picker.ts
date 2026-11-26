// Выбор упражнения из библиотеки: экран библиотеки вызывает колбэк, который оставил открывший его экран.
let cb: ((exerciseId: string) => void) | null = null;
export function setPickHandler(f: ((exerciseId: string) => void) | null) {
  cb = f;
}
export function hasPickHandler() {
  return !!cb;
}
export function pick(exerciseId: string) {
  const f = cb;
  cb = null;
  f?.(exerciseId);
}
