export interface MatchCategory {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  placeholderText: string;
  rotatorMessages: string[];
  recommended?: boolean;
}

export const MATCH_CATEGORIES: MatchCategory[] = [
  {
    id: 'COLLEGE',
    icon: '🏫',
    title: 'Campus Match',
    subtitle: 'Meet someone between classes. Students are chatting right now.',
    placeholderText: 'Search your university...',
    recommended: true,
    rotatorMessages: [
      'Students from Saveetha University are online...',
      'Someone from VIT is looking for new friends...',
      'Meet people from your university campus...',
      'Your next campus friend is one click away.'
    ]
  },
  {
    id: 'NEARBY',
    icon: '🌎',
    title: 'Nearby',
    subtitle: 'Sometimes your next friend is only a few streets away.',
    placeholderText: 'Search by city, state, or country...',
    rotatorMessages: [
      'New users in Hyderabad just came online...',
      'Strangers are waving in Bangalore...',
      'Discover people around your region...',
      'Connecting you to nearby peers...'
    ]
  },
  {
    id: 'LANGUAGE',
    icon: '💬',
    title: 'Language Match',
    subtitle: 'Some conversations are just easier when everyone speaks the same language.',
    placeholderText: 'Select languages...',
    rotatorMessages: [
      'Telugu conversations are trending...',
      'Someone is waiting to speak Hindi...',
      'Practice English with native speakers...',
      'Meet Tamil speakers right now...'
    ]
  },
  {
    id: 'INTERESTS',
    icon: '🎮',
    title: 'Shared Hobbies',
    subtitle: 'Meet people who share your passion.',
    placeholderText: 'Search interests (e.g. Gaming)...',
    rotatorMessages: [
      'Gamers are online right now...',
      'Cricket fans are matching...',
      'Music lovers are sharing playlists...',
      'AI enthusiasts are waiting to connect...'
    ]
  },
  {
    id: 'RANDOM',
    icon: '❤️',
    title: 'Surprise Me',
    subtitle: 'Forget filters. Let\'s surprise you.',
    placeholderText: '',
    rotatorMessages: [
      'Connecting to global conversations...',
      'Discover someone unexpected...',
      'We will introduce you to someone cool.',
      'Every conversation starts with one click.'
    ]
  }
];
