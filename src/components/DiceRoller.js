import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { createBoxGeometry, createInnerGeometry } from '../utils/diceGeometry';

const DiceRoller = () => {
  const canvasRef = useRef(null);
  const [score, setScore] = useState('');
  const [numberOfDice, setNumberOfDice] = useState(2);
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    return localStorage.getItem('theme') === 'dark' || prefersDarkScheme.matches;
  });
  const [keepHistory, setKeepHistory] = useState(false);
  const [history, setHistory] = useState([]);
  
  const worldRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const diceMeshRef = useRef(null);
  const diceArrayRef = useRef([]);
  const animationRef = useRef(null);
  const isRollingRef = useRef(false);
  const stabilityTimerRef = useRef(null);

  const params = {
    segments: 40,
    edgeRadius: .07,
    notchRadius: .12,
    notchDepth: .1,
    shakeThreshold: 15,
    shakeCooldown: 2000,
    stabilityDelay: 500,
  };

  const throwDice = useCallback(() => {
    if (!diceArrayRef.current || diceArrayRef.current.length === 0) return;
    
    setScore('');
    isRollingRef.current = true;
    
    if (stabilityTimerRef.current) {
      clearTimeout(stabilityTimerRef.current);
      stabilityTimerRef.current = null;
    }
    
    diceArrayRef.current.forEach((dice, dIdx) => {
      dice.body.velocity.setZero();
      dice.body.angularVelocity.setZero();
      dice.value = 0;
      
      dice.body.position = new CANNON.Vec3(3, dIdx * 1.5 + 2, 0);
      dice.mesh.position.copy(dice.body.position);
      
      dice.mesh.rotation.set(2 * Math.PI * Math.random(), 0, 2 * Math.PI * Math.random());
      dice.body.quaternion.copy(dice.mesh.quaternion);
      
      const force = 3 + 5 * Math.random();
      dice.body.applyImpulse(
        new CANNON.Vec3(-force, force, 0),
        new CANNON.Vec3(0, 0, .2)
      );
      
      dice.body.allowSleep = true;
    });
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
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
        dice.body.allowSleep = false;
        
        const euler = new CANNON.Vec3();
        e.target.quaternion.toEuler(euler);
        
        const eps = .1;
        const isZero = (angle) => Math.abs(angle) < eps;
        const isHalfPi = (angle) => Math.abs(angle - .5 * Math.PI) < eps;
        const isMinusHalfPi = (angle) => Math.abs(.5 * Math.PI + angle) < eps;
        const isPiOrMinusPi = (angle) => (Math.abs(Math.PI - angle) < eps || Math.abs(Math.PI + angle) < eps);
        
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
            dice.body.allowSleep = true;
            return;
          }
        } else if (isHalfPi(euler.z)) {
          diceValue = 2;
        } else if (isMinusHalfPi(euler.z)) {
          diceValue = 5;
        } else {
          dice.body.allowSleep = true;
          return;
        }
        
        dice.value = diceValue;
        dice.body.allowSleep = true;
        
        updateScoreDisplay();
        
        if (stabilityTimerRef.current) {
          clearTimeout(stabilityTimerRef.current);
        }
        
        stabilityTimerRef.current = setTimeout(() => {
          isRollingRef.current = false;
          stabilityTimerRef.current = null;
        }, params.stabilityDelay);
      });
    };
    
    const updateScoreDisplay = () => {
      const diceValues = diceArrayRef.current.map(dice => dice.value).filter(val => val > 0);
      
      if (diceValues.length === diceArrayRef.current.length) {
        const sum = diceValues.reduce((a, b) => a + b, 0);
        const scoreText = diceValues.join(' + ') + ' = ' + sum;
        
        setScore(scoreText);
        
        if (keepHistory) {
          const timestamp = new Date().toLocaleTimeString(undefined, { hour12: false });
          const newEntry = { result: scoreText, timestamp };
          setHistory(prev => [...prev, newEntry]);
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
      worldRef.current.fixedStep();
      
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

    initPhysics();
    initScene();
    initShakeDetection();

    window.addEventListener('resize', updateSceneSize);

    return () => {
      window.removeEventListener('resize', updateSceneSize);
      window.removeEventListener('devicemotion', handleDeviceMotion);
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      if (stabilityTimerRef.current) {
        clearTimeout(stabilityTimerRef.current);
        stabilityTimerRef.current = null;
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
  }, [numberOfDice, throwDice, keepHistory]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');
    localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
  }, [isDarkTheme]);

  useEffect(() => {
    if (!keepHistory) {
      setHistory([]);
    }
  }, [keepHistory]);

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
        <div className="theme-control">
          <label className="theme-toggle">
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
        </div>
        <div className="theme-control">
          <label className="theme-toggle">
            <span>Keep History</span>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={keepHistory}
                onChange={(e) => setKeepHistory(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </label>
        </div>
        {keepHistory && (
          <div className="history-container">
            <h3>Roll History</h3>
            {history.length > 0 ? (
              <ul className="history-list">
                {history.map((entry, index) => (
                  <li key={index} className="history-item">
                    <span className="history-result">{entry.result}</span>
                    <span className="history-timestamp">{entry.timestamp}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-history">No rolls yet.</p>
            )}
          </div>
        )}
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