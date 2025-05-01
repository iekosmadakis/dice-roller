# 3D Dice Roller

A modern, interactive 3D dice rolling application built with Three.js and Cannon.js. Experience realistic physics-based dice rolling with a beautiful user interface.

## Features

- 🎲 Realistic 3D dice physics simulation
- 📱 Mobile-friendly with device shake detection
- 🎯 Multiple dice support (1-4 dice)
- 📊 Roll history tracking
- 💫 Smooth animations and transitions
- 🎨 Modern, clean user interface
- 🌙 Responsive design for all screen sizes

## Technologies Used

- [Three.js](https://threejs.org/) - 3D graphics rendering
- [Cannon.js](https://schteppe.github.io/cannon.js/) - Physics engine
- HTML5 Device Motion API - Mobile shake detection
- Modern CSS - Styling and animations
- Vanilla JavaScript - Core functionality

## Getting Started

### Prerequisites

- Node.js (v22 LTS or higher recommended)
- A modern web browser (Chrome, Firefox, Safari, or Edge)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/iekosmadakis/dice-roller.git
   cd dice-roller
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open `http://localhost:3000` in your browser

## Usage

### Desktop
- Click the "Throw the dice" button to roll
- Use the dropdown to select the number of dice (1-4)
- Toggle the history switch to view past rolls

### Mobile
- Tap the "Throw the dice" button to roll
- Shake your device to trigger a roll
- Use the same controls as desktop for dice selection and history

## Features in Detail

### Dice Physics
- Realistic collision detection
- Natural rolling and bouncing behavior
- Smooth animations for dice movement

### History Tracking
- Stores the last 15 rolls
- Shows individual dice results and totals
- Timestamps in 24-hour format
- Easy toggle to show/hide history

### Mobile Optimization
- Responsive design for all screen sizes
- Touch-friendly controls
- Device shake detection for intuitive rolling
- Optimized performance for mobile devices

## Browser Support

- Chrome
- Firefox
- Safari
- Edge
- Mobile browsers (iOS Safari, Android Chrome)

## Development

### Project Structure
```
dice-roller/
├── css/
│   └── base.css
├── js/
│   └── main.js
├── index.html
└── README.md
```

### Building for Production
```bash
npm run build
```

## Deployment

This project can be deployed to any static hosting service:

### Vercel
```bash
npm install -g vercel
vercel
```

### Netlify
```bash
npm install -g netlify-cli
netlify deploy
```

## License

This project is licensed under the MIT License.