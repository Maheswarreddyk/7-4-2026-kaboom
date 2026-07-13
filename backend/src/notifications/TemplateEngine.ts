export class TemplateEngine {
  private static templates = {
    campus_active: [
      "🏫 Someone from {campus} just joined.",
      "🏫 New students from {campus} are online.",
      "🏫 Your university ({campus}) is getting busy.",
      "🏫 Campus conversations are active right now."
    ],
    nearby_users: [
      "📍 New people near {city} are joining.",
      "📍 Meet someone nearby from {city}.",
      "📍 Conversations are active in {city} tonight."
    ],
    gaming_night: [
      "🎮 Gaming discussions are active tonight.",
      "🎮 Find a duo! Gamers are online right now.",
      "🎮 Ready to play? Match with other gamers."
    ]
  };

  // Selects a random variation to prevent text fatigue
  static generateContent(templateType: keyof typeof TemplateEngine.templates, context: Record<string, string>): string {
    const variations = this.templates[templateType];
    if (!variations) return "New activity on Kaboom.";

    const selected = variations[Math.floor(Math.random() * variations.length)];
    
    // Replace {placeholders} with context data
    return selected.replace(/{(\w+)}/g, (_, key) => context[key] || '');
  }
}
