import { MetaManager } from '../components/MetaManager.js';

export function AboutPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 animate-fade-in" role="main">
      <MetaManager page="about" />
      <article className="space-y-6 text-white/70 leading-relaxed">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-6">About Kaboom TV</h1>
        <p>
          Kaboom TV is an anonymous random video chat platform that connects people from around the
          world in real time. Inspired by the simplicity of classic random chat services, we built
          Kaboom TV with a focus on privacy, speed, and ease of use.
        </p>

        <section className="glass-card space-y-4">
          <h2 className="text-xl font-semibold text-white">How It Works</h2>
          <ol className="list-decimal list-inside space-y-2 text-white/60">
            <li>Click &quot;Start Chat&quot; on the homepage — no account needed.</li>
            <li>Allow camera and microphone access when prompted.</li>
            <li>Get randomly matched with another online user.</li>
            <li>Chat via video and audio. Press &quot;Next&quot; to find someone new.</li>
            <li>Report any inappropriate behavior using the Report button.</li>
          </ol>
        </section>

        <section className="glass-card space-y-4">
          <h2 className="text-xl font-semibold text-white">Technology</h2>
          <p>
            Kaboom TV uses WebRTC for peer-to-peer video and audio streaming, Supabase Realtime for
            live matching and signaling, and Supabase PostgreSQL for session management and moderation
            data. All connections are encrypted end-to-end between peers.
          </p>
        </section>

        <section className="glass-card space-y-4">
          <h2 className="text-xl font-semibold text-white">Community Guidelines</h2>
          <ul className="list-disc list-inside space-y-2 text-white/60">
            <li>Be respectful to other users.</li>
            <li>Do not share personal information.</li>
            <li>No nudity, harassment, or illegal content.</li>
            <li>Report violations immediately.</li>
            <li>Users must be 18 years or older.</li>
          </ul>
        </section>
      </article>
    </main>
  );
}
