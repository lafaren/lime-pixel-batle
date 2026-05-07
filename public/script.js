const socket = io();
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const colorPicker = document.getElementById('colorPicker');

const SIZE = 1000;
let pixels = new Uint8Array(SIZE * SIZE * 3);
let currentTool = 'pencil';

// Камера
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
    ctx.fillStyle = '#0a0a0a';
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

// АЛГОРИТМ РАЗЛОМА
function createRift(startX, startY) {
    const batch = [];
    const branches = 8; // Количество "молний"
    
    for (let b = 0; b < branches; b++) {
        let curX = startX;
        let curY = startY;
        let length = Math.random() * 50 + 20; // Длина ветки
        
        for (let i = 0; i < length; i++) {
            // Случайное смещение
            curX += Math.floor(Math.random() * 3) - 1;
            curY += Math.floor(Math.random() * 3) - 1;
            
            if (curX < 0 || curX >= SIZE || curY < 0 || curY >= SIZE) break;

            // Выбор цвета в стиле Rain World
            const rand = Math.random();
            let color = { r: 0, g: 0, b: 0 }; // Тень
            if (rand > 0.7) color = { r: 60, g: 0, b: 255 }; // Синий
            if (rand > 0.9) color = { r: 200, g: 0, b: 255 }; // Фиолетовый

            batch.push({ index: curY * SIZE + curX, ...color });
        }
    }
    socket.emit('pixels_batch', batch);
}

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        const x = Math.floor((e.clientX - offsetX) / scale);
        const y = Math.floor((e.clientY - offsetY) / scale);
        const hex = colorPicker.value;
        const rgb = { r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) };

        if (currentTool === 'pencil') {
            socket.emit('pixel', { index: y * SIZE + x, ...rgb });
        } else if (currentTool === 'brush') {
            const batch = [];
            for(let i=-10; i<10; i++) for(let j=-10; j<10; j++) {
                if (x+i>=0 && x+i<SIZE && y+j>=0 && y+j<SIZE)
                    batch.push({ index: (y+j)*SIZE + (x+i), ...rgb });
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

// Управление зумом и движением (стандартное)
let isDragging = false, lastX, lastY;
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
