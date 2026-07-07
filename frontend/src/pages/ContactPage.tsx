import { useState } from 'react';
import { useToast } from '../contexts/ToastContext.js';

export function ContactPage() {
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.email || !form.message) {
      showToast('error', 'Email and message are required');
      return;
    }

    setSubmitting(true);

    // Simulated contact form — stores intent client-side for demo; replace with email API later
    await new Promise((resolve) => setTimeout(resolve, 800));

    showToast('success', 'Message sent! We will get back to you within 48 hours.');
    setForm({ name: '', email: '', subject: '', message: '' });
    setSubmitting(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 animate-fade-in">
      <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Contact Us</h1>
      <p className="text-white/50 mb-10">
        Have a question, feedback, or need support? We would love to hear from you.
      </p>

      <div className="grid sm:grid-cols-2 gap-6 mb-10">
        <div className="glass-card">
          <h3 className="font-semibold text-white mb-2">General Inquiries</h3>
          <a href="mailto:contact@kaboom-tv.com" className="text-accent-light hover:underline text-sm">
            contact@kaboom-tv.com
          </a>
        </div>
        <div className="glass-card">
          <h3 className="font-semibold text-white mb-2">Privacy &amp; Legal</h3>
          <a href="mailto:collaborate@kaboom-tv.com" className="text-accent-light hover:underline text-sm">
            collaborate@kaboom-tv.com
          </a>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-card space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm text-white/60 mb-1">Name (optional)</label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-accent/50"
              placeholder="Your name"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm text-white/60 mb-1">Email *</label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-accent/50"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div>
          <label htmlFor="subject" className="block text-sm text-white/60 mb-1">Subject</label>
          <select
            id="subject"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-accent/50"
          >
            <option value="">Select a topic</option>
            <option value="general">General Question</option>
            <option value="support">Technical Support</option>
            <option value="report">Report an Issue</option>
            <option value="business">Business Inquiry</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label htmlFor="message" className="block text-sm text-white/60 mb-1">Message *</label>
          <textarea
            id="message"
            required
            rows={5}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm resize-none focus:outline-none focus:border-accent/50"
            placeholder="How can we help?"
          />
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto">
          {submitting ? 'Sending...' : 'Send Message'}
        </button>
      </form>
    </div>
  );
}
