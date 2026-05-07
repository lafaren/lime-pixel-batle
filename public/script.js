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
    ctx.fillStyle = '#050505';
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
    updateWholeCanvas();
    scale = Math.min(window.innerWidth, window.innerHeight) / SIZE * 0.9;
    offsetX = (window.innerWidth - SIZE * scale) / 2;
    offsetY = (window.innerHeight - SIZE * scale) / 2;
    draw();
});

function updateWholeCanvas() {
    const imgData = offCtx.createImageData(SIZE, SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
        imgData.data[i*4]=pixels[i*3]; imgData.data[i*4+1]=pixels[i*3+1]; imgData.data[i*4+2]=pixels[i*3+2]; imgData.data[i*4+3]=255;
    }
    offCtx.putImageData(imgData, 0, 0);
}

socket.on('update_batch', (batch) => {
    batch.forEach(({ index, r, g, b }) => {
        pixels[index * 3] = r; pixels[index * 3 + 1] = g; pixels[index * 3 + 2] = b;
        offCtx.fillStyle = `rgb(${r},${g},${b})`;
        offCtx.fillRect(index % SIZE, Math.floor(index / SIZE), 1, 1);
    });
    draw();
});

// ФУНКЦИЯ ПЛАВНОГО СМЕШИВАНИЯ ЦВЕТОВ (LERP)
function lerpColor(c1, c2, t) {
    return {
        r: Math.round(c1.r + (c2.r - c1.r) * t),
        g: Math.round(c1.g + (c2.g - c1.g) * t),
        b: Math.round(c1.b + (c2.b - c1.b) * t)
    };
}

function getSmoothColor(p) {
    const colors = [
        { t: 0.0, c: { r: 0, g: 100, b: 255 } },   // Ярко-синий (у ядра)
        { t: 0.4, c: { r: 100, g: 0, b: 255 } },  // Фиолетовый
        { t: 0.7, c: { r: 255, g: 0, b: 150 } },  // Розовый
        { t: 1.0, c: { r: 0, g: 255, b: 200 } }   // Бирюзовый (на концах)
    ];
    for (let i = 0; i < colors.length - 1; i++) {
        if (p >= colors[i].t && p <= colors[i + 1].t) {
            const localT = (p - colors[i].t) / (colors[i + 1].t - colors[i].t);
            return lerpColor(colors[i].c, colors[i + 1].c, localT);
        }
    }
    return colors[colors.length - 1].c;
}

// ГИГАНТСКИЙ РАЗЛОМ
function createRift(startX, startY) {
    const batch = [];
    const mainBranches = 15;
    const coreRadius = 15;

    // 1. Черное ядро
    for(let x = -coreRadius; x <= coreRadius; x++) {
        for(let y = -coreRadius; y <= coreRadius; y++) {
            if (Math.hypot(x, y) < coreRadius) addPixel(startX + x, startY + y, {r:0, g:0, b:0}, batch);
        }
    }
    // 2. Синяя обводка ядра
    for(let a = 0; a < Math.PI * 2; a += 0.1) {
        const rx = startX + Math.cos(a) * (coreRadius + 1);
        const ry = startY + Math.sin(a) * (coreRadius + 1);
        addPixel(Math.round(rx), Math.round(ry), {r: 0, g: 150, b: 255}, batch);
    }

    // 3. Молнии (увеличили длину до 600+)
    for (let i = 0; i < mainBranches; i++) {
        const angle = (i / mainBranches) * Math.PI * 2 + Math.random();
        growLightning(startX, startY, angle, 600, 0, 5, batch); // Толщина 5 в начале
    }
    socket.emit('pixels_batch', batch);
}

function growLightning(x, y, angle, fullLen, currentStep, thickness, batch) {
    if (currentStep >= fullLen || thickness < 0.5) return;

    let curX = x, curY = y, curAngle = angle;
    const steps = Math.random() * 30 + 20;

    for (let i = 0; i < steps; i++) {
        currentStep++;
        curAngle += (Math.random() - 0.5) * 0.7;
        curX += Math.cos(curAngle);
        curY += Math.sin(curAngle);

        const progress = currentStep / fullLen;
        const color = getSmoothColor(progress);
        
        // Уменьшаем толщину по мере удаления
        const curThickness = Math.max(1, thickness * (1 - progress));

        for (let tx = -Math.floor(curThickness/2); tx <= Math.ceil(curThickness/2); tx++) {
            for (let ty = -Math.floor(curThickness/2); ty <= Math.ceil(curThickness/2); ty++) {
                addPixel(Math.round(curX + tx), Math.round(curY + ty), color, batch);
            }
        }

        if (Math.random() < 0.03 && currentStep < fullLen * 0.7) {
            growLightning(curX, curY, curAngle + (Math.random()-0.5)*2, fullLen, currentStep, thickness * 0.6, batch);
        }
    }
}

function addPixel(x, y, color, batch) {
    if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) batch.push({ index: y * SIZE + x, ...color });
}

// УПРАВЛЕНИЕ (без изменений)
let isDragging = false, lastX, lastY;
canvas.addEventListener('mousedown', (e) => {
    const x = Math.floor((e.clientX - offsetX) / scale), y = Math.floor((e.clientY - offsetY) / scale);
    if (e.button === 0) {
        if (currentTool === 'pencil') {
            const h = colorPicker.value;
            socket.emit('pixel', { index: y * SIZE + x, r: parseInt(h.slice(1,3),16), g: parseInt(h.slice(3,5),16), b: parseInt(h.slice(5,7),16) });
        } else if (currentTool === 'brush') {
            const b = [], h = colorPicker.value, rgb = { r: parseInt(h.slice(1,3),16), g: parseInt(h.slice(3,5),16), b: parseInt(h.slice(5,7),16) };
            for(let i=-10; i<10; i++) for(let j=-10; j<10; j++) addPixel(x+i, y+j, rgb, b);
            socket.emit('pixels_batch', b);
        } else if (currentTool === 'rift') createRift(x, y);
    } else { isDragging = true; lastX = e.clientX; lastY = e.clientY; }
});
window.addEventListener('mousemove', (e) => { if (isDragging) { offsetX += e.clientX - lastX; offsetY += e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; draw(); } });
window.addEventListener('mouseup', () => isDragging = false);
canvas.addEventListener('wheel', (e) => {
    const f = e.deltaY > 0 ? 0.8 : 1.2;
    offsetX = e.clientX - (e.clientX - offsetX) * f; offsetY = e.clientY - (e.clientY - offsetY) * f;
    scale *= f; draw();
}, { passive: false });
window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; draw(); });
canvas.oncontextmenu = (e) => e.preventDefault();
canvas.width = window.innerWidth; canvas.height = window.innerHeight;
