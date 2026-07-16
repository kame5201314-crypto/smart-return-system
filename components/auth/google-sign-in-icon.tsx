import Image from 'next/image';

export function GoogleSignInIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <Image
      src="/brand/google-sign-in-light-square.png"
      alt=""
      width={40}
      height={40}
      className={className}
      aria-hidden="true"
      draggable={false}
      data-testid="google-sign-in-icon"
    />
  );
}
