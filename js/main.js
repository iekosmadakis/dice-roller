import * as CANNON from 'https://cdn.skypack.dev/cannon-es';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

const canvasEl = document.querySelector('#canvas');
const scoreResult = document.querySelector('#score-result');
const rollBtn = document.querySelector('#roll-btn');
const diceNumberSelect = document.querySelector('#dice-number');
const historyToggle = document.querySelector('#history-toggle');
const historyContainer = document.querySelector('#history-container');
const historyList = document.querySelector('#history-list');
const themeToggle = document.querySelector('#theme-toggle');

const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
const currentTheme = localStorage.getItem('theme') || (prefersDarkScheme.matches ? 'dark' : 'light');

document.documentElement.setAttribute('data-theme', currentTheme);
themeToggle.checked = currentTheme === 'dark';

themeToggle.addEventListener('change', (e) => {
    const theme = e.target.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
});

let renderer, scene, camera, diceMesh, physicsWorld;
let lastShakeTime = 0;
let lastX = 0, lastY = 0, lastZ = 0;
let rollHistory = [];
let currentRollResults = [];

const params = {
    numberOfDice: 2,
    segments: 40,
    edgeRadius: .07,
    notchRadius: .12,
    notchDepth: .1,
    shakeThreshold: 15, // Shake sensitivity
    shakeCooldown: 1000, // Minimum time between shakes (in ms)
    angleEpsilon: .1
};

const diceArray = [];

initPhysics();
initScene();
initShakeDetection();

window.addEventListener('resize', updateSceneSize);
rollBtn.addEventListener('click', throwDice);
diceNumberSelect.addEventListener('change', updateDiceNumber);

function updateDiceNumber() {
    const newNumber = parseInt(diceNumberSelect.value);
    if (newNumber === params.numberOfDice) return;

    diceArray.forEach(dice => {
        scene.remove(dice.mesh);
        physicsWorld.removeBody(dice.body);
    });
    diceArray.length = 0;

    params.numberOfDice = newNumber;

    for (let i = 0; i < params.numberOfDice; i++) {
        diceArray.push(createDice());
        addDiceEvents(diceArray[i]);
    }

    scoreResult.innerHTML = '';
}

function initShakeDetection() {
    if (window.DeviceMotionEvent) {
        window.addEventListener('devicemotion', handleDeviceMotion);
    }
}

function handleDeviceMotion(event) {
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
}

function initScene() {
    renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas: canvasEl
    });
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, .1, 300);
    camera.position.set(0, .5, 4).multiplyScalar(7);

    updateSceneSize();

    const ambientLight = new THREE.AmbientLight(0xffffff, .5);
    scene.add(ambientLight);
    
    const topLight = new THREE.PointLight(0xffffff, .5);
    topLight.position.set(10, 15, 0);
    topLight.castShadow = true;
    topLight.shadow.mapSize.width = 2048;
    topLight.shadow.mapSize.height = 2048;
    topLight.shadow.camera.near = 5;
    topLight.shadow.camera.far = 400;
    scene.add(topLight);
    
    createFloor();
    diceMesh = createDiceMesh();
    
    for (let i = 0; i < params.numberOfDice; i++) {
        diceArray.push(createDice());
        addDiceEvents(diceArray[i]);
    }

    throwDice();
    render();
}

function initPhysics() {
    physicsWorld = new CANNON.World({
        allowSleep: true,
        gravity: new CANNON.Vec3(0, -50, 0),
    });
    physicsWorld.defaultContactMaterial.restitution = .3;
}

function createFloor() {
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
    physicsWorld.addBody(floorBody);
}

function createDiceMesh() {
    const boxMaterialOuter = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
    const boxMaterialInner = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 0,
        metalness: 1,
        side: THREE.DoubleSide
    });

    const diceMesh = new THREE.Group();
    const innerMesh = new THREE.Mesh(createInnerGeometry(), boxMaterialInner);
    const outerMesh = new THREE.Mesh(createBoxGeometry(), boxMaterialOuter);
    outerMesh.castShadow = true;
    diceMesh.add(innerMesh, outerMesh);

    return diceMesh;
}

