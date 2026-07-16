export interface SignupMethodAvailability {
  googleEnabled: boolean;
  emailEnabled: boolean;
  phoneEnabled: boolean;
}

function formatMethodList(methods: string[]): string | null {
  if (methods.length === 0) return null;
  if (methods.length === 1) return methods[0];
  if (methods.length === 2) return `${methods[0]}或${methods[1]}`;
  return `${methods.slice(0, -1).join('、')}或${methods.at(-1)}`;
}

export function resolveSignupMethodLabel(
  availability: SignupMethodAvailability
): string | null {
  const methods: string[] = [];

  if (availability.googleEnabled) methods.push('Google');
  if (availability.emailEnabled) methods.push('電子信箱驗證碼');
  if (availability.phoneEnabled) methods.push('台灣手機驗證碼');

  return formatMethodList(methods);
}
