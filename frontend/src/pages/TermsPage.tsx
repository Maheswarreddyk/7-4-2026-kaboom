import { Link } from 'react-router-dom';
import { MetaManager } from '../components/MetaManager.js';

export function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 animate-fade-in" role="main">
      <MetaManager page="terms" />
      <article className="space-y-6 text-white/70 leading-relaxed">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-6">Terms of Service</h1>
        <p className="text-sm text-white/40">Last updated: June 2026</p>

        <section className="glass-card space-y-3">
          <h2 className="text-xl font-semibold text-white">Acceptance of Terms</h2>
          <p>
            By accessing or using Kaboom TV, you agree to be bound by these Terms of Service. If you do not
            agree, do not use the service.
          </p>
        </section>

        <section className="glass-card space-y-3">
          <h2 className="text-xl font-semibold text-white">Eligibility</h2>
          <p>
            You must be at least 18 years old to use Kaboom TV. By using the service, you represent and
            warrant that you meet this age requirement.
          </p>
        </section>

        <section className="glass-card space-y-3">
          <h2 className="text-xl font-semibold text-white">Acceptable Use</h2>
          <ul className="list-disc list-inside space-y-2 text-white/60">
            <li>Be respectful to other users at all times</li>
            <li>Do not share personal information with strangers</li>
            <li>No nudity, sexual content, or illegal activity</li>
            <li>No harassment, hate speech, or threats</li>
            <li>No spam, advertising, or solicitation</li>
            <li>Report violations using the in-app Report feature</li>
          </ul>
        </section>

        <section className="glass-card space-y-3">
          <h2 className="text-xl font-semibold text-white">Service Availability</h2>
          <p>
            Kaboom TV is provided &quot;as is&quot; without warranties of any kind. We do not guarantee
            uninterrupted access, matching availability, or connection quality. Service may be modified
            or discontinued at any time.
          </p>
        </section>

        <section className="glass-card space-y-3">
          <h2 className="text-xl font-semibold text-white">Limitation of Liability</h2>
          <p>
            Kaboom TV is not responsible for user conduct, content shared between users, or any damages
            arising from use of the service. You use Kaboom TV at your own risk.
          </p>
        </section>

        <section className="glass-card space-y-3">
          <h2 className="text-xl font-semibold text-white">Termination</h2>
          <p>
            We reserve the right to restrict or terminate access for users who violate these terms or
            engage in harmful behavior, without prior notice.
          </p>
        </section>

        <section className="glass-card space-y-3">
          <h2 className="text-xl font-semibold text-white">Contact</h2>
          <p>
            Questions about these terms? Visit our{' '}
            <Link to="/contact" className="text-amber-400 hover:underline">
              Contact page
            </Link>{' '}
            or email contact@kaboom-tv.com.
          </p>
        </section>
      </article>
    </main>
  );
}
