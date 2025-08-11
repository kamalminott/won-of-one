# Won-Of-One

A user-first training & competition platform built by athletes for athletes. Start with fencing, designed to expand to other sports without rework.

## Features

### Home Dashboard
- **User Profile**: Personalized greeting with avatar and settings
- **Progress Tracking**: Weekly sessions progress with visual indicators
- **Summary Cards**: Hours trained and win rate statistics
- **Goal Management**: Current goals with progress circles and action buttons
- **Recent Matches**: Horizontal scrollable match history
- **Quick Actions**: Train Now, Log Match, and Mindset tools

### Core Components
- **ProgressCard**: Purple gradient progress cards with decorative elements
- **SummaryCard**: Light colored summary cards for key metrics
- **GoalCard**: Goal tracking with circular progress indicators
- **RecentMatches**: Match history with opponent profiles
- **QuickActions**: Action buttons for common tasks
- **UserHeader**: User profile section with avatar and settings

### Design System
- **Dark Theme**: Modern, minimal design with dark backgrounds
- **Color Palette**: Purple gradients, light pink/blue accents, red highlights
- **Typography**: Clear hierarchy with proper font weights
- **Spacing**: Consistent padding and margins throughout
- **Icons**: Emoji-based icons for quick recognition

## Tech Stack

- **React Native** with Expo
- **TypeScript** for type safety
- **Expo Linear Gradient** for gradient backgrounds
- **Custom Components** for reusability
- **Responsive Design** for mobile-first experience

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Run on your device or simulator

## Project Structure

```
app/
  (tabs)/
    index.tsx          # Home dashboard
    calendar.tsx       # Calendar view (placeholder)
    insights.tsx       # Insights view (placeholder)
    profile.tsx        # Profile view (placeholder)
    _layout.tsx        # Tab navigation layout

components/
  ProgressCard.tsx     # Progress tracking cards
  SummaryCard.tsx      # Summary metric cards
  GoalCard.tsx         # Goal management cards
  RecentMatches.tsx    # Match history component
  QuickActions.tsx     # Action buttons
  UserHeader.tsx       # User profile header
  StatusBar.tsx        # Custom status bar
  CircularProgress.tsx # Progress indicators

constants/
  Colors.ts            # Color definitions and theme
```

## Development Status

- ✅ Home Dashboard UI complete
- ✅ Component architecture established
- ✅ Dark theme implemented
- ✅ Tab navigation structure
- 🔄 Training Tracker (next phase)
- 🔄 Match Logging (planned)
- 🔄 Mindset Tools (planned)

## Design Principles

- **Simple & Quick**: Fast interactions for athletes on the go
- **Playful**: Gamified elements to maintain engagement
- **Reliable**: Offline-first with real-time sync
- **Privacy-First**: User data protection and control
- **Accessible**: WCAG AA compliance for all users

## Next Steps

1. Implement Training Tracker functionality
2. Add Match Logging with Fencing Remote
3. Integrate Mindset Builder tools
4. Connect to backend services
5. Add authentication and user management

---

Built with ❤️ for athletes who want to track their progress and improve their game.
