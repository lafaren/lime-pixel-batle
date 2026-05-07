const socket = io();
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const colorPicker = document.getElementById('colorPicker');

const SIZE = 1000;
let pixels = new Uint8Array(SIZE * SIZE * 3);
let currentTool = 'pencil';

let scale = 1, offsetX = 0, offsetY = 0;
const offCanvas = document.createElement('canvas');
offCanvas.width = SIZE; offCanvas.height = SIZE;
const offCtx = offCanvas.getContext('2d', { alpha: false });

function setTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-' + tool).classList.add('active');
}

function draw() {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offCanvas, 0, 0);
    ctx.restore();
}

socket.on('init', (data) => {
    pixels = new Uint8Array(data);
    const imgData = offCtx.createImageData(SIZE, SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
        imgData.data[i*4]=pixels[i*3]; imgData.data[i*4+1]=pixels[i*3+1]; imgData.data[i*4+2]=pixels[i*3+2]; imgData.data[i*4+3]=255;
    }
    offCtx.putImageData(imgData, 0, 0);
    scale = Math.min(window.innerWidth, window.innerHeight) / SIZE * 0.7;
    offsetX = (window.innerWidth - SIZE * scale) / 2;
    offsetY = (window.innerHeight - SIZE * scale) / 2;
    draw();
});

socket.on('update', (p) => updatePixelInCanvas(p));
socket.on('update_batch', (batch) => batch.forEach(p => updatePixelInCanvas(p)));

function updatePixelInCanvas({ index, r, g, b }) {
    pixels[index * 3] = r; pixels[index * 3 + 1] = g; pixels[index * 3 + 2] = b;
    offCtx.fillStyle = `rgb(${r},${g},${b})`;
    offCtx.fillRect(index % SIZE, Math.floor(index / SIZE), 1, 1);
    draw();
}

// УЛУЧШЕННЫЙ АЛГОРИТМ РАЗЛОМА
function createRift(startX, startY) {
    const batch = [];
    const numMainBranches = 6; // Количество основных лучей

    for (let i = 0; i < numMainBranches; i++) {
        growBranch(startX, startY, Math.random() * Math.PI * 2, 80, batch);
    }
    
    // Добавляем "ядро" в центре клика
    for(let x = -3; x <= 3; x++) {
        for(let y = -3; y <= 3; y++) {
            if (Math.hypot(x, y) < 3) {
                addPixelToBatch(startX + x, startY + y, {r:0, g:0, b:0}, batch);
            }
        }
    }

    socket.emit('pixels_batch', batch);
}

// Рекурсивная функция роста ветки
function growBranch(x, y, angle, len, batch) {
    if (len <= 0) return;

    let curX = x;
    let curY = y;
    let currentAngle = angle;

    for (let i = 0; i < len; i++) {
        // Искривление линии
        currentAngle += (Math.random() - 0.5) * 0.5;
        curX += Math.cos(currentAngle);
        curY += Math.sin(currentAngle);

        const px = Math.round(curX);
        const py = Math.round(curY);

        // Цвета: чем дальше от центра, тем ярче фиолетовый
        let color = { r: 0, g: 0, b: 0 };
        if (Math.random() > 0.6) color = { r: 50, g: 0, b: 200 }; // Синий
        if (Math.random() > 0.8) color = { r: 180, g: 0, b: 255 }; // Яркий фиолетовый

        addPixelToBatch(px, py, color, batch);

        // Шанс создать боковое ответвление
        if (Math.random() < 0.05 && len > 10) {
            growBranch(px, py, currentAngle + (Math.random() - 0.5) * 2, len * 0.6, batch);
        }
    }
}

function addPixelToBatch(x, y, color, batch) {
    if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) {
        batch.push({ index: y * SIZE + x, ...color });
    }
}

// УПРАВЛЕНИЕ
let isDragging = false, lastX, lastY;

canvas.addEventListener('mousedown', (e) => {
    const x = Math.floor((e.clientX - offsetX) / scale);
    const y = Math.floor((e.clientY - offsetY) / scale);

    if (e.button === 0) {
        if (currentTool === 'pencil') {
            const hex = colorPicker.value;
            socket.emit('pixel', { 
                index: y * SIZE + x, 
                r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) 
            });
        } else if (currentTool === 'brush') {
            const batch = [];
            for(let i=-10; i<10; i++) for(let j=-10; j<10; j++) {
                const hex = colorPicker.value;
                addPixelToBatch(x+i, y+j, {r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16)}, batch);
            }
            socket.emit('pixels_batch', batch);
        } else if (currentTool === 'rift') {
            createRift(x, y);
        }
    } else {
        isDragging = true;
        lastX = e.clientX; lastY = e.clientY;
    }
});

window.addEventListener('mousemove', (e) => {
    if (isDragging) {
        offsetX += e.clientX - lastX; offsetY += e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        draw();
    }
});
window.addEventListener('mouseup', () => isDragging = false);
canvas.addEventListener('wheel', (e) => {
    const factor = e.deltaY > 0 ? 0.8 : 1.2;
    const mX = e.clientX, mY = e.clientY;
    offsetX = mX - (mX - offsetX) * factor;
    offsetY = mY - (mY - offsetY) * factor;
    scale *= factor;
    draw();
}, { passive: false });

window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; draw(); });
canvas.oncontextmenu = (e) => e.preventDefault();
canvas.width = window.innerWidth; canvas.height = window.innerHeight;
