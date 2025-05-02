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
  const diceArrayRef = useRef([]);

  const params = {
    segments: 40,
    edgeRadius: .07,
    notchRadius: .12,
    notchDepth: .1,
    shakeThreshold: 15,
    shakeCooldown: 1000,
    angleEpsilon: .1
  };

  // Define throwDice outside of useEffect so it's accessible to the button
  const throwDice = useCallback(() => {
    if (!diceArrayRef.current || diceArrayRef.current.length === 0) return;
    
    diceArrayRef.current.forEach(dice => {
      dice.body.velocity.setZero();
      dice.body.angularVelocity.setZero();
      dice.body.position.set(0, 5, 0);
      dice.mesh.rotation.set(2 * Math.PI * Math.random(), 0, 2 * Math.PI * Math.random());
      dice.body.quaternion.copy(dice.mesh.quaternion);
      dice.body.velocity.set(10 * (Math.random() - .5), -5, 10 * (Math.random() - .5));
      dice.body.angularVelocity.set(20 * Math.random() - 10, 20 * Math.random() - 10, 20 * Math.random() - 10);
    });
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    let renderer, scene, camera, diceMesh;
    let lastShakeTime = 0;
    let lastX = 0, lastY = 0, lastZ = 0;
    
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
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas: canvasRef.current
      });
      renderer.shadowMap.enabled = true;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, .1, 300);
      camera.position.set(0, .5, 4).multiplyScalar(7);

      updateSceneSize();

      const ambientLight = new THREE.AmbientLight(0xffffff, .8); // Increased intensity
      scene.add(ambientLight);
      
      const topLight = new THREE.PointLight(0xffffff, 1.0); // Increased intensity
      topLight.position.set(10, 15, 0);
      topLight.castShadow = true;
      topLight.shadow.mapSize.width = 2048;
      topLight.shadow.mapSize.height = 2048;
      topLight.shadow.camera.near = 5;
      topLight.shadow.camera.far = 400;
      scene.add(topLight);
      
      // Add another light from the front
      const frontLight = new THREE.DirectionalLight(0xffffff, 0.7);
      frontLight.position.set(0, 3, 10);
      frontLight.castShadow = true;
      scene.add(frontLight);
      
      createFloor();
      diceMesh = createDiceMesh();
      
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
      scene.add(floor);

      const floorBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Plane(),
      });
      floorBody.position.copy(floor.position);
      floorBody.quaternion.copy(floor.quaternion);
      worldRef.current.addBody(floorBody);
    };

    const createDiceMesh = () => {
      // Brighter white color for the dice
      const boxMaterialOuter = new THREE.MeshStandardMaterial({ 
        color: 0xffffff,
        roughness: 0.2,
        metalness: 0.1
      });
      
      const boxMaterialInner = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 0,
        metalness: 0.7,
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
      const mesh = diceMesh.clone();
      scene.add(mesh);

      const body = new CANNON.Body({
        mass: 1,
        shape: new CANNON.Box(new CANNON.Vec3(.5, .5, .5)),
        sleepTimeLimit: .1
      });
      worldRef.current.addBody(body);

      return {mesh, body};
    };

    const addDiceEvents = (dice) => {
      dice.body.addEventListener('sleep', (e) => {
        // Calculate all dice values and display
        calculateAllDiceValues();
      });
    };
    
    const calculateAllDiceValues = () => {
      if (!diceArrayRef.current || diceArrayRef.current.length === 0) return;
      
      const diceValues = diceArrayRef.current.map(d => {
        const diceEuler = new THREE.Euler().setFromQuaternion(d.body.quaternion);
        let nx = Math.floor(Math.abs(diceEuler.x / (Math.PI * 0.5) + 0.5)) % 2;
        let ny = Math.floor(Math.abs(diceEuler.y / (Math.PI * 0.5) + 0.5)) % 2;
        let nz = Math.floor(Math.abs(diceEuler.z / (Math.PI * 0.5) + 0.5)) % 2;
        
        let val = 1;
        if (diceEuler.x < -params.angleEpsilon) val = nx ? 2 : 5;
        else if (diceEuler.x > params.angleEpsilon) val = nx ? 5 : 2;
        else if (diceEuler.y < -params.angleEpsilon) val = ny ? 1 : 6;
        else if (diceEuler.y > params.angleEpsilon) val = ny ? 6 : 1;
        else if (diceEuler.z < -params.angleEpsilon) val = nz ? 3 : 4;
        else if (diceEuler.z > params.angleEpsilon) val = nz ? 4 : 3;
        
        return val;
      });
      
      const sum = diceValues.reduce((a, b) => a + b, 0);
      setScore(diceValues.join(' + ') + ' = ' + sum);
      
      if (isHistoryEnabled) {
        setRollHistory(prev => [
          `Roll: ${diceValues.join(' + ')} = ${sum}`,
          ...prev
        ].slice(0, 10));
      }
    };

    const updateSceneSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const render = () => {
      worldRef.current.step(1/60);
      diceArrayRef.current.forEach(dice => {
        dice.mesh.position.copy(dice.body.position);
        dice.mesh.quaternion.copy(dice.body.quaternion);
      });
      renderer.render(scene, camera);
      requestAnimationFrame(render);
    };

    const handleDeviceMotion = (event) => {
      const currentTime = new Date().getTime();
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
      if (renderer) {
        renderer.dispose();
        scene.clear();
      }
      worldRef.current = null;
      diceArrayRef.current = [];
    };
  }, [numberOfDice, throwDice]);

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