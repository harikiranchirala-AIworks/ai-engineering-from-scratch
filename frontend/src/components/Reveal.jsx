import { motion } from "framer-motion";

// Fade + slide-up entrance when scrolled into view (once).
export const Reveal = ({ children, delay = 0, y = 24, className }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.2 }}
    transition={{ duration: 0.5, delay, ease: "easeOut" }}
  >
    {children}
  </motion.div>
);
