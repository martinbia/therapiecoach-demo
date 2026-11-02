export function shouldToggleFromKeyboard(event: Pick<KeyboardEvent, 'code' | 'repeat' | 'altKey' | 'ctrlKey' | 'metaKey' | 'target'>, pinOpen: boolean, hasFocus: boolean): boolean {
  if (event.code !== 'F9' || event.repeat || event.altKey || event.ctrlKey || event.metaKey || pinOpen || !hasFocus) return false;
  const el = event.target;
  if (!el || typeof el !== 'object') return true;
  if ('isContentEditable' in el && el.isContentEditable) return false;
  if ('tagName' in el && typeof el.tagName === 'string') return !['INPUT','TEXTAREA','SELECT'].includes(el.tagName.toUpperCase());
  return true;
}
