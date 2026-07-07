const faqs = [
  {
    question: 'Do I need to create an account?',
    answer:
      'No. Kaboom is completely anonymous. Click Start Chat, allow camera and microphone access, and you are connected instantly.',
  },
  {
    question: 'Is my video recorded or stored?',
    answer:
      'No. Video and audio are transmitted directly between users via WebRTC peer-to-peer connections. Kaboom never records or stores your conversations.',
  },
  {
    question: 'How do I skip to the next person?',
    answer:
      'Click the Next button during a chat. Your current match ends and you are automatically placed back in the matching queue.',
  },
  {
    question: 'What should I do if someone behaves inappropriately?',
    answer:
      'Use the Report button immediately. Select a reason and optionally add notes. Reports are stored for moderation review.',
  },
  {
    question: 'Why is my camera or microphone not working?',
    answer:
      'Make sure you granted browser permissions for camera and microphone. Check that no other app is using your camera. Try refreshing the page.',
  },
  {
    question: 'Can I use Kaboom on my phone?',
    answer:
      'Yes. Kaboom is fully responsive and works on modern mobile browsers including Chrome and Safari on iOS and Android.',
  },
  {
    question: 'Is Kaboom free?',
    answer:
      'Yes, Kaboom is free to use. There are no subscriptions or hidden fees.',
  },
  {
    question: 'Who can use Kaboom?',
    answer:
      'You must be 18 years or older to use Kaboom. By using the service, you confirm you meet this age requirement.',
  },
];

export function FaqPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 animate-fade-in">
      <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Frequently Asked Questions</h1>
      <p className="text-white/50 mb-10">Everything you need to know about using Kaboom.</p>

      <div className="space-y-4">
        {faqs.map((faq) => (
          <details key={faq.question} className="glass-card group">
            <summary className="font-semibold text-white cursor-pointer list-none flex items-center justify-between gap-4">
              {faq.question}
              <span className="text-white/40 group-open:rotate-180 transition-transform shrink-0">▼</span>
            </summary>
            <p className="mt-4 text-white/60 leading-relaxed">{faq.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
