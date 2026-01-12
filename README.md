# 🎴 Bullshit Poker - Bluff Your Way to Victory

A multiplayer poker bluffing game built with React and Framer Motion animations.

![Bullshit Poker](https://img.shields.io/badge/React-18.2.0-blue) ![Framer Motion](https://img.shields.io/badge/Framer%20Motion-Animated-purple)

## 🎮 How to Play

1. **Players:** 2-10
2. **Setup:** Each player starts with 1 card
3. **Goal:** Make claims about what poker hands exist across ALL players' cards
4. **Bluffing:** You can lie! But if someone calls BS and you're lying, you get +1 card
5. **Elimination:** Reach 6+ cards and you're out!
6. **Winner:** Last player standing wins!

## 🚀 Quick Start

### Installation

```bash
# Navigate to project folder
cd bullshit-poker

# Install dependencies
npm install

# Start development server
npm run dev
```

The game will open at **http://localhost:3000**

### Testing Multiplayer Locally

1. Open the app in your browser
2. Create a game and note the PIN
3. Open a **new tab** or **incognito window**
4. Join the same game using the PIN
5. Repeat for more players!

## 📁 Project Structure

```
bullshit-poker/
├── index.html                 # HTML entry point
├── package.json              # Dependencies
├── vite.config.js            # Vite configuration
├── src/
│   ├── main.jsx              # React entry point
│   ├── App.jsx               # App wrapper
│   ├── BullshitPoker.jsx     # Main game component
│   ├── storage.js            # localStorage adapter
│   └── index.css             # Global styles
```

## ✨ Features

### 🎨 Animations

- **Card Flip** - Cards flip smoothly when revealed
- **Player Join** - Players spin in when joining
- **Turn Indicator** - Glowing effect for active player
- **BS Button** - Dramatic pulse animation
- **Winner Celebration** - Confetti explosion!
- **Smooth Transitions** - Everything animates beautifully

### 🎯 Game Features

- Create or join games with PIN codes
- Real-time multiplayer (localStorage sync)
- Full poker hand validation
- Bluffing mechanics
- Round-based gameplay
- Player elimination system

## 🔧 Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool (fast!)
- **Framer Motion** - Smooth animations
- **Lucide React** - Icons
- **React Confetti** - Winner effects
- **localStorage** - Simple multiplayer storage

## 📝 Commands

```bash
# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🎯 Game Logic

The game uses your **exact original logic**:

- ✅ All poker hand types (High Card → Royal Flush)
- ✅ Claim validation rules
- ✅ BS call mechanics
- ✅ Round progression
- ✅ Elimination system
- ✅ Reconnection support

## 🌐 Deploying Later

When you're ready to host online:

### Option 1: Vercel (Recommended)

```bash
npm i -g vercel
vercel
```

### Option 2: Netlify

```bash
npm run build
# Drag 'dist' folder to netlify.com
```

### Option 3: Firebase Hosting

```bash
npm run build
npm i -g firebase-tools
firebase init hosting
firebase deploy
```

For production, replace `localStorage` with Firebase Realtime Database (I can help with this later!)

## 🎨 Customization

### Colors

Edit `src/index.css` to change:

- Table color (green felt)
- Button colors
- Player avatar colors

### Animations

Edit `src/BullshitPoker.jsx`:

- Search for `motion.` components
- Adjust `transition` props for speed
- Change `animate` props for effects

## 🐛 Troubleshooting

**Players not syncing between tabs?**

- Refresh both tabs
- Check browser console for errors
- localStorage might be disabled (enable it)

**Animations laggy?**

- Close other tabs
- Check browser performance
- Reduce number of animations in code

**Game PIN not working?**

- PINs are case-sensitive
- Try refreshing the page
- Create a new game

## 📚 Next Steps

1. **Test locally** - Open multiple tabs and play!
2. **Customize** - Change colors, animations, etc.
3. **Deploy** - When ready, I can help you add Firebase and deploy online
4. **Enhancements** - Sound effects? Chat? Leaderboards?

## 🎉 Enjoy!

Created with ❤️ using React + Framer Motion

---

**Need help?** Let me know and I'll assist with deployment or adding features!
