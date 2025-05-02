import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { createBoxGeometry, createInnerGeometry } from '../utils/diceGeometry';

const DiceRoller = () => {
  const canvasRef = useRef(null);
  const [score, setScore] = useState('');
  const [numberOfDice, setNumberOfDice] = useState(2);
  const [isHistoryEnabled, setIsHistoryEnabled] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    return localStorage.getItem('theme') === 'dark' || prefersDarkScheme.matches;
  });
  const [rollHistory, setRollHistory] = useState([]);
  
  // Create refs for persistent values across renders
  const worldRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const diceMeshRef = useRef(null);
  const diceArrayRef = useRef([]);
  const animationRef = useRef(null);

  const params = {
    segments: 40,
    edgeRadius: .07,
    notchRadius: .12,
    notchDepth: .1,
    shakeThreshold: 15,
    shakeCooldown: 1000,
  };

  // Define throwDice outside of useEffect so it's accessible to the button
  const throwDice = useCallback(() => {
    if (!diceArrayRef.current || diceArrayRef.current.length === 0) return;
    
    // Clear the score display
    setScore('');
    
    diceArrayRef.current.forEach((dice, dIdx) => {
      dice.body.velocity.setZero();
      dice.body.angularVelocity.setZero();
      
      // Position dice above the scene, offset each one slightly
      dice.body.position = new CANNON.Vec3(3, dIdx * 1.5 + 2, 0);
      dice.mesh.position.copy(dice.body.position);
      
      // Random initial rotation
      dice.mesh.rotation.set(2 * Math.PI * Math.random(), 0, 2 * Math.PI * Math.random());
      dice.body.quaternion.copy(dice.mesh.quaternion);
      
      // Apply impulse force with some randomness
      const force = 3 + 5 * Math.random();
      dice.body.applyImpulse(
        new CANNON.Vec3(-force, force, 0),
        new CANNON.Vec3(0, 0, .2)
      );
      
      // Allow dice to go to sleep state when it stops moving
      dice.body.allowSleep = true;
    });
  }, []);

  // Helper function to format the current time as HH:MM:SS
  const getFormattedTime = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    
    // Clear previous animation if it exists
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    // Clear any existing dice
    diceArrayRef.current = [];
    
    const initPhysics = () => {
      worldRef.current = new CANNON.World({
        allowSleep: true,
        gravity: new CANNON.Vec3(0, -50, 0),
      });
      worldRef.current.defaultContactMaterial.restitution = .3;
    };

    const initScene = () => {
      rendererRef.current = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas: canvasRef.current
      });
      rendererRef.current.shadowMap.enabled = true;
      rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      sceneRef.current = new THREE.Scene();
      cameraRef.current = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, .1, 300);
      cameraRef.current.position.set(0, .5, 4).multiplyScalar(7);

      updateSceneSize();

      const ambientLight = new THREE.AmbientLight(0xffffff, .5);
      sceneRef.current.add(ambientLight);
      
      const topLight = new THREE.PointLight(0xffffff, .5);
      topLight.position.set(10, 15, 0);
      topLight.castShadow = true;
      topLight.shadow.mapSize.width = 2048;
      topLight.shadow.mapSize.height = 2048;
      topLight.shadow.camera.near = 5;
      topLight.shadow.camera.far = 400;
      sceneRef.current.add(topLight);
      
      createFloor();
      diceMeshRef.current = createDiceMesh();
      
      for (let i = 0; i < numberOfDice; i++) {
        diceArrayRef.current.push(createDice());
        addDiceEvents(diceArrayRef.current[i]);
      }

      throwDice();
      render();
    };

    const createFloor = () => {
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(1000, 1000),
        new THREE.ShadowMaterial({ opacity: .1 })
      );
      floor.receiveShadow = true;
      floor.position.y = -7;
      floor.quaternion.setFromAxisAngle(new THREE.Vector3(-1, 0, 0), Math.PI * .5);
      sceneRef.current.add(floor);

      const floorBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Plane(),
      });
      floorBody.position.copy(floor.position);
      floorBody.quaternion.copy(floor.quaternion);
      worldRef.current.addBody(floorBody);
    };

    const createDiceMesh = () => {
      // Match exactly the original color and material properties
      const boxMaterialOuter = new THREE.MeshStandardMaterial({
        color: 0xeeeeee
      });
      
      const boxMaterialInner = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 0,
        metalness: 1,
        side: THREE.DoubleSide
      });

      const diceMesh = new THREE.Group();
      const innerMesh = new THREE.Mesh(createInnerGeometry(), boxMaterialInner);
      const outerMesh = new THREE.Mesh(createBoxGeometry(params), boxMaterialOuter);
      outerMesh.castShadow = true;
      diceMesh.add(innerMesh, outerMesh);

      return diceMesh;
    };

    const createDice = () => {
      const mesh = diceMeshRef.current.clone();
      sceneRef.current.add(mesh);

      const body = new CANNON.Body({
        mass: 1,
        shape: new CANNON.Box(new CANNON.Vec3(.5, .5, .5)),
        sleepTimeLimit: .1
      });
      worldRef.current.addBody(body);

      return {mesh, body, value: 0};
    };

    const addDiceEvents = (dice) => {
      dice.body.addEventListener('sleep', (e) => {
        // Initially don't allow sleep - we'll re-enable it if we detect a valid face
        dice.body.allowSleep = false;
        
        // Get the Euler angles from quaternion
        const euler = new CANNON.Vec3();
        e.target.quaternion.toEuler(euler);
        
        // Define threshold for angle detection
        const eps = .1;
        const isZero = (angle) => Math.abs(angle) < eps;
        const isHalfPi = (angle) => Math.abs(angle - .5 * Math.PI) < eps;
        const isMinusHalfPi = (angle) => Math.abs(.5 * Math.PI + angle) < eps;
        const isPiOrMinusPi = (angle) => (Math.abs(Math.PI - angle) < eps || Math.abs(Math.PI + angle) < eps);
        
        // Determine dice value based on orientation
        let diceValue = 0;
        
        if (isZero(euler.z)) {
          if (isZero(euler.x)) {
            diceValue = 1;
          } else if (isHalfPi(euler.x)) {
            diceValue = 4;
          } else if (isMinusHalfPi(euler.x)) {
            diceValue = 3;
          } else if (isPiOrMinusPi(euler.x)) {
            diceValue = 6;
          } else {
            // landed on edge => wait to fall on side and fire the event again
            dice.body.allowSleep = true;
            return;
          }
        } else if (isHalfPi(euler.z)) {
          diceValue = 2;
        } else if (isMinusHalfPi(euler.z)) {
          diceValue = 5;
        } else {
          // landed on edge => wait to fall on side and fire the event again
          dice.body.allowSleep = true;
          return;
        }
        
        // Store the dice value
        dice.value = diceValue;
        
        // Update the score display
        updateScoreDisplay();
      });
    };
    
    const updateScoreDisplay = () => {
      // Collect all dice values
      const diceValues = diceArrayRef.current.map(dice => dice.value).filter(val => val > 0);
      
      // Only update if all dice have values
      if (diceValues.length === diceArrayRef.current.length) {
        const sum = diceValues.reduce((a, b) => a + b, 0);
        const scoreText = diceValues.join(' + ') + ' = ' + sum;
        setScore(scoreText);
        
        // Add to history if enabled, with timestamp
        if (isHistoryEnabled) {
          const timestamp = getFormattedTime();
          setRollHistory(prev => [
            `[${timestamp}] ${scoreText}`,
            ...prev
          ].slice(0, 10));
        }
      }
    };

    const updateSceneSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    const render = () => {
      worldRef.current.fixedStep(); // Use fixedStep for more stable physics
      
      diceArrayRef.current.forEach(dice => {
        dice.mesh.position.copy(dice.body.position);
        dice.mesh.quaternion.copy(dice.body.quaternion);
      });
      
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      animationRef.current = requestAnimationFrame(render);
    };

    const handleDeviceMotion = (event) => {
      const currentTime = new Date().getTime();
      let lastShakeTime = 0;
      let lastX = 0, lastY = 0, lastZ = 0;
      
      if (currentTime - lastShakeTime < params.shakeCooldown) return;

      const acceleration = event.accelerationIncludingGravity;
      if (!acceleration) return;

      const { x, y, z } = acceleration;
      const movement = Math.sqrt(
        Math.pow(x - lastX, 2) +
        Math.pow(y - lastY, 2) +
        Math.pow(z - lastZ, 2)
      );

      if (movement > params.shakeThreshold) {
        lastShakeTime = currentTime;
        throwDice();
      }

      lastX = x;
      lastY = y;
      lastZ = z;
    };

    const initShakeDetection = () => {
      if (window.DeviceMotionEvent) {
        window.addEventListener('devicemotion', handleDeviceMotion);
      }
    };

    // Initialize everything
    initPhysics();
    initScene();
    initShakeDetection();

    // Add event listeners
    window.addEventListener('resize', updateSceneSize);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', updateSceneSize);
      window.removeEventListener('devicemotion', handleDeviceMotion);
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      
      if (sceneRef.current) {
        sceneRef.current.clear();
      }
      
      worldRef.current = null;
      diceArrayRef.current = [];
    };
  }, [numberOfDice, throwDice, isHistoryEnabled]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');
    localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
  }, [isDarkTheme]);

  return (
    <div className="dice-roller">
      <canvas ref={canvasRef} id="canvas" />
      <div className="dice-selector">
        <div className="selector-row">
          <label htmlFor="dice-number">Number of dice:</label>
          <select 
            id="dice-number" 
            value={numberOfDice}
            onChange={(e) => setNumberOfDice(parseInt(e.target.value))}
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>
        </div>
        <div className="history-controls">
          <label className="history-toggle">
            <span>Keep History</span>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={isHistoryEnabled}
                onChange={(e) => setIsHistoryEnabled(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </label>
          <label className="history-toggle">
            <span>Dark Theme</span>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={isDarkTheme}
                onChange={(e) => setIsDarkTheme(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </label>
          {isHistoryEnabled && (
            <div className="history-container">
              <ul className="history-list">
                {rollHistory.map((roll, index) => (
                  <li key={index}>{roll}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <div className="ui-controls">
        <div className="score">Score: <span>{score}</span></div>
        <button onClick={throwDice}>Throw the dice</button>
        <div className="shake-hint">or<br />Shake your device to roll</div>
      </div>
    </div>
  );
};

export default DiceRoller;