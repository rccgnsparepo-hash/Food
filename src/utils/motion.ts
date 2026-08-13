import { Variants, Transition } from 'motion/react';

// Standard motion timings and spring configs
export const motionSpringFast: Transition = { type: 'spring', stiffness: 450, damping: 30 };
export const motionSpringMedium: Transition = { type: 'spring', stiffness: 350, damping: 25 };
export const motionSpringGentle: Transition = { type: 'spring', stiffness: 260, damping: 22 };
export const motionEaseSmooth: Transition = { duration: 0.3, ease: [0.25, 0.8, 0.25, 1] };

// Page transition variants (300-400ms smooth fade + subtle slide + slight scale)
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 12, scale: 0.995 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -8, scale: 0.995, transition: { duration: 0.22, ease: [0.7, 0, 0.84, 0] } },
};

// Container stagger variants for grid & list items
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 360, damping: 26 } },
};

// Interactive Card Variants (Hover elevation & scale, press spring)
export const cardHoverProps = {
  whileHover: { y: -4, scale: 1.012, transition: { type: 'spring', stiffness: 400, damping: 25 } },
  whileTap: { scale: 0.98, transition: { type: 'spring', stiffness: 500, damping: 30 } },
};

// Interactive Button Variants
export const buttonTapProps = {
  whileHover: { scale: 1.02, transition: { type: 'spring', stiffness: 500, damping: 25 } },
  whileTap: { scale: 0.95, transition: { type: 'spring', stiffness: 500, damping: 20 } },
};

export const iconButtonTapProps = {
  whileHover: { scale: 1.08 },
  whileTap: { scale: 0.9 },
  transition: { type: 'spring', stiffness: 450, damping: 22 },
};

// Modal & Overlay Sheet Variants
export const modalOverlayVariants: Variants = {
  initial: { opacity: 0, backdropFilter: 'blur(0px)' },
  animate: { opacity: 1, backdropFilter: 'blur(8px)', transition: { duration: 0.25 } },
  exit: { opacity: 0, backdropFilter: 'blur(0px)', transition: { duration: 0.2 } },
};

export const overlayVariants = modalOverlayVariants;

export const modalDialogVariants: Variants = {
  initial: { opacity: 0, scale: 0.94, y: 18 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 28 } },
  exit: { opacity: 0, scale: 0.95, y: 12, transition: { duration: 0.18, ease: 'easeIn' } },
};

export const dialogVariants = modalDialogVariants;

export const bottomSheetVariants: Variants = {
  initial: { y: '100%', opacity: 0 },
  animate: { y: '0%', opacity: 1, transition: { type: 'spring', stiffness: 320, damping: 32 } },
  exit: { y: '100%', opacity: 0, transition: { duration: 0.25, ease: [0.32, 0, 0.67, 0] } },
};
