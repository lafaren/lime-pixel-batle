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

// ГИГАНТСКИЙ РАЗЛОМ С ГРАДИЕНТОМ
function createRift(startX, startY) {
    const batch = [];
    const mainBranches = 12; // Больше лучей
    const coreRadius = 8;    // Радиус черного ядра

    // 1. Создаем центральное черное ядро
    for(let x = -coreRadius; x <= coreRadius; x++) {
        for(let y = -coreRadius; y <= coreRadius; y++) {
            if (Math.hypot(x, y) < coreRadius) {
                addPixel(startX + x, startY + y, {r:0, g:0, b:0}, batch);
            }
        }
    }

    // 2. Запускаем длинные молнии
    for (let i = 0; i < mainBranches; i++) {
        const angle = (i / mainBranches) * Math.PI * 2 + Math.random();
        growLightning(startX, startY, angle, 250, 0, batch); // Длина 250 пикселей!
    }

    socket.emit('pixels_batch', batch);
}

// Рекурсивные молнии с плавным цветом
function growLightning(x, y, angle, fullLen, currentStep, batch) {
    if (currentStep >= fullLen) return;

    let curX = x;
    let curY = y;
    let curAngle = angle;
    
    // Чем дальше от центра, тем меньше ветвится
    const stepCount = Math.random() * 20 + 10; 

    for (let i = 0; i < stepCount; i++) {
        currentStep++;
        curAngle += (Math.random() - 0.5) * 0.8; // Излом молнии
        curX += Math.cos(curAngle);
        curY += Math.sin(curAngle);

        // Плавный переход цвета в зависимости от пройденного пути (currentStep / fullLen)
        const progress = currentStep / fullLen;
        const color = getRiftColor(progress);

        addPixel(Math.round(curX), Math.round(curY), color, batch);

        // Шанс ветвления
        if (Math.random() < 0.04 && currentStep < fullLen * 0.8) {
            const sideAngle = curAngle + (Math.random() - 0.5) * 1.5;
            growLightning(curX, curY, sideAngle, fullLen, currentStep + 10, batch);
        }
    }
}

// Функция плавного градиента
function getRiftColor(p) {
    if (p < 0.2) return { r: 0, g: 0, b: 0 };           // В начале черное
    if (p < 0.5) return { r: 0, g: 50, b: 255 };        // Потом глубокий синий
    if (p < 0.8) return { r: 150, g: 0, b: 255 };      // Затем фиолетовый
    return { r: 255, g: 200, b: 0 };                   // На концах искры (золотистый/любой)
}

function addPixel(x, y, color, batch) {
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
            socket.emit('pixel', { index: y * SIZE + x, r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) });
        } else if (currentTool === 'brush') {
            const batch = [];
            const hex = colorPicker.value;
            const rgb = { r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) };
            for(let i=-10; i<10; i++) for(let j=-10; j<10; j++) addPixel(x+i, y+j, rgb, batch);
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