function createDice() {
    const mesh = diceMesh.clone();
    scene.add(mesh);

    const body = new CANNON.Body({
        mass: 1,
        shape: new CANNON.Box(new CANNON.Vec3(.5, .5, .5)),
        sleepTimeLimit: .1
    });
    physicsWorld.addBody(body);

    return {mesh, body};
}

function createBoxGeometry() {
    let boxGeometry = new THREE.BoxGeometry(1, 1, 1, params.segments, params.segments, params.segments);
    const positionAttr = boxGeometry.attributes.position;
    const subCubeHalfSize = .5 - params.edgeRadius;

    for (let i = 0; i < positionAttr.count; i++) {
        let position = new THREE.Vector3().fromBufferAttribute(positionAttr, i);
        const subCube = new THREE.Vector3(Math.sign(position.x), Math.sign(position.y), Math.sign(position.z)).multiplyScalar(subCubeHalfSize);
        const addition = new THREE.Vector3().subVectors(position, subCube);

        if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.y) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
            addition.normalize().multiplyScalar(params.edgeRadius);
            position = subCube.add(addition);
        } else if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.y) > subCubeHalfSize) {
            addition.z = 0;
            addition.normalize().multiplyScalar(params.edgeRadius);
            position.x = subCube.x + addition.x;
            position.y = subCube.y + addition.y;
        } else if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
            addition.y = 0;
            addition.normalize().multiplyScalar(params.edgeRadius);
            position.x = subCube.x + addition.x;
            position.z = subCube.z + addition.z;
        } else if (Math.abs(position.y) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
            addition.x = 0;
            addition.normalize().multiplyScalar(params.edgeRadius);
            position.y = subCube.y + addition.y;
            position.z = subCube.z + addition.z;
        }

        const notchWave = (v) => {
            v = (1 / params.notchRadius) * v;
            v = Math.PI * Math.max(-1, Math.min(1, v));
            return params.notchDepth * (Math.cos(v) + 1.);
        };
        const notch = (pos) => notchWave(pos[0]) * notchWave(pos[1]);

        const offset = .23;

        if (position.y === .5) {
            position.y -= notch([position.x, position.z]);
        } else if (position.x === .5) {
            position.x -= notch([position.y + offset, position.z + offset]);
            position.x -= notch([position.y - offset, position.z - offset]);
        } else if (position.z === .5) {
            position.z -= notch([position.x - offset, position.y + offset]);
            position.z -= notch([position.x, position.y]);
            position.z -= notch([position.x + offset, position.y - offset]);
        } else if (position.z === -.5) {
            position.z += notch([position.x + offset, position.y + offset]);
            position.z += notch([position.x + offset, position.y - offset]);
            position.z += notch([position.x - offset, position.y + offset]);
            position.z += notch([position.x - offset, position.y - offset]);
        } else if (position.x === -.5) {
            position.x += notch([position.y + offset, position.z + offset]);
            position.x += notch([position.y + offset, position.z - offset]);
            position.x += notch([position.y, position.z]);
            position.x += notch([position.y - offset, position.z + offset]);
            position.x += notch([position.y - offset, position.z - offset]);
        } else if (position.y === -.5) {
            position.y += notch([position.x + offset, position.z + offset]);
            position.y += notch([position.x + offset, position.z]);
            position.y += notch([position.x + offset, position.z - offset]);
            position.y += notch([position.x - offset, position.z + offset]);
            position.y += notch([position.x - offset, position.z]);
            position.y += notch([position.x - offset, position.z - offset]);
        }

        positionAttr.setXYZ(i, position.x, position.y, position.z);
    }

    boxGeometry.deleteAttribute('normal');
    boxGeometry.deleteAttribute('uv');
    boxGeometry = BufferGeometryUtils.mergeVertices(boxGeometry);
    boxGeometry.computeVertexNormals();

    return boxGeometry;
}

function createInnerGeometry() {
    const baseGeometry = new THREE.PlaneGeometry(1 - 2 * params.edgeRadius, 1 - 2 * params.edgeRadius);
    const offset = .48;
    return BufferGeometryUtils.mergeBufferGeometries([
        baseGeometry.clone().translate(0, 0, offset),
        baseGeometry.clone().translate(0, 0, -offset),
        baseGeometry.clone().rotateX(.5 * Math.PI).translate(0, -offset, 0),
        baseGeometry.clone().rotateX(.5 * Math.PI).translate(0, offset, 0),
        baseGeometry.clone().rotateY(.5 * Math.PI).translate(-offset, 0, 0),
        baseGeometry.clone().rotateY(.5 * Math.PI).translate(offset, 0, 0),
    ], false);
}

