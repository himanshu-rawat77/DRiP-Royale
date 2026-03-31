import { motion } from 'framer-motion';
import { Link } from 'wouter';

export default function Footer() {
  const footerLinks = [
    { label: 'DOCS', href: '#' },
    { label: 'GITHUB', href: '#' },
    { label: 'DISCORD', href: '#' },
    { label: 'TWITTER', href: 'https://x.com/drip_royale' },
  ];

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="relative py-16 px-6 md:px-16 border-t"
      style={{
        background: '#07060F',
        borderColor: 'rgba(139, 92, 246, 0.1)',
      }}
    >
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <p className="text-heading mb-2" style={{ fontSize: '1.5rem', color: '#FFFFFF' }}>
              <span style={{ color: '#F59E0B' }}>◆</span> DRIP ROYALE
            </p>
            <p
              className="text-body text-sm"
              style={{
                color: 'rgba(255, 255, 255, 0.45)',
              }}
            >
              Stake Art. Win War. Built on Solana.
            </p>
          </motion.div>

          {/* Quick Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
          >
            <p
              className="text-xs font-bold mb-4"
              style={{
                fontFamily: "'Syne', sans-serif",
                color: '#8B5CF6',
                letterSpacing: '0.1em',
              }}
            >
              NAVIGATION
            </p>
            <div className="space-y-2">
              {['THE VAULT', 'THE ARENA', 'THE LEDGER', 'LEADERBOARD'].map((link) => (
                <motion.a
                  key={link}
                  href="#"
                  whileHover={{ x: 4 }}
                  className="block text-xs transition-all duration-300"
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    color: 'rgba(255, 255, 255, 0.45)',
                  }}
                >
                  {link}
                </motion.a>
              ))}
            </div>
          </motion.div>

          {/* Social Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <p
              className="text-xs font-bold mb-4"
              style={{
                fontFamily: "'Syne', sans-serif",
                color: '#F59E0B',
                letterSpacing: '0.1em',
              }}
            >
              COMMUNITY
            </p>
            <div className="flex gap-4">
              {footerLinks.map((link) =>
                link.label === 'DOCS' ? (
                  <Link key={link.label} href="/docs">
                    <motion.span
                      whileHover={{ scale: 1.1, color: '#F59E0B' }}
                      className="text-xs font-bold transition-all duration-300 cursor-pointer"
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        color: 'rgba(255, 255, 255, 0.45)',
                      }}
                    >
                      {link.label}
                    </motion.span>
                  </Link>
                ) : (
                  <motion.a
                    key={link.label}
                    href={link.href}
                    whileHover={{ scale: 1.1, color: '#F59E0B' }}
                    className="text-xs font-bold transition-all duration-300"
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      color: 'rgba(255, 255, 255, 0.45)',
                    }}
                  >
                    {link.label}
                  </motion.a>
                )
              )}
            </div>
          </motion.div>
        </div>

        {/* Divider */}
        <div
          className="h-px mb-8"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.2), transparent)',
          }}
        />

        {/* Bottom */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs"
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            color: 'rgba(255, 255, 255, 0.35)',
          }}
        >
          <p>© 2026 DRiP Royale. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">
              PRIVACY
            </a>
            <a href="#" className="hover:text-white transition-colors">
              TERMS
            </a>
            <a href="#" className="hover:text-white transition-colors">
              STATUS
            </a>
          </div>
        </motion.div>
      </div>
    </motion.footer>
  );
}
