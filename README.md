# 3D Dice Roller

A modern, interactive 3D dice rolling application built with React, Three.js and CANNON.js. Experience realistic physics-based dice rolling with a beautiful user interface.

## Features

- 🎲 Realistic 3D dice physics simulation
- 📱 Mobile-friendly with device shake detection
- 🎯 Multiple dice support (1-4 dice)
- 📊 Roll history tracking
- 🌙 Dark/Light theme support
- 💫 Smooth animations and transitions
- 🎨 Modern, clean user interface

## Technologies Used

- React - UI Framework
- Three.js - 3D graphics rendering
- CANNON.js - Physics engine
- HTML5 Device Motion API - Mobile shake detection
- CSS Variables - Dynamic theming

## Getting Started

### Prerequisites

- Node.js (>=22.0.0) - Make sure you have Node.js version 22.0.0 or later installed.
- A modern web browser

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd dice-roller
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally

To start the development server:
```bash
npm start
```
The application will be available at `http://localhost:3000` (or the next available port).

### Building for Production

To create a production build:
```bash
npm run build
```
This command creates an optimized build in the `build/` directory.

## Usage

### Desktop
- Click the "Throw the dice" button to roll
- Use the dropdown to select the number of dice (1-4)
- Toggle the history switch to view past rolls
- Switch between dark and light themes

### Mobile
- Tap the "Throw the dice" button to roll
- Shake your device to trigger a roll
- Use the same controls as desktop for dice selection and history

## Project Structure
```
dice-roller/
├── public/
│   ├── index.html
│   └── favicon.ico
└── src/
    ├── components/
    │   └── DiceRoller.js
    ├── utils/
    │   └── diceGeometry.js
    ├── App.js
    ├── App.css
    └── index.js
```

## Deployment

This project is configured for deployment on [Vercel](https://vercel.com/).

1.  Push your code to a Git repository (e.g., GitHub, GitLab, Bitbucket).
2.  Import the Git repository into your Vercel account.
3.  Vercel will automatically detect the Create React App setup (using `react-scripts`), run the `npm run build` command, and deploy the contents of the `build/` directory.

Refer to the `vercel.json` file for specific deployment configurations.

## License

This project is licensed under the MIT License.