function addDiceEvents(dice) {
    dice.body.addEventListener('sleep', (e) => {
        dice.body.allowSleep = false;
        const euler = new CANNON.Vec3();
        e.target.quaternion.toEuler(euler);

        let isZero = (angle) => Math.abs(angle) < params.angleEpsilon;
        let isHalfPi = (angle) => Math.abs(angle - .5 * Math.PI) < params.angleEpsilon;
        let isMinusHalfPi = (angle) => Math.abs(.5 * Math.PI + angle) < params.angleEpsilon;
        let isPiOrMinusPi = (angle) => (Math.abs(Math.PI - angle) < params.angleEpsilon || Math.abs(Math.PI + angle) < params.angleEpsilon);

        if (isZero(euler.z)) {
            if (isZero(euler.x)) {
                showRollResults(1);
            } else if (isHalfPi(euler.x)) {
                showRollResults(4);
            } else if (isMinusHalfPi(euler.x)) {
                showRollResults(3);
            } else if (isPiOrMinusPi(euler.x)) {
                showRollResults(6);
            } else {
                // landed on edge => wait to fall on side and fire the event again
                dice.body.allowSleep = true;
            }
        } else if (isHalfPi(euler.z)) {
            showRollResults(2);
        } else if (isMinusHalfPi(euler.z)) {
            showRollResults(5);
        } else {
            // landed on edge => wait to fall on side and fire the event again
            dice.body.allowSleep = true;
        }
    });
}

function showRollResults(score) {
    currentRollResults.push(score);
    
    if (currentRollResults.length === params.numberOfDice) {
        const total = currentRollResults.reduce((sum, num) => sum + num, 0);
        
        if (scoreResult.innerHTML === '') {
            scoreResult.innerHTML = currentRollResults.join(' + ') + ' = <span class="score-result">' + total + '</span>';
        } else {
            const currentText = scoreResult.innerHTML;
            if (currentText.includes('=')) {
                const numbers = currentText.split('=')[0].match(/\d+/g);
                numbers.push(...currentRollResults);
                const newTotal = numbers.reduce((sum, num) => sum + parseInt(num), 0);
                scoreResult.innerHTML = numbers.join(' + ') + ' = <span class="score-result">' + newTotal + '</span>';
            } else {
                const total = parseInt(currentText) + total;
                scoreResult.innerHTML = `${currentText} + ${currentRollResults.join(' + ')} = <span class="score-result">${total}</span>`;
            }
        }

        const now = new Date();
        const timestamp = now.toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit', 
            hour12: false 
        });
        
        rollHistory.unshift({
            diceResults: [...currentRollResults],
            total: total,
            timestamp: timestamp
        });
        
        // Keep only last 15 rolls
        if (rollHistory.length > 15) {
            rollHistory.pop();
        }
        
        if (!historyContainer.classList.contains('hidden')) {
            updateHistoryDisplay();
        }
        
        currentRollResults = [];
    }
}

function updateHistoryDisplay() {
    historyList.innerHTML = '';
    rollHistory.forEach(roll => {
        const li = document.createElement('li');
        li.textContent = `${roll.diceResults.join(' + ')} = ${roll.total} (${roll.timestamp})`;
        historyList.appendChild(li);
    });
}

historyToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
        historyContainer.classList.remove('hidden');
        updateHistoryDisplay();
    } else {
        historyContainer.classList.add('hidden');
    }
});

function render() {
    // physicsWorld.step(1/100);
    physicsWorld.fixedStep();
    diceArray.forEach(dice => {
        dice.mesh.position.copy(dice.body.position);
        dice.mesh.quaternion.copy(dice.body.quaternion);
    });
    renderer.render(scene, camera);
    requestAnimationFrame(render);
}

function updateSceneSize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function throwDice() {
    scoreResult.innerHTML = '';
    currentRollResults = [];
    diceArray.forEach((dice, index) => {
        dice.body.velocity.setZero();
        dice.body.angularVelocity.setZero();
        dice.body.position.set(6, index * 1.5, 0);
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
}
