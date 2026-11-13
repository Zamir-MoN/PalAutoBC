import gsap from 'gsap';

export const prefersReducedMotion = () => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export const animatePageEntrance = (container: HTMLElement | null) => {
  if (!container || prefersReducedMotion()) return;

  gsap.fromTo(
    container,
    { opacity: 0, y: 8 },
    {
      opacity: 1,
      y: 0,
      duration: 0.35,
      ease: 'power2.out',
    }
  );
};

export const animateCardsStagger = (elements: HTMLElement[] | NodeListOf<HTMLElement>) => {
  if (!elements || prefersReducedMotion()) return;

  gsap.fromTo(
    elements,
    { opacity: 0, y: 12 },
    {
      opacity: 1,
      y: 0,
      duration: 0.4,
      stagger: 0.05,
      ease: 'power2.out',
    }
  );
};

export const animateModalEnter = (modalContent: HTMLElement | null) => {
  if (!modalContent || prefersReducedMotion()) return;

  gsap.fromTo(
    modalContent,
    { opacity: 0, scale: 0.96, y: 10 },
    {
      opacity: 1,
      scale: 1,
      y: 0,
      duration: 0.25,
      ease: 'back.out(1.4)',
    }
  );
};

